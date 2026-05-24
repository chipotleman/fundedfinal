#!/usr/bin/env node
/**
 * Runtime tests for `pages/api/social/share.js` (task #624).
 *
 * Background:
 *   The Share API lets a user push a battle / post / result preview
 *   bubble into a friend's DM inbox. It has several non-trivial
 *   validation hops (friend-only gating, recipient cap, snapshot
 *   sanitization, JSON content shape) plus side effects (Drizzle
 *   insert into `messages`, SSE fan-out via `publishBattleEvent`,
 *   web-push fan-out via `sendPushToUsers`). None of that was covered
 *   by automated tests, so a future refactor could silently break
 *   delivery or quietly let oversized snapshots leak into other
 *   users' inboxes.
 *
 * How this test works:
 *   The handler is authored as an ES module that imports next-auth,
 *   Drizzle, the local schema, the DB client, and a couple of
 *   server-only helpers. Loading any of those for real would pull in
 *   network + database dependencies we don't want in a unit test.
 *   We instead:
 *     1. Read `pages/api/social/share.js` from disk.
 *     2. Transform it to CJS with esbuild.
 *     3. Evaluate it under `vm` with a custom `require` shim that
 *        returns in-memory stubs for every module it imports.
 *   The stubs let us:
 *     - control the session (`getServerSession`),
 *     - drive both the friend-lookup `select(...).from(...).where(...)`
 *       chain and the `insert(...).values(...).returning()` chain on
 *       the DB,
 *     - capture every `publishBattleEvent` and `sendPushToUsers`
 *       invocation so we can assert SSE + push fan-out.
 *   The handler is then invoked with a minimal Next-style req/res
 *   pair and we assert on `res.statusCode`, the captured JSON body,
 *   the rows the handler tried to insert, and the events it emitted.
 *
 * How to run:
 *   node tests/social-share-api.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const esbuild = require('esbuild');

let failures = 0;
let assertions = 0;
function assert(cond, msg) {
  assertions += 1;
  if (!cond) {
    failures += 1;
    console.error(`  ✗ ${msg}`);
  } else {
    console.log(`  ✓ ${msg}`);
  }
}

// ---------------------------------------------------------------------------
// Handler loader. The module is transformed once and the source string is
// cached; each test gets a *fresh* evaluation so module-level state inside
// the handler can't leak across tests.
// ---------------------------------------------------------------------------
let cachedCode = null;
function loadHandlerCode() {
  if (cachedCode) return cachedCode;
  const src = fs.readFileSync(
    path.resolve(__dirname, '..', 'pages', 'api', 'social', 'share.js'),
    'utf8',
  );
  const { code } = esbuild.transformSync(src, {
    loader: 'js',
    format: 'cjs',
    target: 'node18',
  });
  cachedCode = code;
  return cachedCode;
}

// Build a chainable, awaitable thenable that resolves to `value`. Used to
// emulate Drizzle's builder chains: `db.select(...).from(...).where(...)`
// is awaited like a Promise once `where()` is called.
function thenable(value, methods = []) {
  const obj = {
    then(resolve, reject) {
      try { resolve(value); } catch (e) { reject(e); }
    },
  };
  for (const m of methods) {
    obj[m] = () => thenable(value, methods);
  }
  return obj;
}

function loadHandlerWithMocks({ session, friendRows, insertResult, insertImpl }) {
  const code = loadHandlerCode();
  const calls = {
    publishBattleEvent: [],
    sendPushToUsers: [],
    insertedRows: null,
    selectWhereCalled: 0,
  };

  // Drizzle helpers are only used to *construct* opaque predicates that
  // are then passed into the db builder. Returning sentinel objects is
  // enough — the mocked db never inspects them.
  const drizzle = {
    and: (...a) => ({ _and: a }),
    eq: (...a) => ({ _eq: a }),
    or: (...a) => ({ _or: a }),
    inArray: (...a) => ({ _inArray: a }),
  };

  const db = {
    select() {
      return {
        from() {
          return {
            where() {
              calls.selectWhereCalled += 1;
              return Promise.resolve(friendRows);
            },
          };
        },
      };
    },
    insert(table) {
      return {
        values(rows) {
          calls.insertedRows = rows;
          return {
            returning: () => {
              if (insertImpl) return insertImpl(rows);
              if (typeof insertResult === 'function') return Promise.resolve(insertResult(rows));
              // Default: echo the rows back with synthetic id + createdAt.
              return Promise.resolve(
                rows.map((r, i) => ({
                  ...r,
                  id: `msg-${i + 1}`,
                  createdAt: new Date('2026-05-24T00:00:00.000Z'),
                })),
              );
            },
          };
        },
      };
    },
  };

  const moduleStubs = {
    'next-auth/next': { getServerSession: async () => session },
    'drizzle-orm': drizzle,
    '../../../lib/auth': { authOptions: {} },
    '../../../lib/db': { db, messages: {}, friendships: {} },
    '../../../shared/schema': { messages: { _t: 'messages' }, friendships: { _t: 'friendships' } },
    '../../../lib/battle-events': {
      publishBattleEvent: (ids, evt) => { calls.publishBattleEvent.push({ ids, evt }); },
    },
    '../../../lib/web-push': {
      sendPushToUsers: (ids, payload) => {
        calls.sendPushToUsers.push({ ids, payload });
        return Promise.resolve();
      },
    },
  };

  const fakeRequire = (mod) => {
    if (Object.prototype.hasOwnProperty.call(moduleStubs, mod)) {
      return moduleStubs[mod];
    }
    return require(mod);
  };

  const moduleObj = { exports: {} };
  const ctx = {
    module: moduleObj,
    exports: moduleObj.exports,
    require: fakeRequire,
    console,
    process,
    Buffer,
    setTimeout,
    clearTimeout,
    setImmediate,
    clearImmediate,
    Promise,
    URL,
    URLSearchParams,
    // Share the outer realm's Date so `instanceof Date` checks inside
    // the handler match the Date objects our mock inserts.
    Date,
    JSON,
    Object,
    Array,
    Number,
    String,
    Set,
    Map,
    Error,
  };
  vm.createContext(ctx);
  const script = new vm.Script(code, { filename: 'share.cjs.js' });
  script.runInContext(ctx);
  // Module written as `export default async function handler` — esbuild
  // exposes it on `exports.default`.
  return { handler: moduleObj.exports.default || moduleObj.exports, calls };
}

// Minimal req/res mocks. `setHeader` is recorded but otherwise no-op.
function makeReq({ method = 'POST', body = {} } = {}) {
  return { method, body, headers: {} };
}
function makeRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    end() { return this; },
  };
  return res;
}

// Standard session helper: pretend we're user "u-self".
const SELF_SESSION = { user: { id: 'u-self' } };

// Helper — a friendship row as Drizzle returns it from the friend-check
// query: either `{userId: self, friendId: other}` or vice versa.
function friendRow(other, selfIsUser = true) {
  return selfIsUser
    ? { userId: 'u-self', friendId: other }
    : { userId: other, friendId: 'u-self' };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testMethodGuard() {
  console.log('test: rejects non-POST methods with 405');
  const { handler } = loadHandlerWithMocks({ session: SELF_SESSION, friendRows: [] });
  const res = makeRes();
  await handler(makeReq({ method: 'GET' }), res);
  assert(res.statusCode === 405, '405 on GET');
  assert(res.headers.allow === 'POST', 'Allow header set to POST');
}

async function testUnauthorized() {
  console.log('test: 401 when no session');
  const { handler } = loadHandlerWithMocks({ session: null, friendRows: [] });
  const res = makeRes();
  await handler(makeReq({ body: { recipientIds: ['u-friend'], item: { type: 'post', id: 'p1' } } }), res);
  assert(res.statusCode === 401, '401 when session.user.id missing');
}

async function testValidationErrors() {
  console.log('test: payload validation 400s');
  const baseItem = { type: 'battle', id: 'b1' };

  // missing recipientIds
  {
    const { handler } = loadHandlerWithMocks({ session: SELF_SESSION, friendRows: [] });
    const res = makeRes();
    await handler(makeReq({ body: { item: baseItem } }), res);
    assert(res.statusCode === 400 && /recipientIds required/.test(res.body.error || ''), 'missing recipientIds → 400');
  }
  // empty recipientIds
  {
    const { handler } = loadHandlerWithMocks({ session: SELF_SESSION, friendRows: [] });
    const res = makeRes();
    await handler(makeReq({ body: { recipientIds: [], item: baseItem } }), res);
    assert(res.statusCode === 400, 'empty recipientIds → 400');
  }
  // recipientIds too long
  {
    const { handler } = loadHandlerWithMocks({ session: SELF_SESSION, friendRows: [] });
    const tooMany = Array.from({ length: 21 }, (_, i) => `u${i}`);
    const res = makeRes();
    await handler(makeReq({ body: { recipientIds: tooMany, item: baseItem } }), res);
    assert(res.statusCode === 400 && /Up to 20 recipients/.test(res.body.error || ''),
      'recipientIds > 20 → 400 with cap message');
  }
  // missing item
  {
    const { handler } = loadHandlerWithMocks({ session: SELF_SESSION, friendRows: [] });
    const res = makeRes();
    await handler(makeReq({ body: { recipientIds: ['u-friend'] } }), res);
    assert(res.statusCode === 400 && /item required/.test(res.body.error || ''), 'missing item → 400');
  }
  // unsupported type
  {
    const { handler } = loadHandlerWithMocks({ session: SELF_SESSION, friendRows: [] });
    const res = makeRes();
    await handler(makeReq({ body: { recipientIds: ['u-friend'], item: { type: 'video', id: 'v1' } } }), res);
    assert(res.statusCode === 400 && /Unsupported share type/.test(res.body.error || ''), 'bad type → 400');
  }
  // missing item.id
  {
    const { handler } = loadHandlerWithMocks({ session: SELF_SESSION, friendRows: [] });
    const res = makeRes();
    await handler(makeReq({ body: { recipientIds: ['u-friend'], item: { type: 'battle' } } }), res);
    assert(res.statusCode === 400 && /item\.id required/.test(res.body.error || ''), 'missing item.id → 400');
  }
}

async function testSelfShareFiltered() {
  console.log('test: self is filtered out of recipient list');
  const { handler, calls } = loadHandlerWithMocks({
    session: SELF_SESSION,
    friendRows: [],
  });
  const res = makeRes();
  await handler(makeReq({
    body: { recipientIds: ['u-self'], item: { type: 'post', id: 'p1' } },
  }), res);
  assert(res.statusCode === 400 && /No valid recipients/.test(res.body.error || ''),
    'self-only recipient list → 400 No valid recipients');
  assert(calls.selectWhereCalled === 0, 'friend lookup not executed (no recipients survived dedup)');
}

async function testFriendOnlyEnforcement() {
  console.log('test: 403 when no recipient is an accepted friend');
  const { handler, calls } = loadHandlerWithMocks({
    session: SELF_SESSION,
    friendRows: [], // nobody is a friend
  });
  const res = makeRes();
  await handler(makeReq({
    body: { recipientIds: ['u-stranger'], item: { type: 'post', id: 'p1' } },
  }), res);
  assert(res.statusCode === 403 && /only share with friends/.test(res.body.error || ''),
    '403 with friend-only error message');
  assert(calls.insertedRows == null, 'no insert was attempted');
  assert(calls.publishBattleEvent.length === 0, 'no SSE event published');
  assert(calls.sendPushToUsers.length === 0, 'no push fan-out');
}

async function testFriendFilterMixedRecipients() {
  console.log('test: mixed friend + stranger — only friends receive, skipped counted');
  const { handler, calls } = loadHandlerWithMocks({
    session: SELF_SESSION,
    friendRows: [
      friendRow('u-friend-a', true),
      // u-friend-b appears with the reversed orientation (friend initiated request)
      friendRow('u-friend-b', false),
    ],
  });
  const res = makeRes();
  await handler(makeReq({
    body: {
      recipientIds: ['u-friend-a', 'u-friend-b', 'u-stranger', 'u-friend-a' /* dup */],
      item: { type: 'post', id: 'p42', snapshot: { body: 'hello', author: { username: 'me' } } },
    },
  }), res);
  assert(res.statusCode === 201, '201 on success');
  assert(res.body.sent === 2, 'sent=2 (two friends)');
  assert(res.body.skipped === 1, 'skipped=1 (stranger; duplicate friend was deduped before filtering)');
  assert(calls.insertedRows.length === 2, 'two message rows inserted');
  const recipients = calls.insertedRows.map((r) => r.receiverId).sort();
  assert(JSON.stringify(recipients) === JSON.stringify(['u-friend-a', 'u-friend-b']),
    'inserted rows target both friend recipients');
}

