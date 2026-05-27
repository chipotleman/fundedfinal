// Universal battle end-time computation.
//
// Background: sports schedules run on local-night cycles. The latest
// games of a slate (NBA west coast, MLB late starts, NHL, etc.) tip off
// around 10pm ET and can run until ~1-2am ET. The product rule is:
//
//   * A "day" battle covers everything played on a given calendar day
//     (Eastern time). The pick deadline / battle-end clock locks at
//     MIDNIGHT ET at the end of that day — no picks allowed after that.
//   * Anything picked after midnight is automatically for the NEXT day's
//     battle, not the one that just ended.
//   * After midnight, the battle stays in a "settling" state until the
//     last picked game finishes grading (handled separately by the
//     PnL/settlement job — this helper only governs the pick deadline).
//
// Sub-day modes (rush, 30 min, 1 hour, 3 hours) are NOT snapped — they
// remain pure stopwatch timers because their semantics are "play right
// now for X minutes", not "play through end of day".
//
// All times are anchored to America/New_York ("ET") regardless of where
// the user or server is physically located, so a Pacific user and an
// East-coast user playing the same battle see the same deadline.

const END_TZ = 'America/New_York';

// Duration types that snap to midnight ET. Value = additional whole
// calendar days *beyond today* to include. So 0 = ends at tonight's
// midnight, 2 = ends after day-after-tomorrow finishes, etc.
const DAY_SNAP_DAYS = {
  original: 0,
  '1_day': 0,
  tournament: 2,
  '3_days': 2,
  '1_week': 6,
};

function isDayBased(durationType) {
  return Object.prototype.hasOwnProperty.call(DAY_SNAP_DAYS, durationType);
}

// Return wall-clock parts (Y/M/D/H/m/s) of `date` as observed in ET.
function getEtParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: END_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  let hour = Number(get('hour'));
  // Some Node versions return "24" for the midnight hour — normalize.
  if (hour === 24) hour = 0;
  return {
    y: Number(get('year')),
    m: Number(get('month')),
    d: Number(get('day')),
    h: hour,
    min: Number(get('minute')),
    s: Number(get('second')),
  };
}

// How far the ET wall-clock at `date` is from UTC, in milliseconds.
// Positive when UTC < ET (never happens for ET; always negative — e.g.
// -4h for EDT, -5h for EST). Returned as (asUtc - actualUtc).
function etOffsetMs(date) {
  const et = getEtParts(date);
  const asIfUtc = Date.UTC(et.y, et.m - 1, et.d, et.h, et.min, et.s);
  return asIfUtc - date.getTime();
}

// Returns the Date corresponding to ET midnight at the start of
// (today_ET + daysFromNow + 1). I.e. daysFromNow=0 = "midnight tonight
// ET" (= end of today), daysFromNow=2 = "midnight three nights from now".
function getNextEtMidnight(daysFromNow = 0, now = new Date()) {
  const et = getEtParts(now);
  // Build a candidate UTC instant that *looks like* the target ET wall-
  // clock if we naïvely treated it as UTC.
  const candidate = Date.UTC(et.y, et.m - 1, et.d + 1 + daysFromNow, 0, 0, 0);
  // Now correct for the actual ET offset at that instant (handles DST
  // boundaries — if the target falls on a "spring forward" night, the
  // offset will be the post-jump value).
  const offset = etOffsetMs(new Date(candidate));
  return new Date(candidate - offset);
}

// Compute the battle's pick-deadline / end-time given its duration
// metadata. Day-based modes snap to midnight ET; sub-day modes use a
// pure stopwatch.
function computeBattleEndsAt({ durationType, durationMinutes } = {}, now = new Date()) {
  if (isDayBased(durationType)) {
    return getNextEtMidnight(DAY_SNAP_DAYS[durationType], now);
  }
  const mins = Number.isFinite(Number(durationMinutes)) ? Number(durationMinutes) : 1440;
  return new Date(now.getTime() + mins * 60_000);
}

module.exports = {
  END_TZ,
  DAY_SNAP_DAYS,
  isDayBased,
  getNextEtMidnight,
  computeBattleEndsAt,
};
