/**
 * scripts/test_call_service.mjs
 *
 * Automated regression test suite for Production Call Service (callService.ts):
 *  - Deterministic ASCII user ID comparison for glare resolution
 *  - Safe candidate queuing before remote description
 *  - Glare tie-breaking (loser yields and answers; winner ignores and proceeds)
 *  - Busy handling (incoming offer from 3rd party rejected with user_busy)
 *  - Explicit decline (user_declined) and caller cancel (caller_cancelled)
 *  - Track mute vs call disconnection distinction
 *  - Hardware release and call history recording on termination
 */

import { register } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

register(pathToFileURL(path.resolve('scripts/test-resolver.mjs')));

import test from 'node:test';
import assert from 'node:assert/strict';

const {
  compareUserIds,
  SafeIceCandidateQueue,
  callService,
} = await import('../apps/mobile/services/callService.ts');

const { storage, STORAGE_KEYS } = await import('../apps/mobile/services/storage.ts');
const { wsClient } = await import('../apps/mobile/services/websocket.ts');
const { callHistoryService } = await import('../apps/mobile/services/callHistory.ts');

test('Call Service: compareUserIds performs deterministic, locale-independent ASCII comparison', () => {
  // Test lower ASCII ordering
  assert.equal(compareUserIds('alice-1', 'bob-2'), -1);
  assert.equal(compareUserIds('bob-2', 'alice-1'), 1);

  // Test case-insensitivity and trimming
  assert.equal(compareUserIds(' Alice ', 'alice'), 0);
  assert.equal(compareUserIds('USER-A', 'user-b'), -1);
  assert.equal(compareUserIds('user-b', 'USER-A'), 1);
  assert.equal(compareUserIds('uuid-1234', 'uuid-1234'), 0);

  // Test UUID hex characters
  assert.equal(compareUserIds('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002'), -1);
});