async function testSharedBattleMessageType() {
  console.log('test: shared_battle — messageType + payload + sanitized snapshot');
  const oversizedUsername = 'x'.repeat(500);
  const oversizedAvatar = 'https://cdn.example.com/' + 'a'.repeat(2000);
  const oversizedDuration = 'd'.repeat(100);
  const { handler, calls } = loadHandlerWithMocks({
    session: SELF_SESSION,
    friendRows: [friendRow('u-friend-a', true)],
  });
  const res = makeRes();
  await handler(makeReq({
    body: {
      recipientIds: ['u-friend-a'],
      note: ' hello there ' + 'n'.repeat(400),
      item: {
        type: 'battle',
        id: 'matchup-1',
        snapshot: {
          potSize: '12345',
          durationType: oversizedDuration,
          user1: { username: oversizedUsername, avatar: oversizedAvatar, secret: 'leak' },
          user2: { username: 'opp', avatar: 'https://cdn.example.com/opp.png' },
          maliciousExtraField: { huge: 'a'.repeat(10000) },
        },
      },
    },
  }), res);
  assert(res.statusCode === 201, '201 on success');
  assert(calls.insertedRows.length === 1, 'exactly one insert row');
  const row = calls.insertedRows[0];
  assert(row.messageType === 'shared_battle', 'messageType is shared_battle');
  assert(row.senderId === 'u-self', 'senderId is current user');
  assert(row.receiverId === 'u-friend-a', 'receiverId is the friend');
  const payload = JSON.parse(row.content);
  assert(payload.v === 1, 'payload version stamp = 1');
  assert(payload.type === 'battle', 'payload type = battle');
  assert(payload.id === 'matchup-1', 'payload id preserved');
  // Note clipped to NOTE_MAX=280
  assert(payload.note.length === 280, `note clipped to 280 chars (got ${payload.note.length})`);
  // Snapshot sanitization
  const snap = payload.snapshot;
  assert(typeof snap === 'object' && snap, 'snapshot is an object');
  assert(snap.potSize === 12345, 'potSize coerced to number');
  assert(snap.durationType.length === 24, `durationType clamped to 24 chars (got ${snap.durationType.length})`);
  assert(snap.user1.username.length === 32, 'user1.username clamped to 32 chars');
  assert(snap.user1.avatar.length === 500, 'user1.avatar clamped to 500 chars');
  assert(!Object.prototype.hasOwnProperty.call(snap.user1, 'secret'),
    'extra fields on user1 stripped');
  assert(!Object.prototype.hasOwnProperty.call(snap, 'maliciousExtraField'),
    'extra top-level snapshot fields stripped');
  assert(snap.user2.username === 'opp', 'short user2.username preserved');
}

