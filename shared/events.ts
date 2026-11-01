// The event schedule's dates and keys, shared so the Worker only accepts
// entries for the event that is running now. Event details (names, rules)
// live in src/lib/events.ts.

export const LAUNCH_EVENT_KEY = "launch_2026";
export const LAUNCH_START = new Date("2026-04-30T00:00:00-04:00");
export const LAUNCH_END = new Date("2026-05-06T11:59:59-04:00");
/** After the launch event, a new event starts every 5 real-world days. */
export const ROTATION_MS = 5 * 24 * 60 * 60 * 1000;

export interface EventWindow {
  eventKey: string;
  /** Which rotating event this is (null for the launch event). */
  rotationIndex: number | null;
  startsAt: Date;
  endsAt: Date;
}

/** The event running at `now`. */
export function eventWindow(now: Date = new Date()): EventWindow {
  if (now <= LAUNCH_END) {
    return { eventKey: LAUNCH_EVENT_KEY, rotationIndex: null, startsAt: LAUNCH_START, endsAt: LAUNCH_END };
  }
  const rotationIndex = Math.floor((now.getTime() - LAUNCH_END.getTime()) / ROTATION_MS);
  const startsAt = new Date(LAUNCH_END.getTime() + rotationIndex * ROTATION_MS);
  return {
    eventKey: `rotating_${startsAt.toISOString().split("T")[0]}`,
    rotationIndex,
    startsAt,
    endsAt: new Date(startsAt.getTime() + ROTATION_MS),
  };
}
