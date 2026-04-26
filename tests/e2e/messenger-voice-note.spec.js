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
 *   3. Verify the module-level `claimVoicePlayback` registry pauses any
 *      previously-playing voice clip when a second one starts, so two
 *      bubbles (or the composer preview + a bubble) never overlap.
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
    // "Done" button that fires handleStopRecording → onstop, which
    // hands off to the waveform preview state (not a direct send).
    await expect(page.getByText('Recording')).toBeVisible();
    const doneBtn = page.getByRole('button', { name: 'Finish recording and preview' });
    await expect(doneBtn).toBeVisible();
    await doneBtn.click();

    // The preview state surfaces a Re-record + Send pair around the
    // captured waveform. Tapping "Send" here is what actually ships
    // the take to the friend.
    const previewSend = page.getByRole('button', { name: 'Send', exact: true });
    await expect(previewSend).toBeVisible();
    await previewSend.click();

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
    // Recording → preview hand-off, then preview → actual send.
    await page.getByRole('button', { name: 'Finish recording and preview' }).click();
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

/**
 * Patches HTMLMediaElement so `play()` / `pause()` / `paused` behave
 * deterministically without needing a decodable audio source. Real
 * audio loading is unreliable in headless browsers (the bubble's
 * `<audio src="/objects/...">` would otherwise depend on actually
 * fetching + decoding bytes), and we don't care about audio rendering
 * here — only that the registry's `pause()` call on the previously
 * playing element transitions it from "playing" back to "paused" and
 * fires the native `pause` event the bubble UI listens to.
 */
async function installFakeAudioPlayback(page) {
  await page.addInitScript(() => {
    const proto = HTMLMediaElement.prototype;
    Object.defineProperty(proto, 'paused', {
      configurable: true,
      get() { return this.__fakePaused !== false; },
    });
    proto.play = function () {
      if (this.__fakePaused !== false) {
        this.__fakePaused = false;
        try { this.dispatchEvent(new Event('play')); } catch (_e) {}
      }
      return Promise.resolve();
    };
    proto.pause = function () {
      if (this.__fakePaused === false) {
        this.__fakePaused = true;
        try { this.dispatchEvent(new Event('pause')); } catch (_e) {}
      }
    };
  });
}

/**
 * Mirrors the shape `GET /api/messages` returns for a stored voice
 * note: `messageType: 'voice'` + `attachmentUrl` is what the thread
 * uses to render a `VoiceBubble`.
 */
