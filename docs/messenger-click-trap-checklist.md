# Messenger / Notifications Click-Trap Regression Checklist

The "stuck on messages/notifications" bug — where taps on the top bar stop
registering after opening or closing a dropdown — has regressed twice. Run
this checklist any time you touch:

- `pages/messenger.js`
- `pages/notifications.js`
- `components/TopNavbar.js`
- `components/MobileNavMenu.js`
- `hooks/useModalScrollLock.js`

Run it on **all three** environments below. Every tap must register on the
**first** try. If you have to tap twice, or if a tap is swallowed by an
invisible overlay, the bug is back.

## Environments

1. Desktop browser (Chrome or Firefox at >= 1024px wide).
2. Mobile-width emulation in desktop devtools (iPhone 14 Pro / 390px).
3. Real iOS Safari (iPhone, current iOS). Devtools emulation does **not**
   reproduce the iOS Safari click-trap bug — you must test on a real device
   or a simulator running mobile Safari.

## Steps (run on each environment)

For each environment, sign in as a normal user, then:

1. Navigate to `/messenger`.
2. Tap every icon in the top bar in order (logo, search, bell, messages,
   profile/avatar, hamburger if present). Each tap must register on the
   first try.
3. Open the bell (notifications) dropdown. Dismiss it by tapping outside
   the dropdown. Confirm the next tap on any top-bar icon works on the
   first try.
4. Open the bell dropdown again. Dismiss it by tapping the bell icon
   itself. Confirm the next tap works on the first try.
5. Repeat steps 3 and 4 with the messages dropdown.
6. Open the mobile nav menu (hamburger). Dismiss it by tapping outside,
   then by tapping the hamburger again. Confirm the next tap works on
   the first try.
7. Navigate from `/messenger` to `/notifications` via the bell icon.
8. Repeat steps 2–6 on `/notifications`.
9. Navigate back to `/messenger`. Repeat steps 2–6 once more — the bug
   often only surfaces after a back-and-forth navigation.
10. Scroll the page, then re-open and dismiss each dropdown. Confirm the
    page is still scrollable and that no invisible overlay is left behind
    (you can verify in Safari Web Inspector by toggling "Show Compositing
    Borders" or by inspecting the DOM for any leftover fixed-position
    backdrop nodes).

## Pass criteria

- Every tap in steps 2–10 registers on the first attempt.
- After every dropdown / menu dismissal, the page scrolls normally and
  no full-screen overlay is visible or hit-testable in the DOM.
- `document.body` has no leftover `overflow: hidden`, `position: fixed`,
  or scroll-lock styles applied after all dropdowns are closed
  (check in Safari Web Inspector).

If any step fails, file a bug and do **not** ship the change.