async function testSharedPostMessageType() {
  console.log('test: shared_post — messageType + sanitized snapshot');
  const longBody = 'b'.repeat(1000);
  const { handler, calls } = loadHandlerWithMocks({
    session: SELF_SESSION,
    friendRows: [friendRow('u-friend-a', true)],
  });
  const res = makeRes();
  await handler(makeReq({
    body: {
      recipientIds: ['u-friend-a'],
      item: {
        type: 'post',
        id: 'post-9',
        snapshot: { body: longBody, author: { username: 'me', avatar: 'x', evil: 1 } },
      },
    },
  }), res);
  assert(res.statusCode === 201, '201 on success');
  const row = calls.insertedRows[0];
  assert(row.messageType === 'shared_post', 'messageType is shared_post');
  const snap = JSON.parse(row.content).snapshot;
  assert(snap.body.length === 200, 'post body clamped to 200 chars');
  assert(snap.author.username === 'me', 'author.username preserved');
  assert(!Object.prototype.hasOwnProperty.call(snap.author, 'evil'),
    'extra author fields stripped');
}

async function testSharedResultMessageType() {
  console.log('test: shared_result — messageType is shared_result, snapshot sanitized');
  const { handler, calls } = loadHandlerWithMocks({
    session: SELF_SESSION,
    friendRows: [friendRow('u-friend-a', true)],
  });
  const res = makeRes();
  await handler(makeReq({
    body: {
      recipientIds: ['u-friend-a'],
      item: {
        type: 'result',
        id: 'matchup-2',
        snapshot: {
          potSize: 7777,
          winner: { username: 'w'.repeat(200), avatar: 'a' },
          loser: { username: 'L', avatar: 'b' },
        },
      },
    },
  }), res);
  assert(res.statusCode === 201, '201');
  const row = calls.insertedRows[0];
  assert(row.messageType === 'shared_result', 'messageType is shared_result');
  const payload = JSON.parse(row.content);
  assert(payload.type === 'result', 'payload type=result');
  assert(payload.snapshot.potSize === 7777, 'potSize preserved');
  assert(payload.snapshot.winner.username.length === 32, 'winner.username clamped to 32 chars');
  assert(payload.snapshot.loser.username === 'L', 'loser.username preserved');
}

