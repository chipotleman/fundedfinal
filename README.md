# FundedFinal

## Deploy Instructions:
1️⃣ Upload the **contents** (not the parent folder) of this ZIP to a **new GitHub repo (e.g., `fundedfinal`)**.
2️⃣ Go to **Vercel**, click **New Project**, import your repo.
3️⃣ Click **Deploy**.
4️⃣ Your project will go live immediately without 404 errors.

Once live, we will proceed with Stripe and Supabase integration for RollrFunded.

## Manual regression checklists

The messenger / notifications click-trap checklist that used to live
here has been **parked**. Task #524 removed the click-trap defense
layer it was written to validate, the matching Playwright projects
were removed from `playwright.config.js`, and the
`.github/workflows/messenger-click-trap.yml` workflow was deleted, so
neither the automated suite nor the manual steps are part of the
required pre-merge flow right now. The full checklist is preserved
for reference (and for whoever re-enables the suite) at
[`docs/messenger-click-trap-checklist.md`](docs/messenger-click-trap-checklist.md);
see the banner at the top of that doc for what would need to be put
back in place to turn it back on.