test('Call Service: SafeIceCandidateQueue buffers candidates before remote description is set', () => {
  const mockAddedCandidates = [];
  const mockPc = {
    signalingState: 'have-local-offer',
    addIceCandidate: (c) => mockAddedCandidates.push(c),
  };

  const queue = new SafeIceCandidateQueue(mockPc, 'peer-user-1', 'session-123');

  // 1. Candidate received before remote description
  const accepted1 = queue.addCandidate({
    targetUserId: 'my-user',
    senderUserId: 'peer-user-1',
    signalType: 'ice-candidate',
    data: {
      callSessionId: 'session-123',
      candidate: 'candidate:1 1 UDP 2122260223 192.168.1.100 50000 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    },
  });

  assert.equal(accepted1, true);
  // Not yet added to PC because remote description has not been applied
  assert.equal(mockAddedCandidates.length, 0);

  // 2. Stale candidate with mismatched sessionId is rejected
  const rejectedStale = queue.addCandidate({
    targetUserId: 'my-user',
    senderUserId: 'peer-user-1',
    signalType: 'ice-candidate',
    data: {
      callSessionId: 'stale-old-session',
      candidate: 'candidate:2 1 UDP 2122260223 192.168.1.100 50001 typ host',
    },
  });
  assert.equal(rejectedStale, false);
  assert.equal(mockAddedCandidates.length, 0);

  // 3. Mark remote description applied -> queue drains immediately
  queue.setRemoteDescriptionApplied();
  assert.equal(mockAddedCandidates.length, 1);
  assert.equal(mockAddedCandidates[0].candidate, 'candidate:1 1 UDP 2122260223 192.168.1.100 50000 typ host');

  // 4. Subsequent candidate arriving after remote description is applied immediately
  const accepted2 = queue.addCandidate({
    targetUserId: 'my-user',
    senderUserId: 'peer-user-1',
    signalType: 'ice-candidate',
    data: {
      callSessionId: 'session-123',
      candidate: 'candidate:3 1 UDP 2122260223 192.168.1.100 50002 typ host',
      sdpMid: '0',
      sdpMLineIndex: 0,
    },
  });
  assert.equal(accepted2, true);
  assert.equal(mockAddedCandidates.length, 2);
  assert.equal(mockAddedCandidates[1].candidate, 'candidate:3 1 UDP 2122260223 192.168.1.100 50002 typ host');
});

test('Call Service: Outgoing call initiation sends offer and starts ringing state', async () => {
  await storage.setJson(STORAGE_KEYS.CURRENT_USER, {
    id: 'user-alice',
    displayName: 'Alice Cooper',
  });

  const sentSignals = [];
  const origSend = wsClient.sendCallSignal.bind(wsClient);
  wsClient.sendCallSignal = (sig) => sentSignals.push(sig);

  try {
    const res = await callService.startCall({
      targetUserId: 'user-bob',
      targetName: 'Bob Dylan',
      isVideo: true,
      conversationId: 'conv-123',
    });

    assert.equal(res.success, true);
    const session = callService.getSession();
    assert.ok(session);
    assert.equal(session.state, 'outgoing_ringing');
    assert.equal(session.peerId, 'user-bob');
    assert.equal(session.isVideo, true);
    assert.equal(session.duration, 0); // Must be 0 while ringing!

    // Verify signal sent
    assert.equal(sentSignals.length, 1);
    assert.equal(sentSignals[0].targetUserId, 'user-bob');
    assert.equal(sentSignals[0].signalType, 'offer');
    assert.equal(sentSignals[0].data.callSessionId, session.sessionId);
    assert.equal(sentSignals[0].data.isVideo, true);
    assert.equal(sentSignals[0].data.callerName, 'Alice Cooper');
  } finally {
    await callService.terminateCall('user_ended', 'Test cleanup', false);
    wsClient.sendCallSignal = origSend;
  }
});

test('Call Service: Glare handling - Tie Loser drops outgoing offer and yields to incoming offer', async () => {
  // Current user: 'user-alice'
  // Remote peer: 'user-bob'
  // compareUserIds('user-alice', 'user-bob') === -1 (Alice is LOSER)
  await storage.setJson(STORAGE_KEYS.CURRENT_USER, {
    id: 'user-alice',
    displayName: 'Alice Cooper',
  });

  const sentSignals = [];
  const origSend = wsClient.sendCallSignal.bind(wsClient);
  wsClient.sendCallSignal = (sig) => sentSignals.push(sig);

  try {
    // 1. Alice starts outgoing call to Bob
    await callService.startCall({
      targetUserId: 'user-bob',
      targetName: 'Bob Dylan',
      isVideo: false,
    });

    const initialSession = callService.getSession();
    assert.equal(initialSession.state, 'outgoing_ringing');
    assert.equal(initialSession.isIncoming, false);

    // 2. Incoming offer from Bob arrives simultaneously (Glare!)
    const bobSessionId = 'bob-session-999';
    await callService.handleIncomingSignal({
      targetUserId: 'user-alice',
      senderUserId: 'user-bob',
      signalType: 'offer',
      data: {
        callSessionId: bobSessionId,
        isVideo: false,
        callerName: 'Bob Dylan',
        sdp: { type: 'offer', sdp: 'v=0\r\n' },
      },
    });

    // Alice (loser) yields: outgoing call dropped, incoming offer answered
    const activeSession = callService.getSession();
    assert.ok(activeSession);
    assert.equal(activeSession.sessionId, bobSessionId);
    assert.equal(activeSession.isIncoming, true);
    assert.equal(activeSession.state, 'connecting');

    // Answer signal was emitted to Bob
    const answerSig = sentSignals.find((s) => s.signalType === 'answer');
    assert.ok(answerSig);
    assert.equal(answerSig.targetUserId, 'user-bob');
    assert.equal(answerSig.data.callSessionId, bobSessionId);
  } finally {
    await callService.terminateCall('user_ended', 'Test cleanup', false);
    wsClient.sendCallSignal = origSend;
  }
});

test('Call Service: Glare handling - Tie Winner ignores incoming offer and maintains outgoing call', async () => {
  // Current user: 'user-bob'
  // Remote peer: 'user-alice'
  // compareUserIds('user-bob', 'user-alice') === 1 (Bob is WINNER)
  await storage.setJson(STORAGE_KEYS.CURRENT_USER, {
    id: 'user-bob',
    displayName: 'Bob Dylan',
  });

  const sentSignals = [];
  const origSend = wsClient.sendCallSignal.bind(wsClient);
  wsClient.sendCallSignal = (sig) => sentSignals.push(sig);

  try {
    // 1. Bob starts outgoing call to Alice
    await callService.startCall({
      targetUserId: 'user-alice',
      targetName: 'Alice Cooper',
      isVideo: false,
    });

    const initialSession = callService.getSession();
    const bobSessionId = initialSession.sessionId;
    assert.equal(initialSession.state, 'outgoing_ringing');

    // 2. Incoming offer from Alice arrives simultaneously
    const aliceSessionId = 'alice-session-777';
    await callService.handleIncomingSignal({
      targetUserId: 'user-bob',
      senderUserId: 'user-alice',
      signalType: 'offer',
      data: {
        callSessionId: aliceSessionId,
        isVideo: false,
        callerName: 'Alice Cooper',
        sdp: { type: 'offer', sdp: 'v=0\r\n' },
      },
    });

    // Bob (winner) keeps his outgoing call untouched!
    const activeSession = callService.getSession();
    assert.ok(activeSession);
    assert.equal(activeSession.sessionId, bobSessionId);
    assert.equal(activeSession.isIncoming, false);
    assert.equal(activeSession.state, 'outgoing_ringing');
  } finally {
    await callService.terminateCall('user_ended', 'Test cleanup', false);
    wsClient.sendCallSignal = origSend;
  }
});

test('Call Service: Busy rejection - 3rd party offer while in call emits user_busy without disrupting active call', async () => {
  await storage.setJson(STORAGE_KEYS.CURRENT_USER, {
    id: 'user-alice',
    displayName: 'Alice Cooper',
  });

  const sentSignals = [];
  const origSend = wsClient.sendCallSignal.bind(wsClient);
  wsClient.sendCallSignal = (sig) => sentSignals.push(sig);

  try {
    // 1. In active call with Bob
    await callService.startCall({
      targetUserId: 'user-bob',
      targetName: 'Bob Dylan',
      isVideo: false,
    });
    const session = callService.getSession();

    // 2. Charlie attempts to call Alice
    await callService.handleIncomingSignal({
      targetUserId: 'user-alice',
      senderUserId: 'user-charlie',
      signalType: 'offer',
      data: {
        callSessionId: 'charlie-session-333',
        callerName: 'Charlie Chaplin',
      },
    });

    // Verify user_busy was emitted to Charlie
    const busySig = sentSignals.find((s) => s.targetUserId === 'user-charlie');
    assert.ok(busySig);
    assert.equal(busySig.signalType, 'hangup');
    assert.equal(busySig.data.reason, 'user_busy');
    assert.equal(busySig.data.callSessionId, 'charlie-session-333');

    // Alice's active call with Bob remains unaffected!
    const currentSession = callService.getSession();
    assert.equal(currentSession.sessionId, session.sessionId);
    assert.equal(currentSession.peerId, 'user-bob');
    assert.equal(currentSession.state, 'outgoing_ringing');
  } finally {
    await callService.terminateCall('user_ended', 'Test cleanup', false);
    wsClient.sendCallSignal = origSend;
  }
});

test('Call Service: Caller cancellation and Callee decline emit correct reasons', async () => {
  await storage.setJson(STORAGE_KEYS.CURRENT_USER, {
    id: 'user-alice',
    displayName: 'Alice Cooper',
  });

  const sentSignals = [];
  const origSend = wsClient.sendCallSignal.bind(wsClient);
  wsClient.sendCallSignal = (sig) => sentSignals.push(sig);

  try {
    // 1. Caller cancels while ringing
    await callService.startCall({
      targetUserId: 'user-bob',
      targetName: 'Bob Dylan',
      isVideo: false,
    });
    await callService.hangupCall();

    const cancelSig = sentSignals.find((s) => s.signalType === 'hangup' && s.targetUserId === 'user-bob');
    assert.ok(cancelSig);
    assert.equal(cancelSig.data.reason, 'caller_cancelled');

    // Wait for ended state to clear
    await new Promise((r) => setTimeout(r, 1300));
    assert.equal(callService.getSession(), null);

    // 2. Callee declines incoming call
    sentSignals.length = 0;
    await callService.handleIncomingSignal({
      targetUserId: 'user-alice',
      senderUserId: 'user-bob',
      signalType: 'offer',
      data: {
        callSessionId: 'bob-incoming-555',
        callerName: 'Bob Dylan',
        isVideo: false,
      },
    });

    assert.equal(callService.getSession()?.state, 'incoming_ringing');
    await callService.declineIncomingCall();

    const declineSig = sentSignals.find((s) => s.signalType === 'hangup' && s.targetUserId === 'user-bob');
    assert.ok(declineSig);
    assert.equal(declineSig.data.reason, 'user_declined');
  } finally {
    wsClient.sendCallSignal = origSend;
  }
});

test('Call Service: Track mute controls local track enabled without disconnecting session', async () => {
  await storage.setJson(STORAGE_KEYS.CURRENT_USER, {
    id: 'user-alice',
    displayName: 'Alice Cooper',
  });

  try {
    await callService.startCall({
      targetUserId: 'user-bob',
      targetName: 'Bob Dylan',
      isVideo: true,
    });

    const session = callService.getSession();
    assert.equal(session.isMuted, false);

    // Toggle mute
    const muted = callService.toggleMute();
    assert.equal(muted, true);
    assert.equal(callService.getSession()?.isMuted, true);

    const audioTrack = session.localStream.getAudioTracks()[0];
    assert.equal(audioTrack.enabled, false);

    // Call state must NOT be ended or disconnected!
    assert.equal(callService.getSession()?.state, 'outgoing_ringing');

    // Unmute
    const unmuted = callService.toggleMute();
    assert.equal(unmuted, false);
    assert.equal(callService.getSession()?.isMuted, false);
    assert.equal(audioTrack.enabled, true);
  } finally {
    await callService.terminateCall('user_ended', 'Test cleanup', false);
  }
});

test('Call Service: Teardown stops tracks and records persistent call history', async () => {
  await storage.setJson(STORAGE_KEYS.CURRENT_USER, {
    id: 'user-alice',
    displayName: 'Alice Cooper',
  });

  await callService.startCall({
    targetUserId: 'user-bob',
    targetName: 'Bob Dylan',
    isVideo: false,
    conversationId: 'conv-teardown',
  });

  const session = callService.getSession();
  const localTracks = session.localStream.getTracks();

  // Terminate call
  await callService.terminateCall('user_ended', 'Call ended', false);

  // Verify tracks were stopped
  localTracks.forEach((t) => {
    assert.equal(t.readyState, 'ended');
  });

  // Verify call recorded in history
  const history = await callHistoryService.getHistory();
  const recorded = history.find((c) => c.contactName === 'Bob Dylan');
  assert.ok(recorded);
  assert.equal(recorded.type, 'outgoing');
  assert.equal(recorded.isVideo, false);
});

