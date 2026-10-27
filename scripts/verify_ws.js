// Node 22 has native WebSocket support
const API_URL = 'http://localhost:8080/api/v1';

async function main() {
  console.log('1. Authenticating Alice and Bob...');
  
  const aliceRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail: 'alice', password: 'Password123!', twoFactorPin: '112233' })
  }).then(r => r.json());

  const bobRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernameOrEmail: 'bob', password: 'Password123!' })
  }).then(r => r.json());

  const aliceToken = aliceRes.tokens.accessToken;
  const bobToken = bobRes.tokens.accessToken;
  const aliceId = aliceRes.user.id;
  const bobId = bobRes.user.id;

  console.log(`Alice ID: ${aliceId}, Bob ID: ${bobId}`);

  // Fetch or create conversation
  const convRes = await fetch(`${API_URL}/conversations`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${aliceToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'DIRECT', participantIds: [bobId] })
  }).then(r => r.json());

  const conversationId = convRes.id;
  console.log(`Conversation ID: ${conversationId}`);

  // Connect WebSocket sessions
  console.log('2. Connecting Alice and Bob to WebSocket (/ws)...');
  const aliceWs = new WebSocket(`ws://localhost:8080/ws?token=${aliceToken}`);
  const bobWs = new WebSocket(`ws://localhost:8080/ws?token=${bobToken}`);

  let resolveTest;
  const testPromise = new Promise((resolve) => { resolveTest = resolve; });

  bobWs.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    console.log(`[Bob received socket event]: ${msg.type}`);
    if (msg.type === 'message.created') {
      console.log(`[Bob received content]: "${msg.payload.content}"`);
      console.log('3. Bob emitting message.delivered and message.read...');
      bobWs.send(JSON.stringify({
        type: 'message.delivered',
        payload: { messageId: msg.payload.id, conversationId }
      }));
      bobWs.send(JSON.stringify({
        type: 'message.read',
        payload: { messageId: msg.payload.id, conversationId }
      }));
    }
  };

  aliceWs.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    console.log(`[Alice received socket event]: ${msg.type}`);
    if (msg.type === 'message.receipt.updated') {
      console.log(`[Alice received receipt]: readAt=${msg.payload.readAt}, deliveredAt=${msg.payload.deliveredAt}`);
      if (msg.payload.readAt) {
        console.log('4. SUCCESS: Full roundtrip verified!');
        resolveTest(true);
      }
    }
  };

  // Wait for both connections to open
  await Promise.all([
    new Promise(res => { aliceWs.onopen = res; }),
    new Promise(res => { bobWs.onopen = res; })
  ]);
  console.log('Both WebSocket connections established!');

  // Alice sends message over socket
  const clientMessageId = crypto.randomUUID();
  console.log('Alice sending message.send over WebSocket...');
  aliceWs.send(JSON.stringify({
    type: 'message.send',
    payload: {
      conversationId,
      clientMessageId,
      messageType: 'TEXT',
      content: 'Real-time WebSocket Test from Alice to Bob!'
    }
  }));

  await testPromise;
  aliceWs.close();
  bobWs.close();
  console.log('Verification completed successfully!');
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
