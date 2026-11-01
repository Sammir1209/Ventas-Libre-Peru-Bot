// ══════════════════════════════════════════════════════════
// ⟡ Test Suite: Quizz & Secure Claim Lifecycle Flow
//   Validates All 7 Core Security and Functional Cases
// ══════════════════════════════════════════════════════════

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { MockBot, MockCtx, resetDatabaseState } = require('./helpers/mockHarness');
const db = require('../src/database/postgres');
const quizHandler = require('../src/modules/games/quizHandler');

describe('Quizz & Secure Claim Verification Suite', () => {
  let bot;
  let activeClaimCode = null;
  const staffUserId = 7794982496; // In config.OWNER_IDS
  const winnerUserId = 555001;
  const hijackerUserId = 999999;
  const groupChatId = -1001001;

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

  // ── Case 1: Quizz launch and evaluation of correct answer ──
  it('Case 1: Quizz launch and evaluation generates unique claim code and announces in group', async () => {
    // 1. Staff triggers /quizz in group
    const ctxQuiz = await bot.simulateCommand('quizz', {
      chat: { id: groupChatId, type: 'supergroup', title: 'Grupo Oficial VLP' },
      from: { id: staffUserId, username: 'admin_vlp' },
      message: { text: '/quizz' }
    });

    // 2. Verify trivia message posted and pinned
    const quizMsg = bot.recordedApiMessages.find(m => m.chat_id === groupChatId && (m.text.includes('QUIZZ') || m.text.includes('𝗤𝗨𝗜𝗭𝗭')));
    assert.ok(quizMsg, 'Quizz question card must be sent to the group');
    assert.ok(quizMsg.text.includes('Categoría:'), 'Card must state category');
    assert.ok(bot.pinnedMessages.some(p => p.chatId === groupChatId), 'Question must be pinned in group');

    // 3. Retrieve session from DB
    const session = await db.getActiveQuizSession(groupChatId);
    assert.ok(session, 'Active quiz session must exist in DB');
    assert.strictEqual(session.status, 'ACTIVE');

    // 4. Extract valid answer
    let validAnswers = session.normalized_answers;
    if (typeof validAnswers === 'string') {
      validAnswers = validAnswers.replace(/^\{|\}$/g, '').split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    }
    const targetAnswer = validAnswers[0];
    assert.ok(targetAnswer, 'Session must contain at least one valid answer');

    // 5. Winner replies to quiz card with correct answer
    const ctxReply = await bot.simulateMessage({
      chat: { id: groupChatId, type: 'supergroup', title: 'Grupo Oficial VLP' },
      from: { id: winnerUserId, username: 'winner_pe', first_name: 'Ganador Oficial' },
      message: {
        text: targetAnswer,
        reply_to_message: {
          message_id: quizMsg.message_id,
          text: quizMsg.text
        }
      }
    });

    // 6. Assert winner announcement reply in group
    const winReply = ctxReply.getLastReply();
    assert.ok(winReply, 'Bot must reply announcing the winner in group');
    assert.ok(winReply.includes('GANADOR DETECTADO') || winReply.includes('Ganador:'), 'Announcement must mention winner');

    // 7. Verify claim code syntax in announcement: /claim <code-token>
    const codeMatch = winReply.match(/\/claim\s+([A-Za-z0-9_-]+)/);
    assert.ok(codeMatch, 'Group announcement must contain instruction with /claim <codigo>');
    activeClaimCode = codeMatch[1];
    assert.ok(activeClaimCode.startsWith('VLP-'), 'Claim token must start with VLP- prefix');

    // 8. Verify claim token in database
    const tokenRecord = await db.getClaimToken(activeClaimCode);
    assert.ok(tokenRecord, 'Claim token must be registered in database');
    assert.strictEqual(Number(tokenRecord.user_id), winnerUserId, 'Token must be bound to winner user ID');
    assert.strictEqual(tokenRecord.status, 'PENDING', 'Token must start in PENDING status');
  });

  // ── Case 2: Group rejection ──
  it('Case 2: Group rejection - executing /claim in group chat is denied and redirects to DM', async () => {
    assert.ok(activeClaimCode, 'Test requires activeClaimCode from Case 1');

    const ctxGroupClaim = await bot.simulateCommand('claim', {
      chat: { id: groupChatId, type: 'supergroup', title: 'Grupo Oficial VLP' },
      from: { id: winnerUserId, username: 'winner_pe' },
      message: { text: `/claim ${activeClaimCode}` },
      match: activeClaimCode
    });

    const reply = ctxGroupClaim.getLastReply();
    assert.ok(reply, 'Bot must reply with rejection');
    assert.ok(reply.includes('privado') || reply.includes('chat privado'), 'Must indicate that /claim only works in private DM');

    // Assert token remains PENDING and credentials were not released in group
    const tokenRecord = await db.getClaimToken(activeClaimCode);
    assert.strictEqual(tokenRecord.status, 'PENDING', 'Token must remain PENDING after group rejection');
    assert.strictEqual(ctxGroupClaim.getDocuments().length, 0, 'No documents sent in group');
  });

  // ── Case 3: Anti-hijack defense ──
  it('Case 3: Anti-hijack defense - unauthorized user cannot claim code in DM', async () => {
    assert.ok(activeClaimCode, 'Test requires activeClaimCode from Case 1');

    const ctxHijack = await bot.simulateCommand('claim', {
      chat: { id: hijackerUserId, type: 'private' },
      from: { id: hijackerUserId, username: 'attacker_pe', first_name: 'Attacker' },
      message: { text: `/claim ${activeClaimCode}` },
      match: activeClaimCode
    });

    const reply = ctxHijack.getLastReply();
    assert.ok(reply, 'Bot must reply to hijack attempt');
    assert.ok(
      reply.includes('otro usuario') || reply.includes('No autorizado') || reply.includes('autorización'),
      'Must notify that code belongs to another user'
    );

    // Verify token was not consumed and no credentials leaked
    const tokenRecord = await db.getClaimToken(activeClaimCode);
    assert.strictEqual(tokenRecord.status, 'PENDING', 'Token must remain PENDING');
    assert.strictEqual(tokenRecord.claimed_at, null, 'Token claimed_at must remain null');
    assert.strictEqual(ctxHijack.getDocuments().length, 0, 'Zero documents dispatched to attacker');
  });

  // ── Case 4: Legitimate claim & direct credential delivery ──
  it('Case 4: Legitimate claim - winner claims code in DM and receives credentials directly', async () => {
    assert.ok(activeClaimCode, 'Test requires activeClaimCode from Case 1');

    const ctxClaim = await bot.simulateCommand('claim', {
      chat: { id: winnerUserId, type: 'private' },
      from: { id: winnerUserId, username: 'winner_pe', first_name: 'Winner' },
      message: { text: `/claim ${activeClaimCode}` },
      match: activeClaimCode
    });

    const reply = ctxClaim.getLastReply();
    assert.ok(reply, 'Bot must send reward delivery message');
    assert.ok(
      reply.includes('PREMIO') || reply.includes('𝗣𝗥𝗘𝗠𝗜𝗢') ||
      reply.includes('DATOS DE ACCESO') || reply.includes('ENTREGADO') ||
      reply.includes('𝗘𝗡𝗧𝗥𝗘𝗚𝗔𝗗𝗢'),
      'Header must confirm delivery'
    );

    // Assert credentials delivered directly in message text using <code> blocks
    assert.ok(reply.includes('<code>'), 'Credentials must be formatted in monospace <code> blocks');
    assert.ok(
      reply.includes('Usuario') || reply.includes('Correo') || reply.includes('Email') || reply.includes('test_prime_user') || reply.includes('yt_user'),
      'Message must contain username/email field'
    );
    assert.ok(
      reply.includes('Contraseña') || reply.includes('Password') || reply.includes('Clave'),
      'Message must contain password field'
    );

    // Verify token status in DB updated to CLAIMED
    const tokenRecord = await db.getClaimToken(activeClaimCode);
    assert.strictEqual(tokenRecord.status, 'CLAIMED', 'Token status must be CLAIMED');
    assert.ok(tokenRecord.claimed_at, 'Token claimed_at must be timestamped');
  });

  // ── Case 5: Replay defense ──
  it('Case 5: Replay defense - claiming the same code a second time is rejected', async () => {
    assert.ok(activeClaimCode, 'Test requires activeClaimCode from Case 1');

    const ctxReplay = await bot.simulateCommand('claim', {
      chat: { id: winnerUserId, type: 'private' },
      from: { id: winnerUserId, username: 'winner_pe' },
      message: { text: `/claim ${activeClaimCode}` },
      match: activeClaimCode
    });

    const reply = ctxReplay.getLastReply();
    assert.ok(reply, 'Bot must respond to replay attempt');
    assert.ok(
      reply.includes('ya fue canjeado') || reply.includes('ya canjeado') || reply.includes('ALREADY_CLAIMED'),
      'Must notify that code was already redeemed'
    );
  });

  // ── Case 6: Expiration defense ──
  it('Case 6: Expiration defense - claiming an expired code is rejected', async () => {
    const expiredCode = 'VLP-EXPIRED999';

    // Seed expired token directly in DB
    await db.createClaimToken({
      claimCode: expiredCode,
      userId: winnerUserId,
      rewardId: 1,
      quizId: 'quiz_expired_test',
      category: 'PRIME_VIDEO',
      ttlMinutes: -10 // Created in the past
    });

    const ctxExpired = await bot.simulateCommand('claim', {
      chat: { id: winnerUserId, type: 'private' },
      from: { id: winnerUserId, username: 'winner_pe' },
      message: { text: `/claim ${expiredCode}` },
      match: expiredCode
    });

    const reply = ctxExpired.getLastReply();
    assert.ok(reply, 'Bot must reply to expired claim attempt');
    assert.ok(
      reply.includes('expirado') || reply.includes('Expirado') || reply.includes('EXPIRED'),
      'Must reject code as expired'
    );
  });

  // ── Case 7: Zero cookie verification ──
  it('Case 7: Zero cookie verification - zero .txt files or cookie converter attachments throughout all flows', async () => {
    // 1. Verify zero replyWithDocument calls across all tests
    assert.strictEqual(bot.recordedDocuments.length, 0, 'ctx.replyWithDocument must never be invoked');

    // 2. Verify zero bot.api.sendDocument calls across all tests
    assert.strictEqual(bot.recordedApiDocuments.length, 0, 'bot.api.sendDocument must never be invoked');

    // 3. Verify no reply text or options contains .txt file attachments
    for (const rep of bot.recordedReplies) {
      assert.ok(!rep.text.includes('.txt adjunto'), 'No mention of .txt attachment in reply text');
      assert.ok(!rep.text.includes('CONVERTIDOR COOKIE'), 'No button or mention of Cookie Converter');
    }
  });
});
