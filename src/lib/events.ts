// ─── Event System ────────────────────────────────────────────────
// Deterministic event schedule: launch event → rotating 5-day events
// No server-side cron needed — events are computed from the current date.

import type { MarketVariation } from "@/hooks/use-simulation";

export interface EventDefinition {
  eventKey: string;
  name: string;
  description: string;
  /** Symbols players can trade. null = all stocks available */
  allowedSymbols: string[] | null;
  /** In-game trading day limit */
  durationDays: number;
  startingCash: number;
  variation: MarketVariation;
  /** Real-world start/end dates */
  startsAt: Date;
  endsAt: Date;
}

// ─── Launch Event ────────────────────────────────────────────────
const LAUNCH_START = new Date("2026-04-30T00:00:00-04:00");
const LAUNCH_END = new Date("2026-05-05T23:59:59-04:00");

const LAUNCH_EVENT: Omit<EventDefinition, "eventKey" | "startsAt" | "endsAt"> = {
  name: "The Grand Opening",
  description: "The inaugural Bloomberg Terminal challenge. 100 days, $10K, high volatility — prove you belong.",
  allowedSymbols: null,
  durationDays: 100,
  startingCash: 10000,
  variation: "high",
};

// ─── Rotating Event Templates ────────────────────────────────────
export interface EventTemplate {
  name: string;
  description: string;
  allowedSymbols: string[] | null;
  durationDays: number;
  startingCash: number;
  variation: MarketVariation;
}

export const ROTATING_TEMPLATES: EventTemplate[] = [
  {
    name: "The Tech Boom",
    description: "Ride the wave of tech innovation. Only tech stocks available.",
    allowedSymbols: ["AAPL", "MSFT", "GOOGL", "META", "NVDA", "TSLA", "AMZN", "CRM", "ORCL", "INTC"],
    durationDays: 20,
    startingCash: 10000,
    variation: "high",
  },
  {
    name: "Blue Chip Blitz",
    description: "Play it safe with America's largest companies — or so you think.",
    allowedSymbols: ["AAPL", "MSFT", "JPM", "JNJ", "WMT", "PG", "UNH", "V", "BRK-B", "MA"],
    durationDays: 15,
    startingCash: 50000,
    variation: "realistic",
  },
  {
    name: "Pharma Frenzy",
    description: "FDA approvals, trial results, patent cliffs. The healthcare gauntlet.",
    allowedSymbols: ["PFE", "ABBV", "MRK", "JNJ", "UNH", "LLY", "AMGN", "GILD", "BMY", "MDT"],
    durationDays: 10,
    startingCash: 25000,
    variation: "high",
  },
  {
    name: "The FAANG Challenge",
    description: "Eight titans, 30 days. Build your big-tech empire.",
    allowedSymbols: ["AAPL", "AMZN", "META", "GOOGL", "NVDA", "MSFT", "NFLX", "TSLA"],
    durationDays: 30,
    startingCash: 10000,
    variation: "realistic",
  },
  {
    name: "Penny Pincher",
    description: "Start with almost nothing. Every dollar counts.",
    allowedSymbols: null,
    durationDays: 5,
    startingCash: 1000,
    variation: "high",
  },
  {
    name: "Wall Street Titans",
    description: "The finance sector showdown. Banks, brokers, and big money.",
    allowedSymbols: ["JPM", "GS", "MS", "BAC", "WFC", "C", "BLK", "SCHW", "AXP", "V"],
    durationDays: 15,
    startingCash: 100000,
    variation: "realistic",
  },
  {
    name: "Energy Rush",
    description: "Oil, gas, and renewables. Volatile commodities await.",
    allowedSymbols: ["XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "HAL"],
    durationDays: 10,
    startingCash: 20000,
    variation: "high",
  },
  {
    name: "The Sprint",
    description: "5 days. $10K. Maximum chaos. Good luck.",
    allowedSymbols: null,
    durationDays: 5,
    startingCash: 10000,
    variation: "high",
  },
];

// ─── Rotation period in milliseconds (5 real-world days) ─────────
const ROTATION_MS = 5 * 24 * 60 * 60 * 1000;

// ─── Get Current Event ───────────────────────────────────────────
/**
 * Deterministically computes the current active event based on the date.
 * Before May 5: launch event.
 * After May 5: rotating 5-day events cycling through ROTATING_TEMPLATES.
 */
export function getCurrentEvent(now: Date = new Date()): EventDefinition {
  // Launch event period
  if (now <= LAUNCH_END) {
    return {
      ...LAUNCH_EVENT,
      eventKey: "launch_2026",
      startsAt: LAUNCH_START,
      endsAt: LAUNCH_END,
    };
  }

  // After launch: rotating events
  const msSinceLaunchEnd = now.getTime() - LAUNCH_END.getTime();
  const rotationIndex = Math.floor(msSinceLaunchEnd / ROTATION_MS);
  const templateIndex = rotationIndex % ROTATING_TEMPLATES.length;
  const template = ROTATING_TEMPLATES[templateIndex];

  const startsAt = new Date(LAUNCH_END.getTime() + rotationIndex * ROTATION_MS);
  const endsAt = new Date(startsAt.getTime() + ROTATION_MS);

  return {
    ...template,
    eventKey: `rotating_${startsAt.toISOString().split("T")[0]}`,
    startsAt,
    endsAt,
  };
}

// ─── Time Remaining Helpers ──────────────────────────────────────
export function getEventTimeRemaining(event: EventDefinition, now: Date = new Date()): string {
  const ms = event.endsAt.getTime() - now.getTime();
  if (ms <= 0) return "Ended";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (days > 0) return `${days}d ${remainingHours}h`;
  if (remainingHours > 0) return `${remainingHours}h`;
  const mins = Math.floor(ms / (1000 * 60));
  return `${mins}m`;
}

export function isEventExpired(event: EventDefinition, now: Date = new Date()): boolean {
  return now > event.endsAt;
}
