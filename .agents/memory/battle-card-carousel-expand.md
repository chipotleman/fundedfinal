---
name: Featured Battles card expand vs modal
description: Why active "Your Battle" taps must open a portal modal, not inline-expand
---

# Active battle card tap must open a portal modal, not inline-expand

In the Featured Battles carousel (`components/battle/LiveBattlesSection.js`,
`YouVsCard`), an **active** matchup tap must open `MyBattleOverviewModal` (a
portal) rather than the inline grid-row expand that waiting/queued states use.

**Why:** the carousel row clips vertical overflow. The inline expand grows the
card height downward, so the preview / Open Battle / forfeit controls render but
stay hidden — to the user "nothing happens" when they tap their own battle.

**How to apply:** in `handleCardTap`, branch on `isActive && matchup?.id` →
`handleNavigate()` (which sets `showMyBattleOverview`) before the
`onToggle()`/inline-expand fallback. Keep inline-expand for waiting/queued
(those previews are short and the user is on /battle, not the clipped carousel).
