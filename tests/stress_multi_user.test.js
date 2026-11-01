const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { MockBot, MockCtx, resetDatabaseState } = require('./helpers/mockHarness');
const db = require('../src/database/postgres');
const quizHandler = require('../src/modules/games/quizHandler');

describe('Challenger Multi-User Race Condition & Security Stress Suite', () => {
  let bot;
  const staffUserId = 7794982496;
  const groupChatId = -1002002;

  before(async () => {
    bot = new MockBot();
    quizHandler.register(bot);
    await resetDatabaseState(db);
  });

  after(() => {
    quizHandler.stopQuizTimer(groupChatId);
  });

  beforeEach(() => {
    bot.clearRecordings();
  });

  // ── Dimension 1: Multi-User Simultaneous Answer Race Condition ──
  it('Stress Test 1: 10 group members answering trivia simultaneously - Concurrency Lock Verification', async () => {
    // Ensure sufficient rewards in stock
    for (let i = 0; i < 15; i++) {
      await db.insertReward({
        category: 'PRIME_VIDEO',
        account_title: `Amazon Prime Multi Stock ${i}`,
        account_data: JSON.stringify({ email: `prime_${i}@test.com`, password: `pass_${i}` }),
        status: 'AVAILABLE'
      });
    }

    // Trigger quiz in group
    await bot.simulateCommand('quizz', {
      chat: { id: groupChatId, type: 'supergroup', title: 'Grupo Oficial VLP Stress' },
      from: { id: staffUserId, username: 'admin_vlp' },
      message: { text: '/quizz' }
    });

    const quizMsg = bot.recordedApiMessages.find(m => m.chat_id === groupChatId && (m.text.includes('QUIZZ') || m.text.includes('𝗤𝗨𝗜𝗭𝗭')));
    assert.ok(quizMsg, 'Quizz question card must be sent to the group');

    const session = await db.getActiveQuizSession(groupChatId);
    assert.ok(session, 'Active quiz session must exist in DB');

    let validAnswers = session.normalized_answers;
    if (typeof validAnswers === 'string') {
      validAnswers = validAnswers.replace(/^\{|\}$/g, '').split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    }
    const correctAnswer = validAnswers[0];

    // 10 simultaneous users reply with the correct answer
    const users = Array.from({ length: 10 }, (_, i) => ({
      id: 700000 + i,
      username: `contestant_${i}`,
      first_name: `User ${i}`
    }));

    // Dispatch all 10 messages concurrently via Promise.all
    const replyPromises = users.map(user => {
      return bot.simulateMessage({
        chat: { id: groupChatId, type: 'supergroup', title: 'Grupo Oficial VLP Stress' },
        from: user,
        message: {
          text: correctAnswer,
          reply_to_message: {
            message_id: quizMsg.message_id,
            text: quizMsg.text
          }
        }
      });
    });

    const replyContexts = await Promise.all(replyPromises);

    // Extract winner announcements
    const winReplies = replyContexts
      .map(ctx => ctx.getLastReply())
      .filter(reply => reply && (reply.includes('GANADOR DETECTADO') || reply.includes('Ganador:')));

    const allClaimCodes = [];
    for (const reply of winReplies) {
      const match = reply.match(/\/claim\s+([A-Za-z0-9_-]+)/);
      if (match) allClaimCodes.push(match[1]);
    }

    console.log(`[DIMENSION 1 RESULT] Simultaneous correct answers: 10 | Announcements: ${winReplies.length} | Claim Codes: ${allClaimCodes.length}`);

    // Must have exactly 1 winner
    assert.strictEqual(
      winReplies.length,
      1,
      `RACE CONDITION DETECTED: Expected exactly 1 winner announcement, but got ${winReplies.length}!`
    );
    assert.strictEqual(
      allClaimCodes.length,
      1,
      `RACE CONDITION DETECTED: Expected exactly 1 claim code generated, but got ${allClaimCodes.length}!`
    );
  });

  // ── Dimension 2: Cross-User Claim Hijacking Stress Test ──
  it('Stress Test 2: Cross-User Hijacking Stress Test - 100% rejection rate', async () => {
    const legitimateWinnerId = 888001;
    const hijackers = Array.from({ length: 15 }, (_, i) => ({
      id: 990000 + i,
      username: `hijacker_${i}`,
      first_name: `Attacker ${i}`
    }));

    // Create a legitimate claim token
    const tokenResult = await db.createClaimToken({
      userId: legitimateWinnerId,
      rewardId: 1,
      quizId: 'quiz_hijack_test',
      category: 'PRIME_VIDEO',
      ttlMinutes: 15
    });
    const targetCode = tokenResult.claimCode;

    // Concurrently execute 15 hijack attempts by different users in private chats
    const hijackPromises = hijackers.map(hijacker => {
      return bot.simulateCommand('claim', {
        chat: { id: hijacker.id, type: 'private' },
        from: hijacker,
        message: { text: `/claim ${targetCode}` },
        match: targetCode
      });
    });

    const hijackResults = await Promise.all(hijackPromises);

    let rejectedCount = 0;
    for (const ctx of hijackResults) {
      const reply = ctx.getLastReply();
      const hasSecurityDenial = reply && (
        reply.includes('CANJE NO AUTORIZADO') ||
        reply.includes('otro usuario') ||
        reply.includes('No autorizado') ||
        reply.includes('UNAUTHORIZED')
      );
      if (hasSecurityDenial) rejectedCount++;

      // Verify no account credentials leaked
      assert.strictEqual(ctx.getDocuments().length, 0, 'No files dispatched to hijacker');
      assert.ok(!reply.includes('Contraseña:'), 'Password must never be disclosed to hijacker');
      assert.ok(!reply.includes('DATOS DE ACCESO'), 'Access data must never be disclosed to hijacker');
    }

    console.log(`[DIMENSION 2 RESULT] Hijack attempts: 15 | Rejected: ${rejectedCount} / 15 (100%)`);
    assert.strictEqual(rejectedCount, 15, 'All 15 cross-user claim attempts must be rejected');

    // Verify token was NOT consumed by attackers
    const tokenAfter = await db.getClaimToken(targetCode);
    assert.strictEqual(tokenAfter.status, 'PENDING', 'Target token must remain PENDING');
    assert.strictEqual(tokenAfter.claimed_at, null, 'Target token must not be claimed');
  });

  // ── Dimension 3: Chat Context Isolation ──
  it('Stress Test 3: Chat Context Isolation across group, supergroup, channel, and private', async () => {
    const winnerId = 888002;
    const tokenResult = await db.createClaimToken({
      userId: winnerId,
      rewardId: 1,
      quizId: 'quiz_chat_isolation_test',
      category: 'PRIME_VIDEO',
      ttlMinutes: 15
    });
    const testCode = tokenResult.claimCode;

    const chatTypes = [
      { id: -100111, type: 'group', title: 'Grupo Simple' },
      { id: -100222, type: 'supergroup', title: 'Supergrupo Oficial' },
      { id: -100333, type: 'channel', title: 'Canal Oficial' }
    ];

    for (const chat of chatTypes) {
      const ctx = await bot.simulateCommand('claim', {
        chat,
        from: { id: winnerId, username: 'legit_winner' },
        message: { text: `/claim ${testCode}` },
        match: testCode
      });

      const reply = ctx.getLastReply();
      assert.ok(reply, `Must reply in ${chat.type}`);
      assert.ok(
        reply.includes('CANJE PRIVADO') || reply.includes('privado') || reply.includes('chat privado'),
        `Non-private chat ${chat.type} must reject /claim and redirect to private DM`
      );

      // Verify credentials NEVER disclosed in public chat
      assert.ok(!reply.includes('DATOS DE ACCESO'), `Public chat ${chat.type} must NEVER contain access data`);
      assert.ok(!reply.includes('Contraseña:'), `Public chat ${chat.type} must NEVER contain password`);
      assert.strictEqual(ctx.getDocuments().length, 0, `Public chat ${chat.type} must NEVER receive documents`);
    }

    // Now test private chat: credentials CAN be disclosed
    const ctxPrivate = await bot.simulateCommand('claim', {
      chat: { id: winnerId, type: 'private' },
      from: { id: winnerId, username: 'legit_winner' },
      message: { text: `/claim ${testCode}` },
      match: testCode
    });

    const privateReply = ctxPrivate.getLastReply();
    assert.ok(privateReply, 'Private claim must respond');
    assert.ok(privateReply.includes('DATOS DE ACCESO'), 'Private claim must deliver access data');
    assert.ok(privateReply.includes('<code>'), 'Private claim must deliver monospace credentials');
    console.log('[DIMENSION 3 RESULT] Chat isolation verified: Public chats (group, supergroup, channel) rejected 100%. Private DM allowed.');
  });

  // ── Dimension 4: Zero-Cookie Audit Under Load ──
  it('Stress Test 4: Zero-Cookie Audit across all outputs, buffers, and messages under high load', async () => {
    // Total documents dispatched across the entire bot lifecycle
    assert.strictEqual(bot.recordedDocuments.length, 0, 'Zero ctx.replyWithDocument calls allowed');
    assert.strictEqual(bot.recordedApiDocuments.length, 0, 'Zero bot.api.sendDocument calls allowed');

    // Inspect all recorded replies across all tests for cookie keywords or file mentions
    const forbiddenKeywords = [
      '.txt adjunto',
      'archivo de cookies',
      'Netscape HTTP Cookie',
      'CONVERTIDOR COOKIE',
      'cookie_hub'
    ];

    let violations = 0;
    for (const reply of bot.recordedReplies) {
      for (const kw of forbiddenKeywords) {
        if (reply.text.includes(kw)) {
          console.error(`[COOKIE AUDIT VIOLATION] Found forbidden text '${kw}' in reply: ${reply.text}`);
          violations++;
        }
      }
    }

    for (const apiMsg of bot.recordedApiMessages) {
      for (const kw of forbiddenKeywords) {
        if (apiMsg.text.includes(kw)) {
          console.error(`[COOKIE AUDIT VIOLATION] Found forbidden text '${kw}' in API message: ${apiMsg.text}`);
          violations++;
        }
      }
    }

    console.log(`[DIMENSION 4 RESULT] Zero-cookie audit passed with 0 violations across all messages.`);
    assert.strictEqual(violations, 0, 'Must have 0 cookie text or document violations');
  });

  // ── Dimension 5: Concurrent Double-Spend Race Condition on /claim ──
  it('Stress Test 5: Winner attempts 10 simultaneous /claim <code> executions - Single-Use Atomic Enforcement', async () => {
    const winnerId = 888003;
    const tokenResult = await db.createClaimToken({
      userId: winnerId,
      rewardId: 2,
      quizId: 'quiz_concurrent_claim_test',
      category: 'YOUTUBE_PREMIUM',
      ttlMinutes: 15
    });
    const code = tokenResult.claimCode;

    // 10 concurrent claim executions of the SAME token by the SAME winner
    const claimPromises = Array.from({ length: 10 }, () => {
      return bot.simulateCommand('claim', {
        chat: { id: winnerId, type: 'private' },
        from: { id: winnerId, username: 'winner_concurrent' },
        message: { text: `/claim ${code}` },
        match: code
      });
    });

    const results = await Promise.all(claimPromises);

    let successDeliveries = 0;
    let alreadyClaimedReplies = 0;

    for (const ctx of results) {
      const reply = ctx.getLastReply();
      if (reply && reply.includes('DATOS DE ACCESO')) {
        successDeliveries++;
      } else if (reply && (reply.includes('CÓDIGO YA CANJEADO') || reply.includes('ya fue canjeado') || reply.includes('ALREADY_CLAIMED'))) {
        alreadyClaimedReplies++;
      }
    }

    console.log(`[DIMENSION 5 RESULT] 10 concurrent claims: Successes = ${successDeliveries}, Rejections = ${alreadyClaimedReplies}`);

    // Exactly 1 must succeed; the remaining 9 must be rejected as already claimed
    assert.strictEqual(successDeliveries, 1, 'Only exactly 1 claim execution can release credentials');
    assert.strictEqual(alreadyClaimedReplies, 9, 'All 9 duplicate concurrent attempts must be rejected as ALREADY_CLAIMED');
  });
});
