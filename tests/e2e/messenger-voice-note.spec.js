/**
 * End-to-end coverage for the voice-note record + upload pipeline on
 * /messenger.
 *
 * The earlier additions to messenger-click-trap.spec.js cover the
 * scroll-lock watchdog and the `/api/uploads/request-url` failure case
 * from the navbar's perspective, but never actually drive the
 * MediaRecorder pipeline. These specs stub MediaRecorder + getUserMedia
 * so we can:
 *
 *   1. Verify the happy path — start → stop → PUT upload → POST
 *      /api/messages → bubble appears in the thread.
 *   2. Verify the iOS `audio/mp4` fallback ships an `m4a` extension and
 *      a matching `Content-Type` on the PUT.
 *
 * MediaRecorder is environment-agnostic once stubbed, so we run these
 * specs on a single desktop browser to keep the suite fast — the
 * branching being tested lives entirely in `MessagesPanel.js`.
 */
const { test, expect } = require('@playwright/test');

const FAKE_USER = {
  id: 'e2e-user-1',
  email: 'e2e@example.com',
  username: 'e2etester',
  name: 'E2E Tester',
};

const FRIEND = {
  id: 'friend-1',
  username: 'palfriend',
  name: 'Pal Friend',
  isOnline: true,
  lastSeenAt: new Date().toISOString(),
  battleWins: 1,
  battleLosses: 0,
};

const EMPTY_NOTIFICATIONS = {
  counts: { battleInvites: 0, friendRequests: 0, gameResults: 0, unreadMessages: 0 },
  battleInvites: [],
  friendRequests: [],
  gameResults: [],
  pendingRematches: [],
  unreadMessages: [],
};

const FAKE_UPLOAD_URL = 'https://fake-upload.test/voice/abc';

function json(body, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

/**
 * Installs a fake MediaRecorder + getUserMedia + EventSource into the
 * page before any app script runs.
 *
 * `mimeTypes` is the list of mime types `isTypeSupported` should return
 * true for (in order of preference). The first supported entry doubles
 * as the recorder's reported `mimeType` and the synthesized blob's
 * `type`, so the iOS-style `audio/mp4` path can be exercised by
 * passing `['audio/mp4']`.
 */
async function installBrowserStubs(page, { mimeTypes = ['audio/webm'] } = {}) {
  await page.addInitScript((supported) => {
    class FakeMediaRecorder {
      static isTypeSupported(type) {
        return supported.indexOf(type) !== -1;
      }
      constructor(stream, opts) {
        this.stream = stream;
        this.mimeType = (opts && opts.mimeType) || supported[0] || 'audio/webm';
        this.state = 'inactive';
        this.ondataavailable = null;
        this.onstop = null;
        this.onerror = null;
      }
      start() { this.state = 'recording'; }
      stop() {
        if (this.state === 'inactive') return;
        this.state = 'inactive';
        try {
          if (typeof this.ondataavailable === 'function') {
            const chunk = new Blob(
              [new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])],
              { type: this.mimeType },
            );
            this.ondataavailable({ data: chunk });
          }
        } catch (_e) {}
        try { if (typeof this.onstop === 'function') this.onstop(); } catch (_e) {}
      }
    }

    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      writable: true,
      value: FakeMediaRecorder,
    });

    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        writable: true,
        value: {},
      });
    }
    navigator.mediaDevices.getUserMedia = async () => ({
      getTracks() { return [{ stop() {} }]; },
    });

    // Replace EventSource with a quiet no-op so the NotificationsContext /
    // MatchupContext SSE singleton doesn't keep a real long-poll request
    // open against the stubbed dev server.
    class FakeEventSource {
      constructor() {
        this.readyState = 0;
        this.onopen = null;
        this.onmessage = null;
        this.onerror = null;
      }
      addEventListener() {}
      removeEventListener() {}
      close() {}
    }
    FakeEventSource.CONNECTING = 0;
    FakeEventSource.OPEN = 1;
    FakeEventSource.CLOSED = 2;
    Object.defineProperty(window, 'EventSource', {
      configurable: true,
      writable: true,
      value: FakeEventSource,
    });
  }, mimeTypes);
}

/**
 * Wires up enough API stubs (auth, friends, conversations, profiles,
 * battles, etc.) that /messenger renders the conversation thread for
 * FRIEND. The voice-note specific routes (`/api/uploads/request-url`,
 * the upload PUT, and `POST /api/messages`) are wired separately by the
 * caller so each test can capture the request payload it cares about.
 */
