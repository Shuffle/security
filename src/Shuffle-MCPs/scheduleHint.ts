/**
 * scheduleHint — lightweight natural-language detector for scheduling intent
 * inside an agent prompt. Recognises phrases like:
 *   "schedule this", "at 6 am", "next monday at 2am",
 *   "daily in the evening", "every 15 minutes", "weekdays at 9am",
 *   "every monday", "weekly", "hourly", "tonight at 11pm"
 *
 * Returns a structured hint that the UI uses to (1) highlight the Schedule
 * button and (2) preselect a cron expression in the schedule popover.
 *
 * NOTE: Intentionally simple — pure heuristics, no LLM. Good enough to surface
 * scheduling as a suggestion; the user always confirms in the popover.
 */

export interface ScheduleHint {
  /** Suggested cron expression (5-field, UTC-naive — matches existing chips). */
  cron: string;
  /** Human-readable label, e.g. "Daily at 6:00 AM" or "Every Monday at 2:00 AM". */
  label: string;
  /** Strength of the match — used to decide how loud the UI hint should be. */
  confidence: 'low' | 'medium' | 'high';
  /** The substring of the input that triggered the match (for highlighting). */
  matchedText: string;
  /**
   * True when the phrasing describes a single upcoming moment ("this coming
   * Monday", "tomorrow at 9") rather than a repeating schedule. The cron is
   * then pinned to that exact date so it does not fire every week.
   */
  once?: boolean;
  /** ISO timestamp of the single occurrence, when `once` is true. */
  runAt?: string;
}


const DAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

const PART_OF_DAY: Record<string, number> = {
  morning: 9,
  noon: 12,
  afternoon: 14,
  evening: 18,
  night: 22,
  midnight: 0,
};

const DAY_LABEL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const fmtTime = (h: number, m: number): string => {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  const mm = m.toString().padStart(2, '0');
  return `${h12}:${mm} ${ampm}`;
};