async function testSseAndPushFanOut() {
  console.log('test: SSE notification:message + push fan-out on success');
  const { handler, calls } = loadHandlerWithMocks({
    session: SELF_SESSION,
    friendRows: [
      friendRow('u-friend-a', true),
      friendRow('u-friend-b', true),
    ],
  });
  const res = makeRes();
  await handler(makeReq({
    body: {
      recipientIds: ['u-friend-a', 'u-friend-b'],
      item: {
        type: 'battle',
        id: 'matchup-z',
        snapshot: { potSize: 10, user1: { username: 'a' }, user2: { username: 'b' } },
      },
    },
  }), res);

  assert(res.statusCode === 201, '201');
  assert(calls.publishBattleEvent.length === 2, 'one SSE event per recipient');
  for (const { ids, evt } of calls.publishBattleEvent) {
    assert(Array.isArray(ids) && ids.includes('u-self'),
      'SSE channel ids include the sender (so their other tabs sync)');
    assert(evt.type === 'notification:message', 'event type is notification:message');
    assert(evt.message && evt.message.messageType === 'shared_battle',
      'event carries messageType=shared_battle');
    assert(evt.message.senderId === 'u-self', 'event message.senderId=self');
    assert(typeof evt.message.createdAt === 'string',
      'createdAt is serialized as a string for SSE');
  }

  assert(calls.sendPushToUsers.length === 1, 'sendPushToUsers called once');
  const pushCall = calls.sendPushToUsers[0];
  const pushedIds = pushCall.ids.slice().sort();
  assert(JSON.stringify(pushedIds) === JSON.stringify(['u-friend-a', 'u-friend-b']),
    'push fan-out targets the valid friend recipients');
  assert(pushCall.payload.category === 'social', 'push category=social');
  assert(/battle was shared/.test(pushCall.payload.title), 'push title mentions battle');
  assert(pushCall.payload.url === '/messenger', 'push deep-links to /messenger');
}