async function setupMessengerStubs(page) {
  await page.addInitScript((user) => {
    try {
      // Bypass the private-beta access gate that wraps every page in
      // _app.js — without this `/messenger` redirects to the access-code
      // landing screen and never renders the conversation thread.
      window.localStorage.setItem('beta_access', 'true');
      window.localStorage.setItem('current_user', JSON.stringify(user));
    } catch (_e) {}
  }, FAKE_USER);

  // Authenticated NextAuth session — without this the messenger page
  // shows the "Sign in to send messages" placeholder.
  await page.route('**/api/auth/session', (route) =>
    route.fulfill(json({
      user: { id: FAKE_USER.id, name: FAKE_USER.name, email: FAKE_USER.email },
      expires: '2099-12-31T23:59:59.999Z',
    })),
  );

  await page.route('**/api/notifications', (route) => route.fulfill(json(EMPTY_NOTIFICATIONS)));
  await page.route('**/api/notifications/**', (route) => route.fulfill(json({ ok: true })));

  await page.route('**/api/messages/conversations', (route) =>
    route.fulfill(json({
      conversations: [{ friend: FRIEND, lastMessage: null, unreadCount: 0 }],
    })),
  );
  await page.route('**/api/messages/typing', (route) => route.fulfill(json({ ok: true })));
  await page.route('**/api/messages/mark-read', (route) => route.fulfill(json({ ok: true })));
  await page.route('**/api/messages/unread', (route) => route.fulfill(json({ unread: [] })));

  await page.route('**/api/profiles/**', (route) =>
    route.fulfill(json({
      id: FRIEND.id,
      username: FRIEND.username,
      bankroll: 0,
      status: 'inactive',
      total_bets: 0,
      wins: 0,
      losses: 0,
    })),
  );
  await page.route('**/api/friends/**', (route) => route.fulfill(json([])));
  await page.route('**/api/battles/**', (route) => route.fulfill(json({ ok: true })));
  await page.route('**/api/matchups/**', (route) => route.fulfill(json({ ok: true })));
}

/**
 * Wires `GET /api/messages?friendId=…` and `POST /api/messages` as a
 * single in-memory conversation — POSTs are appended so subsequent
 * polls return the same message and the bubble doesn't flicker out.
 *
 * Returns a `getPostedBodies()` accessor for assertions and a
 * `messages` array reference so callers can pre-seed history.
 */
async function setupConversationRoute(page) {
  const messages = [];
  const postedBodies = [];
  let nextId = 1;
  await page.route(/\/api\/messages(\?.*)?$/, async (route) => {
    const req = route.request();
    if (req.method() === 'GET') {
      await route.fulfill(json({ messages }));
      return;
    }
    if (req.method() === 'POST') {
      const body = JSON.parse(req.postData() || '{}');
      postedBodies.push(body);
      const stored = {
        id: `msg-${nextId++}`,
        senderId: FAKE_USER.id,
        receiverId: body.receiverId || FRIEND.id,
        content: body.content || '',
        messageType: body.messageType || 'text',
        attachmentUrl: body.attachmentUrl || null,
        attachmentDurationMs: body.attachmentDurationMs || null,
        read: false,
        readAt: null,
        createdAt: new Date().toISOString(),
      };
      messages.push(stored);
      await route.fulfill(json({ message: stored }));
      return;
    }
    await route.fulfill(json({ ok: true }));
  });
  return {
    messages,
    getPostedBodies: () => postedBodies,
  };
}

