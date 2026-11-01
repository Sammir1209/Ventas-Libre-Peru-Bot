// ══════════════════════════════════════════════════════════
// ⟡ Adversarial Stress Harness: Concurrency, Fuzzing & Boundaries
//   Empirical Challenger Test Suite for Quizz & /claim
// ══════════════════════════════════════════════════════════

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { MockBot, resetDatabaseState } = require('./helpers/mockHarness');
const db = require('../src/database/postgres');
const quizHandler = require('../src/modules/games/quizHandler');

describe('Adversarial Stress & Empirical Fuzzing Suite', () => {
  let bot;
  const staffUserId = 7794982496;
  const legitWinnerId = 888100;
  const attackerId = 999200;
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

  // ══════════════════════════════════════════════════════════
  // 1. CONCURRENCY & RACE CONDITIONS
  // ══════════════════════════════════════════════════════════

  it('1.1 Concurrency DB: 50 concurrent claims on the same token -> EXACTLY 1 success, 49 ALREADY_CLAIMED', async () => {
    const token = await db.createClaimToken({
      userId: legitWinnerId,
      rewardId: 1,
      category: 'STREAMING',
      ttlMinutes: 15
    });
    const code = token.claimCode;

    // Dispatch 50 simultaneous redemptions
    const promises = Array.from({ length: 50 }, () =>
      db.redeemClaimAtomic(code, legitWinnerId)
    );

    const results = await Promise.all(promises);

    const successes = results.filter(r => r.success === true);
    const alreadyClaimed = results.filter(r => r.success === false && r.reason === 'ALREADY_CLAIMED');
    const unexpected = results.filter(r => !r.success && r.reason !== 'ALREADY_CLAIMED');

    assert.strictEqual(unexpected.length, 0, `No unexpected errors allowed: ${JSON.stringify(unexpected)}`);
    assert.strictEqual(successes.length, 1, 'EXACTLY ONE request must succeed (zero double-spending)');
    assert.strictEqual(alreadyClaimed.length, 49, 'EXACTLY 49 requests must be rejected with ALREADY_CLAIMED');

    // Verify DB state is CLAIMED
    const finalToken = await db.getClaimToken(code);
    assert.strictEqual(finalToken.status, 'CLAIMED');
  });

  it('1.2 Concurrency Bot: 50 concurrent /claim commands -> EXACTLY 1 credential delivery, 49 rejection notices', async () => {
    const token = await db.createClaimToken({
      userId: legitWinnerId,
      rewardId: 2,
      category: 'STREAMING',
      ttlMinutes: 15
    });
    const code = token.claimCode;

    // Dispatch 50 concurrent bot /claim commands
    const promises = Array.from({ length: 50 }, () =>
      bot.simulateCommand('claim', {
        chat: { id: legitWinnerId, type: 'private' },
        from: { id: legitWinnerId, username: 'legit_winner', first_name: 'Winner' },
        message: { text: `/claim ${code}` },
        match: code
      })
    );

    const contexts = await Promise.all(promises);

    let deliveryCount = 0;
    let alreadyClaimedCount = 0;
    let otherCount = 0;

    for (const ctx of contexts) {
      const reply = ctx.getLastReply() || '';
      if (reply.includes('PREMIO') || reply.includes('DATOS DE ACCESO') || reply.includes('ENTREGADO')) {
        deliveryCount++;
        // Verify credentials formatting in delivery
        assert.ok(reply.includes('<code>'), 'Delivery must contain <code> credentials');
      } else if (reply.includes('ya fue canjeado') || reply.includes('ya canjeado')) {
        alreadyClaimedCount++;
      } else {
        otherCount++;
      }
    }

    assert.strictEqual(deliveryCount, 1, 'EXACTLY ONE delivery message must be dispatched to user');
    assert.strictEqual(alreadyClaimedCount, 49, 'EXACTLY 49 responses must state code was already redeemed');
    assert.strictEqual(otherCount, 0, 'Zero unexpected response types allowed');
  });

  it('1.3 Multi-Token Race Condition: 5 distinct tokens with 10 concurrent requests each (50 total promises)', async () => {
    const tokenCount = 5;
    const concurrencyPerToken = 10;
    const tokenCodes = [];

    for (let i = 0; i < tokenCount; i++) {
      const t = await db.createClaimToken({
        userId: legitWinnerId + i,
        rewardId: 1,
        ttlMinutes: 15
      });
      tokenCodes.push({ code: t.claimCode, userId: legitWinnerId + i });
    }

    // Launch 50 promises simultaneously
    const allPromises = [];
    for (const { code, userId } of tokenCodes) {
      for (let j = 0; j < concurrencyPerToken; j++) {
        allPromises.push(db.redeemClaimAtomic(code, userId));
      }
    }

    const results = await Promise.all(allPromises);

    const totalSuccesses = results.filter(r => r.success === true);
    const totalAlreadyClaimed = results.filter(r => r.reason === 'ALREADY_CLAIMED');

    assert.strictEqual(totalSuccesses.length, tokenCount, `Must have exactly ${tokenCount} successes (1 per token)`);
    assert.strictEqual(totalAlreadyClaimed.length, tokenCount * (concurrencyPerToken - 1), 'All concurrent duplicate requests must be rejected');
  });

  // ══════════════════════════════════════════════════════════
  // 2. FUZZING & INPUT SANITIZATION
  // ══════════════════════════════════════════════════════════

  it('2.1 Token Normalization: lowercase and extra surrounding whitespace are accepted and redeemed', async () => {
    const token = await db.createClaimToken({
      userId: legitWinnerId,
      rewardId: 1,
      ttlMinutes: 15
    });
    const code = token.claimCode;

    // Send token with extra spaces and lower-case: e.g. "  vlp-a1b2c3d4e5f6  "
    const messyCode = `  \t ${code.toLowerCase()}  \n `;

    const ctx = await bot.simulateCommand('claim', {
      chat: { id: legitWinnerId, type: 'private' },
      from: { id: legitWinnerId, username: 'legit_winner' },
      message: { text: `/claim ${messyCode}` },
      match: messyCode
    });

    const reply = ctx.getLastReply() || '';
    assert.ok(
      reply.includes('PREMIO') || reply.includes('DATOS DE ACCESO') || reply.includes('ENTREGADO'),
      'Normalized token must successfully redeem reward'
    );

    const tokenRecord = await db.getClaimToken(code);
    assert.strictEqual(tokenRecord.status, 'CLAIMED');
  });

  it('2.2 Empty or whitespace-only /claim command returns syntax instructions gracefully without crashing', async () => {
    const emptyInputs = ['', '   ', '\t\t', '\n\n   '];

    for (const empty of emptyInputs) {
      const ctx = await bot.simulateCommand('claim', {
        chat: { id: legitWinnerId, type: 'private' },
        from: { id: legitWinnerId, username: 'legit_winner' },
        message: { text: `/claim ${empty}` },
        match: empty
      });

      const reply = ctx.getLastReply() || '';
      assert.ok(
        reply.includes('SINTAXIS DE CANJE') || reply.includes('/claim <código>'),
        `Empty input [${JSON.stringify(empty)}] must show syntax guidance`
      );
    }
  });

  it('2.3 SQL Injection strings do not crash, do not bypass auth, and return NOT_FOUND', async () => {
    const sqliPayloads = [
      "' OR '1'='1",
      "'; DROP TABLE pending_claims; --",
      "admin'--",
      "' UNION SELECT * FROM users --",
      "1; SELECT pg_sleep(5);",
      "' OR EXISTS(SELECT * FROM pending_claims) --"
    ];

    for (const payload of sqliPayloads) {
      // 1. Direct DB call
      const res = await db.redeemClaimAtomic(payload, legitWinnerId);
      assert.strictEqual(res.success, false, `SQLi payload [${payload}] must not succeed`);
      assert.strictEqual(res.reason, 'NOT_FOUND', `SQLi payload [${payload}] must return NOT_FOUND`);

      // 2. Bot command simulation
      const ctx = await bot.simulateCommand('claim', {
        chat: { id: legitWinnerId, type: 'private' },
        from: { id: legitWinnerId, username: 'tester' },
        message: { text: `/claim ${payload}` },
        match: payload
      });

      const reply = ctx.getLastReply() || '';
      assert.ok(
        reply.includes('CÓDIGO INVÁLIDO') || reply.includes('inexistente'),
        `SQLi payload [${payload}] must trigger invalid code message`
      );
    }
  });

  it('2.4 XSS / HTML Injection payloads do not crash parser and are escaped safely', async () => {
    const xssPayloads = [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert(1)>',
      '"><svg onload=alert(1)>',
      '<b>bold_attack</b>',
      '${7*7}{{7*7}}'
    ];

    for (const payload of xssPayloads) {
      const res = await db.redeemClaimAtomic(payload, legitWinnerId);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.reason, 'NOT_FOUND');

      const ctx = await bot.simulateCommand('claim', {
        chat: { id: legitWinnerId, type: 'private' },
        from: { id: legitWinnerId, username: 'tester', first_name: '<script>alert(1)</script>' },
        message: { text: `/claim ${payload}` },
        match: payload
      });

      const reply = ctx.getLastReply() || '';
      assert.ok(reply.length > 0, 'Bot must reply safely');
      assert.ok(!reply.includes('<script>'), 'Raw script tags must not appear in output');
    }
  });

  it('2.5 Type fuzzing: null, undefined, numbers, objects and NaN do not throw unhandled exceptions', async () => {
    const invalidTypes = [null, undefined, 12345, {}, [], true, false];

    for (const item of invalidTypes) {
      const res = await db.redeemClaimAtomic(item, legitWinnerId);
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.reason, 'NOT_FOUND');
    }

    // Invalid claimantUserId (NaN, string, null)
    const validToken = await db.createClaimToken({
      userId: legitWinnerId,
      rewardId: 1,
      ttlMinutes: 15
    });

    const badUserIds = ['not_a_number', NaN, null, undefined, {}];
    for (const badId of badUserIds) {
      const res = await db.redeemClaimAtomic(validToken.claimCode, badId);
      assert.strictEqual(res.success, false, `Bad claimant user ID [${badId}] must not succeed`);
      assert.strictEqual(res.reason, 'UNAUTHORIZED');
    }
  });

  it('2.6 Oversized inputs (5,000+ characters) are handled gracefully without ReDoS or buffer errors', async () => {
    const hugePayload = 'VLP-' + 'A'.repeat(5000);

    const tStart = Date.now();
    const res = await db.redeemClaimAtomic(hugePayload, legitWinnerId);
    const duration = Date.now() - tStart;

    assert.strictEqual(res.success, false);
    assert.strictEqual(res.reason, 'NOT_FOUND');
    assert.ok(duration < 200, `Execution with oversized input must finish quickly (< 200ms), took ${duration}ms`);
  });

  // ══════════════════════════════════════════════════════════
  // 3. EXPIRATION BOUNDARY TESTING
  // ══════════════════════════════════════════════════════════

  it('3.1 Standard TTL = 15m is valid immediately upon creation', async () => {
    const token = await db.createClaimToken({
      userId: legitWinnerId,
      rewardId: 1,
      ttlMinutes: 15
    });

    const diffMs = token.expiresAt.getTime() - Date.now();
    assert.ok(diffMs > 14 * 60 * 1000 && diffMs <= 15 * 60 * 1000 + 1000, 'Expiration must be ~15m in future');

    const res = await db.redeemClaimAtomic(token.claimCode, legitWinnerId);
    assert.strictEqual(res.success, true, 'Active token must be redeemable');
  });

  it('3.2 Negative TTL (ttlMinutes < 0) produces an immediately expired token rejected with EXPIRED', async () => {
    const token = await db.createClaimToken({
      userId: legitWinnerId,
      rewardId: 1,
      ttlMinutes: -10
    });

    assert.ok(token.expiresAt.getTime() < Date.now(), 'ExpiresAt must be in the past');

    const res = await db.redeemClaimAtomic(token.claimCode, legitWinnerId);
    assert.strictEqual(res.success, false, 'Expired token must not be redeemable');
    assert.strictEqual(res.reason, 'EXPIRED', 'Reason must be EXPIRED');
  });

  it('3.3 Expiration sweep: expireStaleClaims() transitions expired PENDING tokens to EXPIRED', async () => {
    const staleToken = await db.createClaimToken({
      userId: legitWinnerId,
      rewardId: 1,
      ttlMinutes: -5
    });

    const preSweep = await db.getClaimToken(staleToken.claimCode);
    assert.strictEqual(preSweep.status, 'PENDING');

    const sweptCount = await db.expireStaleClaims();
    assert.ok(sweptCount >= 1, 'At least 1 stale claim must be swept');

    const postSweep = await db.getClaimToken(staleToken.claimCode);
    assert.strictEqual(postSweep.status, 'EXPIRED');
  });

  it('3.4 Boundary TTL = 0 testing: verify expiration accuracy when ttlMinutes is 0', async () => {
    const token = await db.createClaimToken({
      userId: legitWinnerId,
      rewardId: 1,
      ttlMinutes: 0
    });

    // Check if token expiresAt is at or before NOW
    const diffMs = token.expiresAt.getTime() - Date.now();

    // With TTL = 0, a token should expire immediately (diffMs <= 0).
    // If diffMs > 60,000 (e.g. ~15 minutes), (Number(ttlMinutes) || 15) fell back to 15!
    console.log(`[Empirical Probe] TTL = 0 expiresAt: ${token.expiresAt.toISOString()}, diffMs: ${diffMs}`);

    const res = await db.redeemClaimAtomic(token.claimCode, legitWinnerId);
    console.log(`[Empirical Probe] TTL = 0 redeem result:`, res);

    // Document whether it expired or survived
    if (res.success === true) {
      console.warn('⚠️ [DEFECT CONFIRMED] Token created with TTL = 0 did NOT expire; survived with ~15m lease!');
    }

    assert.strictEqual(
      res.success,
      false,
      `BOUNDARY DEFECT: Token created with ttlMinutes: 0 must expire immediately, but survived with ~15m lease and claimed successfully!`
    );
    assert.strictEqual(res.reason, 'EXPIRED', 'Reason must be EXPIRED');
  });
});
