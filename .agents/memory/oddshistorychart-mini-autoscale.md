---
name: OddsHistoryChart mini sparkline auto-scale
description: Why the in-card live win-% sparkline auto-scales its Y axis (and must keep doing so)
---

The `mini` mode of `components/game/OddsHistoryChart.js` (the in-card live win-%
sparkline on game/battle cards) auto-scales its vertical axis to the data's
actual min/max via a `yDomain` memo, instead of mapping 0–100% across the full
plot height.

**Why:** a live game's implied win % only moves within a narrow band, so on the
fixed 0–1 scale the line collapsed into a near-flat horizontal that "didn't show
the movement," and the only visible crossing was the elongated convergence to the
right-edge badges. Reported by the user as looking bad. Auto-scaling fills the
tiny (~32px) chart with the real movement.

**How to apply:** keep `yDomain` gated on `mini` — the FULL chart must stay on the
fixed 0–1 domain because it pins axis labels at 0/50/100%. Keep the minimum
half-span clamp (currently 0.05) so a dead-flat / tied market doesn't zoom in so
far the jitter looks like an earthquake, and keep the padding so lines don't kiss
the top/bottom edges. All consumers (paths, badges, hover dots, 50% midline) go
through `yOf`, so they follow the domain automatically — don't hardcode pixel Y.