test.describe('voice-note record + upload pipeline', () => {
  test('happy path: records, uploads and renders an audio bubble in the thread', async ({ page }) => {
    await installBrowserStubs(page, { mimeTypes: ['audio/webm'] });
    await setupMessengerStubs(page);
    const conversation = await setupConversationRoute(page);

    const objectPath = '/objects/uploads/voice-notes/voice-1.webm';
    const requestUrlBodies = [];
    await page.route('**/api/uploads/request-url', async (route) => {
      requestUrlBodies.push(JSON.parse(route.request().postData() || '{}'));
      await route.fulfill(json({ uploadURL: FAKE_UPLOAD_URL, objectPath }));
    });

    let putContentType = null;
    let putBodySize = null;
    await page.route(FAKE_UPLOAD_URL, (route) => {
      const r = route.request();
      putContentType = r.headers()['content-type'] || null;
      const body = r.postDataBuffer();
      putBodySize = body ? body.length : 0;
      route.fulfill({ status: 200, body: '' });
    });

    await page.goto(`/messenger?chat=${FRIEND.id}`);

    // The thread renders its empty-state once the friend is selected and
    // the (stubbed) GET resolves with no history.
    await expect(page.getByText('No messages yet. Say hi!')).toBeVisible();

    const recordBtn = page.getByRole('button', { name: 'Record voice message' });
    await recordBtn.click();

    // While recording, the composer swaps in a "Recording" pill and a
    // dedicated Send button that fires handleStopRecording → onstop.
    await expect(page.getByText('Recording')).toBeVisible();
    const sendBtn = page.getByRole('button', { name: 'Send', exact: true });
    await expect(sendBtn).toBeVisible();
    await sendBtn.click();

    // The audio bubble renders once the POST resolves and the new
    // message is appended to the thread state.
    const bubble = page.locator(`audio[src="${objectPath}"]`);
    await expect(bubble).toHaveCount(1);

    // The request-url call carried the voice-note metadata we expect…
    expect(requestUrlBodies).toHaveLength(1);
    const reqBody = requestUrlBodies[0];
    expect(reqBody.kind).toBe('voice-note');
    expect(reqBody.contentType).toBe('audio/webm');
    expect(reqBody.name).toMatch(/^voice-\d+\.webm$/);
    expect(typeof reqBody.size).toBe('number');
    expect(reqBody.size).toBeGreaterThan(0);

    // …the PUT to the signed URL used a matching Content-Type and the
    // (stubbed) recorded blob bytes…
    expect(putContentType).toBe('audio/webm');
    expect(putBodySize).toBe(8);

    // …and the POST to /api/messages flagged the message as voice with
    // the object-storage path returned by request-url.
    const posted = conversation.getPostedBodies();
    expect(posted).toHaveLength(1);
    expect(posted[0].messageType).toBe('voice');
    expect(posted[0].attachmentUrl).toBe(objectPath);
    expect(posted[0].receiverId).toBe(FRIEND.id);
    expect(typeof posted[0].attachmentDurationMs).toBe('number');
  });

  test('iOS Safari path: audio/mp4 → m4a extension with matching Content-Type', async ({ page }) => {
    // Only audio/mp4 is reported as supported, so MessagesPanel falls
    // through the audio/webm branch into the iOS Safari branch.
    await installBrowserStubs(page, { mimeTypes: ['audio/mp4'] });
    await setupMessengerStubs(page);
    const conversation = await setupConversationRoute(page);

    const objectPath = '/objects/uploads/voice-notes/voice-1.m4a';
    const requestUrlBodies = [];
    await page.route('**/api/uploads/request-url', async (route) => {
      requestUrlBodies.push(JSON.parse(route.request().postData() || '{}'));
      await route.fulfill(json({ uploadURL: FAKE_UPLOAD_URL, objectPath }));
    });

    let putContentType = null;
    await page.route(FAKE_UPLOAD_URL, (route) => {
      putContentType = route.request().headers()['content-type'] || null;
      route.fulfill({ status: 200, body: '' });
    });

    await page.goto(`/messenger?chat=${FRIEND.id}`);
    await expect(page.getByText('No messages yet. Say hi!')).toBeVisible();

    await page.getByRole('button', { name: 'Record voice message' }).click();
    await expect(page.getByText('Recording')).toBeVisible();
    await page.getByRole('button', { name: 'Send', exact: true }).click();

    // Bubble renders against the m4a object path returned by the (stubbed)
    // signed-URL endpoint — proving the round-trip completed end-to-end.
    await expect(page.locator(`audio[src="${objectPath}"]`)).toHaveCount(1);

    // request-url received an m4a filename + audio/mp4 contentType so
    // the server-side validator + signed URL pick the right extension.
    expect(requestUrlBodies).toHaveLength(1);
    expect(requestUrlBodies[0].name).toMatch(/^voice-\d+\.m4a$/);
    expect(requestUrlBodies[0].contentType).toBe('audio/mp4');
    expect(requestUrlBodies[0].kind).toBe('voice-note');

    // The PUT must use the *same* Content-Type as the contentType sent
    // to request-url; otherwise S3-style signers reject the upload as a
    // mismatched header.
    expect(putContentType).toBe('audio/mp4');

    const posted = conversation.getPostedBodies();
    expect(posted).toHaveLength(1);
    expect(posted[0].messageType).toBe('voice');
    expect(posted[0].attachmentUrl).toBe(objectPath);
  });
});
