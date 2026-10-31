#!/usr/bin/env node

/**
 * IndiChat Demo Users & Cross-Platform Auth Verification Suite
 * 
 * Verifies:
 * 1. Alice 2FA challenge (rejected without PIN, rejected with wrong PIN, accepted with 112233)
 * 2. Successful login and token issuance for all 7 demo accounts
 * 3. Mutual contact records synchronization (6 contacts per user + reciprocal peer checks)
 * 4. Shared "IndiChat Community" group membership and message history retrieval
 * 5. JWT Refresh Token rotation
 * 
 * Usage:
 *   node scripts/verify_all_demo_users.js
 */

const API_URL = process.env.API_URL || 'http://localhost:8080/api/v1';

const DEMO_USERS = [
  { username: 'alice', name: 'Alice Cooper', requires2FA: true, pin: '112233' },
  { username: 'bob', name: 'Bob Dylan', requires2FA: false },
  { username: 'charlie', name: 'Charlie Davis', requires2FA: false },
  { username: 'david', name: 'David Miller', requires2FA: false },
  { username: 'emma', name: 'Emma Watson', requires2FA: false },
  { username: 'frank', name: 'Frank Castle', requires2FA: false },
  { username: 'grace', name: 'Grace Hopper', requires2FA: false },
];

async function postJson(endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function getJson(endpoint, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${endpoint}`, {
    method: 'GET',
    headers,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function main() {
  console.log('====================================================');
  console.log('🧪 IndiChat Multi-User Auth & Contacts Test Suite');
  console.log(`🎯 Target API: ${API_URL}`);
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  // --- 1. Two-Step Verification Tests for Alice ---
  console.log('Step 1: Testing 2FA Challenge Mechanics (Alice)...');
  
  // 1a. Alice login without PIN
  const aliceNoPin = await postJson('/auth/login', {
    usernameOrEmail: 'alice',
    password: 'Password123!',
  });
  assert(
    aliceNoPin.status === 200 && aliceNoPin.data?.requiresTwoFactor === true,
    'Alice login without PIN triggers requiresTwoFactor: true'
  );

  // 1b. Alice login with wrong PIN
  const aliceWrongPin = await postJson('/auth/login', {
    usernameOrEmail: 'alice',
    password: 'Password123!',
    twoFactorPin: '000000',
  });
  assert(
    aliceWrongPin.status === 401,
    'Alice login with incorrect PIN is rejected with HTTP 401'
  );

  // 1c. Alice login with valid PIN
  const aliceValid = await postJson('/auth/login', {
    usernameOrEmail: 'alice',
    password: 'Password123!',
    twoFactorPin: '112233',
  });
  assert(
    aliceValid.status === 200 && Boolean(aliceValid.data?.tokens?.accessToken),
    'Alice login with correct PIN (112233) succeeds and returns JWT tokens'
  );

  console.log('\nStep 2: Authenticating All 7 Demo Users...');
  const userSessions = new Map();

  for (const user of DEMO_USERS) {
    const payload = {
      usernameOrEmail: user.username,
      password: 'Password123!',
    };
    if (user.requires2FA) {
      payload.twoFactorPin = user.pin;
    }

    const res = await postJson('/auth/login', payload);
    const hasToken = res.status === 200 && Boolean(res.data?.tokens?.accessToken);
    const hasUser = res.data?.user?.username === user.username;
    
    assert(
      hasToken && hasUser,
      `User @${user.username} authenticated successfully (ID: ${res.data?.user?.id})`
    );

    if (hasToken) {
      userSessions.set(user.username, {
        user: res.data.user,
        tokens: res.data.tokens,
      });
    }
  }

  console.log('\nStep 3: Verifying Mutual Contacts Synchronization & Reciprocity...');
  for (const user of DEMO_USERS) {
    const session = userSessions.get(user.username);
    if (!session) continue;

    const contactsRes = await getJson('/contacts', session.tokens.accessToken);
    const contacts = Array.isArray(contactsRes.data) ? contactsRes.data : [];
    const contactCount = contacts.length;
    
    // Each of the 7 users should have the other 6 users as mutual contacts
    assert(
      contactsRes.status === 200 && contactCount >= 6,
      `User @${user.username} has synchronized contact list (${contactCount} contacts)`
    );

    // Verify reciprocal contacts: check that all other 6 demo usernames are present
    const otherUsernames = DEMO_USERS.filter(u => u.username !== user.username).map(u => u.username);
    const contactUsernames = new Set(contacts.map(c => c.user?.username).filter(Boolean));
    const allPresent = otherUsernames.every(uname => contactUsernames.has(uname));
    assert(
      allPresent,
      `User @${user.username} has reciprocal contacts for all peers (${otherUsernames.length} peers)`
    );
  }

  console.log('\nStep 4: Verifying Shared "IndiChat Community" Group Conversation...');
  const bobSession = userSessions.get('bob');
  if (bobSession) {
    const convsRes = await getJson('/conversations', bobSession.tokens.accessToken);
    const conversations = Array.isArray(convsRes.data) ? convsRes.data : [];
    const communityGroup = conversations.find(c => c.title === 'IndiChat Community');

    assert(
      Boolean(communityGroup),
      'Found "IndiChat Community" group in conversations list'
    );

    if (communityGroup) {
      const msgsRes = await getJson(`/conversations/${communityGroup.id}/messages`, bobSession.tokens.accessToken);
      const messages = Array.isArray(msgsRes.data?.messages)
        ? msgsRes.data.messages
        : (Array.isArray(msgsRes.data) ? msgsRes.data : []);
      assert(
        msgsRes.status === 200 && messages.length >= 5,
        `Retrieved group messages (${messages.length} messages loaded)`
      );
    }
  }

  console.log('\nStep 5: Verifying JWT Refresh Token Rotation...');
  if (bobSession) {
    const refreshRes = await postJson('/auth/refresh', {
      refreshToken: bobSession.tokens.refreshToken,
    });
    assert(
      refreshRes.status === 200 && Boolean(refreshRes.data?.accessToken),
      'JWT Refresh Token endpoint successfully issues new access token'
    );
  }

  console.log('\n====================================================');
  console.log(`📊 Test Summary: ${passed}/${total} assertions passed`);
  if (passed === total) {
    console.log('🎉 All Demo User, Contact Reciprocity & Auth Checks PASSED!');
    console.log('====================================================\n');
  } else {
    console.error('❌ Some tests FAILED. Please review the output above.');
    console.log('====================================================\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('💥 Unexpected test suite failure:', err);
  process.exit(1);
});