const findTime = (text: string): { h: number; m: number; matched: string } | null => {
  // 6am, 6 am, 6:30am, 14:00, 2:30 pm
  const re = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b|\b(\d{1,2}):(\d{2})\b(?!\s*(?:am|pm))/i;
  const m = text.match(re);
  if (!m) return null;
  if (m[1]) {
    let h = parseInt(m[1], 10);
    const min = m[2] ? parseInt(m[2], 10) : 0;
    const meridiem = m[3].toLowerCase().replace(/\./g, '');
    if (meridiem === 'pm' && h < 12) h += 12;
    if (meridiem === 'am' && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    return { h, m: min, matched: m[0] };
  }
  if (m[4]) {
    const h = parseInt(m[4], 10);
    const min = parseInt(m[5], 10);
    if (h > 23 || min > 59) return null;
    return { h, m: min, matched: m[0] };
  }
  return null;
};

const findDay = (text: string): { day: number; matched: string; plural: boolean } | null => {
  for (const [name, d] of Object.entries(DAY_NAMES)) {
    // "mondays" (plural) reads as a recurring weekly slot, "monday" does not.
    const re = new RegExp(`\\b${name}(s)?\\b`, 'i');
    const m = text.match(re);
    if (m) return { day: d, matched: m[0], plural: Boolean(m[1]) };
  }
  return null;
};

const MONTH_LABEL = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Next calendar date matching `day` (0-6) at h:m, strictly in the future. */
const nextDateForWeekday = (day: number, h: number, m: number): Date => {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  let delta = (day - target.getDay() + 7) % 7;
  if (delta === 0 && target.getTime() <= now.getTime()) delta = 7;
  target.setDate(target.getDate() + delta);
  return target;
};

/** A hint pinned to one specific date — cron includes day-of-month + month. */
const onceHint = (
  target: Date,
  confidence: ScheduleHint['confidence'],
  matchedText: string,
): ScheduleHint => ({
  cron: `${target.getMinutes()} ${target.getHours()} ${target.getDate()} ${target.getMonth() + 1} *`,
  label: `Once on ${DAY_LABEL[target.getDay()]}, ${MONTH_LABEL[target.getMonth()]} ${target.getDate()} at ${fmtTime(target.getHours(), target.getMinutes())}`,
  confidence,
  matchedText,
  once: true,
  runAt: target.toISOString(),
});


const findPartOfDay = (text: string): { h: number; matched: string } | null => {
  for (const [name, h] of Object.entries(PART_OF_DAY)) {
    const re = new RegExp(`\\b${name}\\b`, 'i');
    const m = text.match(re);
    if (m) return { h, matched: m[0] };
  }
  return null;
};

export const parseScheduleHint = (input: string): ScheduleHint | null => {
  if (!input) return null;
  const text = input.toLowerCase();
  const hits: string[] = [];

  // ── 1. Recurrence keywords ──────────────────────────────────────────────
  const everyMin = text.match(/every\s+(\d+)\s*(?:m|min|mins|minute|minutes)\b/);
  if (everyMin) {
    const n = Math.max(1, Math.min(59, parseInt(everyMin[1], 10)));
    return {
      cron: `*/${n} * * * *`,
      label: `Every ${n} minute${n === 1 ? '' : 's'}`,
      confidence: 'high',
      matchedText: everyMin[0],
    };
  }
  const everyHr = text.match(/every\s+(\d+)\s*(?:h|hr|hrs|hour|hours)\b/);
  if (everyHr) {
    const n = Math.max(1, Math.min(23, parseInt(everyHr[1], 10)));
    return {
      cron: `0 */${n} * * *`,
      label: `Every ${n} hour${n === 1 ? '' : 's'}`,
      confidence: 'high',
      matchedText: everyHr[0],
    };
  }
  if (/\bhourly\b|\bevery hour\b/.test(text)) {
    return { cron: '0 * * * *', label: 'Hourly', confidence: 'high', matchedText: 'hourly' };
  }

  // ── 2. Time of day (explicit or part-of-day) ────────────────────────────
  const t = findTime(text);
  const part = !t ? findPartOfDay(text) : null;
  const hour = t ? t.h : part ? part.h : null;
  const minute = t ? t.m : 0;
  if (t) hits.push(t.matched);
  if (part) hits.push(part.matched);

  // ── 3. Day-of-week ──────────────────────────────────────────────────────
  const day = findDay(text);
  if (day) hits.push(day.matched);

  // ── 4. Frequency words ──────────────────────────────────────────────────
  const isDaily = /\b(daily|every\s+day|each\s+day)\b/.test(text);
  const isWeekly = /\b(weekly|every\s+week)\b/.test(text);
  const isWeekdays = /\b(weekday|weekdays|every\s+weekday|workdays?|business\s+days?)\b/.test(text);
  const isMonthly = /\b(monthly|every\s+month)\b/.test(text);
  const hasScheduleWord = /\b(schedule|recurring|recur|repeat|automate|cron)\b/.test(text);
  if (isDaily) hits.push('daily');
  if (isWeekly) hits.push('weekly');
  if (isWeekdays) hits.push('weekdays');
  if (isMonthly) hits.push('monthly');

  // A single upcoming day ("this coming monday", "next monday", "on monday")
  // is a one-off reminder — only "every monday" / "mondays" / "weekly" repeat.
  const recurringDayPhrase = day
    ? day.plural || new RegExp(`\\b(?:every|each)\\s+(?:other\\s+)?${day.matched}\\b`).test(text)
    : false;
  const oneOffDayPhrase = Boolean(day) && !recurringDayPhrase;
  if (/\bnext\b/.test(text)) hits.push('next');


  // ── Near-future one-off phrases ────────────────────────────────────────
  // Relative offsets: "in 15 min", "in 2 days", "2 days from now", "in an
  // hour", "in half an hour", "3 weeks later", "in a couple of hours".
  const rel = findRelativeOffset(text);
  if (rel) {
    const target = new Date(Date.now() + rel.ms);
    // A day/week/month offset with an explicit time lands on that clock time.
    if (rel.unitDays && (t || part)) target.setHours(hour ?? 9, minute, 0, 0);
    if (rel.unitDays) target.setSeconds(0, 0);
    return onceHint(target, 'high', rel.matched);
  }

  // "later today", "later", "soon", "shortly", "in a bit" — ~2 hours out.
  const laterMatch = text.match(/\b(later\s+today|later\s+tonight|later\s+this\s+(?:morning|afternoon|evening)|later|soon|shortly|in\s+a\s+bit|in\s+a\s+while|in\s+a\s+moment)\b/);
  if (laterMatch && hour === null) {
    return onceHint(new Date(Date.now() + 2 * 3_600_000), 'medium', laterMatch[0]);
  }

  // "end of day" / "end of the week" / "end of the month"
  const endOf = text.match(/\bend\s+of\s+(?:the\s+)?(day|today|week|month)\b/);
  if (endOf && !isDaily && !isWeekly && !isMonthly) {
    const target = new Date();
    const which = endOf[1];
    if (which === 'day' || which === 'today') {
      target.setHours(hour ?? 17, minute, 0, 0);
      if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
    } else if (which === 'week') {
      const delta = (5 - target.getDay() + 7) % 7; // upcoming Friday
      target.setDate(target.getDate() + (delta === 0 ? 7 : delta));
      target.setHours(hour ?? 17, minute, 0, 0);
    } else {
      target.setMonth(target.getMonth() + 1, 0); // last day of this month
      target.setHours(hour ?? 17, minute, 0, 0);
    }
    return onceHint(target, 'medium', endOf[0]);
  }

  // "the day after tomorrow" / "day after tomorrow"
  const dayAfter = text.match(/\b(?:the\s+)?day\s+after\s+tomorrow\b/);
  if (dayAfter) {
    const target = new Date();
    target.setDate(target.getDate() + 2);
    target.setHours(hour ?? 9, minute, 0, 0);
    return onceHint(target, 'high', dayAfter[0]);
  }

  if (/\btonight\b/.test(text) && !isDaily && !isWeekly) {
    const h = hour ?? 21;
    const target = new Date();
    target.setHours(h, minute, 0, 0);
    if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
    return onceHint(target, 'medium', 'tonight');
  }
  if (/\btomorrow\b/.test(text) && !isDaily && !isWeekly) {
    const target = new Date();
    target.setDate(target.getDate() + 1);
    target.setHours(hour ?? 9, minute, 0, 0);
    return onceHint(target, 'medium', hits.join(' ') || 'tomorrow');
  }
  if (/\btoday\b/.test(text) && hour !== null && !isDaily && !isWeekly) {
    const target = new Date();
    target.setHours(hour, minute, 0, 0);
    if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
    return onceHint(target, 'medium', hits.join(' ') || 'today');
  }
  // "this morning/afternoon/evening" — a single upcoming moment today.
  const thisPart = text.match(/\bthis\s+(morning|afternoon|evening)\b/);
  if (thisPart && !isDaily && !isWeekly) {
    const target = new Date();
    target.setHours(hour ?? PART_OF_DAY[thisPart[1]], minute, 0, 0);
    if (target.getTime() <= Date.now()) target.setDate(target.getDate() + 1);
    return onceHint(target, 'medium', thisPart[0]);
  }
  // "next week" / "next month" without a weekday.
  const nextSpan = !day ? text.match(/\bnext\s+(week|month)\b/) : null;
  if (nextSpan && !isWeekly && !isMonthly && !isDaily) {
    const target = new Date();
    if (nextSpan[1] === 'week') target.setDate(target.getDate() + 7);
    else target.setMonth(target.getMonth() + 1);
    target.setHours(hour ?? 9, minute, 0, 0);
    return onceHint(target, 'medium', nextSpan[0]);
  }
  if (day && oneOffDayPhrase && !isWeekly && !isMonthly && !isWeekdays && !isDaily) {
    const target = nextDateForWeekday(day.day, hour ?? 9, minute);
    // "next monday" pushes past an imminent occurrence (today/tomorrow).
    if (/\bnext\b/.test(text)) {
      const upcomingDelta = Math.round((target.getTime() - Date.now()) / 86_400_000);
      if (upcomingDelta < 2) target.setDate(target.getDate() + 7);
    }

    return onceHint(
      target,
      hour !== null ? 'high' : 'medium',
      hits.join(' ') || day.matched,
    );
  }



  // ── 5. Build cron from collected pieces ─────────────────────────────────
  if (day && hour !== null) {
    return {
      cron: `${minute} ${hour} * * ${day.day}`,
      label: `Every ${DAY_LABEL[day.day]} at ${fmtTime(hour, minute)}`,
      confidence: 'high',
      matchedText: hits.join(' '),
    };
  }

  if (isWeekdays && hour !== null) {
    return {
      cron: `${minute} ${hour} * * 1-5`,
      label: `Weekdays at ${fmtTime(hour, minute)}`,
      confidence: 'high',
      matchedText: hits.join(' '),
    };
  }
  if (isMonthly && hour !== null) {
    return {
      cron: `${minute} ${hour} 1 * *`,
      label: `Monthly on the 1st at ${fmtTime(hour, minute)}`,
      confidence: 'high',
      matchedText: hits.join(' '),
    };
  }
  if (isWeekly) {
    const d = day ? day.day : 1;
    const h = hour ?? 9;
    return {
      cron: `${minute} ${h} * * ${d}`,
      label: `Every ${DAY_LABEL[d]} at ${fmtTime(h, minute)}`,
      confidence: 'high',
      matchedText: hits.join(' '),
    };
  }
  if (isDaily || (hour !== null && (isDaily || part || hasScheduleWord || /\bevery\b/.test(text)))) {
    const h = hour ?? 9;
    return {
      cron: `${minute} ${h} * * *`,
      label: `Daily at ${fmtTime(h, minute)}`,
      confidence: 'high',
      matchedText: hits.join(' '),
    };
  }
  if (day) {
    return {
      cron: `0 9 * * ${day.day}`,
      label: `Every ${DAY_LABEL[day.day]} at 9:00 AM`,
      confidence: 'medium',
      matchedText: day.matched,
    };
  }
  if (hour !== null) {
    return {
      cron: `${minute} ${hour} * * *`,
      label: `Daily at ${fmtTime(hour, minute)}`,
      confidence: 'medium',
      matchedText: hits.join(' '),
    };
  }
  if (hasScheduleWord) {
    return {
      cron: '0 9 * * *',
      label: 'Schedule this prompt',
      confidence: 'low',
      matchedText: text.match(/\b(schedule|recurring|recur|repeat|automate|cron)\b/)?.[0] || 'schedule',
    };
  }
  return null;
};
