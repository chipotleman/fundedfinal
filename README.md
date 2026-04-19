# FundedFinal

## Deploy Instructions:
1️⃣ Upload the **contents** (not the parent folder) of this ZIP to a **new GitHub repo (e.g., `fundedfinal`)**.
2️⃣ Go to **Vercel**, click **New Project**, import your repo.
3️⃣ Click **Deploy**.
4️⃣ Your project will go live immediately without 404 errors.

Once live, we will proceed with Stripe and Supabase integration for RollrFunded.

## Manual regression checklists

After touching `pages/messenger.js`, `pages/notifications.js`,
`components/TopNavbar.js`, `components/MobileNavMenu.js`, or
`hooks/useModalScrollLock.js`, run the click-trap checklist in
[`docs/messenger-click-trap-checklist.md`](docs/messenger-click-trap-checklist.md)
on desktop, mobile-width emulation, **and** a real iOS Safari device. The
"stuck on messages/notifications" bug has regressed twice and only reliably
reproduces on real iOS Safari.
