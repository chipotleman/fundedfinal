---
name: Crowns / Clash Coins currency rebrand
description: Which display currency maps to which surface, and the beta-vs-live branch rule, for the Piks dollar→Crowns / Battle Coins→Clash Coins rebrand.
---

Two display currencies (labels/copy ONLY — never DB columns, API fields, or business logic):

- **Clash Coins** (glyph `⚔`, orange `#fb923c`) = per-matchup currency: in-battle balances, bet stakes ("Picked"/"Total Pikked"), potential payouts, "At Risk"/"To Win"/"Change", the start stack / starting bankroll (10,000 / 100,000), and the active-matchup "Buy-In" (which is really `startingBalance`).
- **Crowns** (glyph `👑`) = account-level / cross-matchup standing: navbar bankroll pill, leaderboard profit, lifetime winnings, and the prize/pot you WIN for winning a battle.

**Why:** Beta has no real money. The rebrand reframes cash → Crowns ("most Crowns wins the beta") and battle coins → Clash Coins, mapped onto the user's mental model (in-matchup vs account standing).

**How to apply / edge rules:**
- Where a `isBeta ? ... : ...` ternary exists, rebrand ONLY the beta branch; leave the non-beta (live/real-money) branch as `$`. This pattern is used consistently in notifications, NotificationsDropdown, battle.js invite copy, IncomingInviteModal, PlayFriendModal.
- Genuine real-money-action flows stay `$` even when unconditional: PreMatchPopup's buy-in selection / "Total pot" / "Winner takes" / balance / "add funds" / "insufficient balance" / confirm. Keep that component internally `$`-coherent (buy-in `$` ⇒ pot `$`).
- In-battle **starting bankroll** copy ("10,000 Clash Coins") is correct in BOTH modes — it's always play coins — so it is NOT gated by isBeta.
- The active-matchup detail card (pages/battle.js) shows the user's live beta matchup → Buy-In(start stack) = `⚔`, Pot = `👑`.
- NEVER touch: withdrawal pages/flows, deposit/Stripe, admin panel, prop-firm "challenge funding / get funded $100K" marketing. Leave those `$` as-is.
- Display: number via `formatMoney(n, 0)`. Tight pills: `⚔ {n}` / `👑 {n}`. Prose: "{n} Clash Coins" / "{n} Crowns".