function makeVoiceMessage({ id, senderId, receiverId, attachmentUrl, durationMs = 1500 }) {
  return {
    id,
    senderId,
    receiverId,
    content: '',
    messageType: 'voice',
    attachmentUrl,
    attachmentDurationMs: durationMs,
    attachmentPeaks: null,
    read: true,
    readAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

/**
 * Both bubbles share the same "Play voice message" aria-label, so we
 * scope the click to the play button that lives next to the audio
 * element with the given src. The audio is `display: none` but still
 * sits in the DOM as a sibling of the play button under the
 * VoiceWaveform wrapper.
 */
async function clickAudioPlayButton(page, src) {
  await page.evaluate((s) => {
    const audio = document.querySelector(`audio[src="${s}"]`);
    if (!audio || !audio.parentElement) {
      throw new Error(`no audio element found for src ${s}`);
    }
    const btn = audio.parentElement.querySelector('button');
    if (!btn) throw new Error(`no play button found for src ${s}`);
    btn.click();
  }, src);
}

async function audioPaused(page, src) {
  return page.evaluate((s) => {
    const audio = document.querySelector(`audio[src="${s}"]`);
    return audio ? audio.paused : null;
  }, src);
}

test.describe('voice-note overlap prevention', () => {
  test('playing a second bubble pauses the first (mine + theirs registry)', async ({ page }) => {
    await installBrowserStubs(page, { mimeTypes: ['audio/webm'] });
    await installFakeAudioPlayback(page);
    await setupMessengerStubs(page);
    const conversation = await setupConversationRoute(page);

    // The bubble's <audio preload="metadata"> would otherwise hit the
    // dev server for the (non-existent) object path and pollute the
    // log; serve an empty body so the metadata fetch resolves cleanly.
    await page.route('**/objects/**', (route) =>
      route.fulfill({ status: 200, body: '' }),
    );

    const minePath = '/objects/uploads/voice-notes/voice-mine.webm';
    const theirsPath = '/objects/uploads/voice-notes/voice-theirs.webm';
    // Pre-seed two voice messages — one outgoing (variant 'mine') and
    // one incoming (variant 'theirs') — so we exercise both bubble
    // variants of the shared registry in a single test.
    conversation.messages.push(
      makeVoiceMessage({
        id: 'seed-mine',
        senderId: FAKE_USER.id,
        receiverId: FRIEND.id,
        attachmentUrl: minePath,
      }),
      makeVoiceMessage({
        id: 'seed-theirs',
        senderId: FRIEND.id,
        receiverId: FAKE_USER.id,
        attachmentUrl: theirsPath,
      }),
    );

    await page.goto(`/messenger?chat=${FRIEND.id}`);

    // Both bubbles must be mounted before we start poking play buttons,
    // otherwise the second click can race the GET poll that hydrates the
    // thread state.
    await expect(page.locator(`audio[src="${minePath}"]`)).toHaveCount(1);
    await expect(page.locator(`audio[src="${theirsPath}"]`)).toHaveCount(1);

    // Sanity: nothing is playing initially.
    expect(await audioPaused(page, minePath)).toBe(true);
    expect(await audioPaused(page, theirsPath)).toBe(true);

    // Tap play on the first (outgoing) bubble.
    await clickAudioPlayButton(page, minePath);
    await expect.poll(() => audioPaused(page, minePath)).toBe(false);
    expect(await audioPaused(page, theirsPath)).toBe(true);
    // The bubble UI flips to a Pause label as soon as the native
    // `play` event fires — confirms the registry didn't leave the
    // bubble's `playing` state out of sync with the audio element.
    await expect(
      page.getByRole('button', { name: 'Pause voice message' }),
    ).toHaveCount(1);

    // Tap play on the second (incoming) bubble. The registry must
    // synchronously pause the first audio *before* the second starts
    // playing, so they never overlap — even briefly.
    await clickAudioPlayButton(page, theirsPath);
    await expect.poll(() => audioPaused(page, minePath)).toBe(true);
    await expect.poll(() => audioPaused(page, theirsPath)).toBe(false);
    // Exactly one bubble should report a Pause label (the second one).
    await expect(
      page.getByRole('button', { name: 'Pause voice message' }),
    ).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: 'Play voice message' }),
    ).toHaveCount(1);
  });

  test('playing a sent bubble pauses the composer preview (preview + mine registry)', async ({ page }) => {
    await installBrowserStubs(page, { mimeTypes: ['audio/webm'] });
    await installFakeAudioPlayback(page);
    await setupMessengerStubs(page);
    const conversation = await setupConversationRoute(page);

    await page.route('**/objects/**', (route) =>
      route.fulfill({ status: 200, body: '' }),
    );

    const bubblePath = '/objects/uploads/voice-notes/voice-existing.webm';
    conversation.messages.push(
      makeVoiceMessage({
        id: 'seed-existing',
        senderId: FAKE_USER.id,
        receiverId: FRIEND.id,
        attachmentUrl: bubblePath,
      }),
    );

    await page.goto(`/messenger?chat=${FRIEND.id}`);
    await expect(page.locator(`audio[src="${bubblePath}"]`)).toHaveCount(1);

    // Drive the recorder into the preview state without sending — that
    // surfaces the composer's `<VoiceWaveform variant="preview">` row,
    // which shares the same module-level registry as the bubbles.
    await page.getByRole('button', { name: 'Record voice message' }).click();
    await expect(page.getByText('Recording')).toBeVisible();
    await page
      .getByRole('button', { name: 'Finish recording and preview' })
      .click();
    await expect(
      page.getByRole('button', { name: 'Play voice preview' }),
    ).toBeVisible();

    // The preview's <audio> uses an in-memory blob: URL so we can't
    // pin it down by a stable src; pick the one audio element whose
    // src isn't the seeded bubble path.
    const previewSrc = await page.evaluate((bubble) => {
      const audios = Array.from(document.querySelectorAll('audio'));
      const preview = audios.find((a) => a.getAttribute('src') !== bubble);
      return preview ? preview.getAttribute('src') : null;
    }, bubblePath);
    expect(previewSrc).toBeTruthy();

    // Start playback on the composer preview row.
    await page.getByRole('button', { name: 'Play voice preview' }).click();
    await expect.poll(() => audioPaused(page, previewSrc)).toBe(false);
    expect(await audioPaused(page, bubblePath)).toBe(true);

    // Now tap play on the previously-sent bubble. The registry must
    // pause the preview audio so the two clips don't overlap.
    await clickAudioPlayButton(page, bubblePath);
    await expect.poll(() => audioPaused(page, previewSrc)).toBe(true);
    await expect.poll(() => audioPaused(page, bubblePath)).toBe(false);

    // The preview row's button label flips back to "Play voice
    // preview" because the registry's pause fired the native `pause`
    // event on the preview audio, which clears its bubble's
    // `playing` state.
    await expect(
      page.getByRole('button', { name: 'Play voice preview' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Pause voice message' }),
    ).toHaveCount(1);
  });
});