async function testInsertFailureBubblesAs500() {
  console.log('test: db insert failure → 500');
  const { handler, calls } = loadHandlerWithMocks({
    session: SELF_SESSION,
    friendRows: [friendRow('u-friend-a', true)],
    insertImpl: () => Promise.reject(new Error('db blew up')),
  });
  // Silence the error log the handler emits on the failure path; we
  // still want to assert behavior, not pollute the test output.
  const origError = console.error;
  console.error = () => {};
  try {
    const res = makeRes();
    await handler(makeReq({
      body: {
        recipientIds: ['u-friend-a'],
        item: { type: 'post', id: 'p1', snapshot: { body: 'hi' } },
      },
    }), res);
    assert(res.statusCode === 500 && /Failed to share/.test(res.body.error || ''),
      '500 + "Failed to share" on db failure');
    assert(calls.publishBattleEvent.length === 0, 'no SSE event on failure');
  } finally {
    console.error = origError;
  }
}

async function main() {
  console.log('[social/share API] runtime tests');
  console.log('');
  await testMethodGuard(); console.log('');
  await testUnauthorized(); console.log('');
  await testValidationErrors(); console.log('');
  await testSelfShareFiltered(); console.log('');
  await testFriendOnlyEnforcement(); console.log('');
  await testFriendFilterMixedRecipients(); console.log('');
  await testSharedBattleMessageType(); console.log('');
  await testSharedPostMessageType(); console.log('');
  await testSharedResultMessageType(); console.log('');
  await testSseAndPushFanOut(); console.log('');
  await testInsertFailureBubblesAs500(); console.log('');

  if (failures > 0) {
    console.error(`[social/share API] FAIL — ${failures}/${assertions} assertion(s) failed`);
    process.exit(1);
  }
  console.log(`[social/share API] OK — ${assertions} assertion(s) passed`);
  process.exit(0);
}

main().catch((err) => {
  console.error('[social/share API] FATAL', err);
  process.exit(1);
});
