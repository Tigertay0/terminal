// ─── Event System ────────────────────────────────────────────────
// Deterministic event schedule: launch event → rotating 5-day events
// No server-side cron needed — events are computed from the current date.

import type { MarketVariation } from "@/hooks/use-simulation";
import { eventWindow } from "@shared/events";

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
  /** Prize description for the event winner (optional) */
  prize?: string;
}

// ─── Launch Event ────────────────────────────────────────────────
const LAUNCH_EVENT: Omit<EventDefinition, "eventKey" | "startsAt" | "endsAt"> = {
  name: "The Grand Opening",
  description: "The inaugural Rochambeau Finance Terminal challenge. 100 days, $10K, high volatility.",
  allowedSymbols: null,
  durationDays: 100,
  startingCash: 10000,
  variation: "high",
  prize: "Winner's prize: 3 months of Snapchat+, 1 month of PS Plus, or 1 month of Xbox Game Pass Ultimate",
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
    description: "Ten tech names at high volatility. Only tech stocks can be traded.",
    allowedSymbols: ["AAPL", "MSFT", "GOOGL", "META", "NVDA", "TSLA", "AMZN", "CRM", "ORCL", "INTC"],
    durationDays: 20,
    startingCash: 10000,
    variation: "high",
  },
  {
    name: "Blue Chip Blitz",
    description: "Play it safe with America's largest companies. Safe, or so you think.",
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
    description: "Five days, $10K and every stock, at high volatility.",
    allowedSymbols: null,
    durationDays: 5,
    startingCash: 10000,
    variation: "high",
  },
];

// ─── Get Current Event ───────────────────────────────────────────
/**
 * Deterministically computes the current active event based on the date.
 * Before May 5: launch event.
 * After May 5: rotating 5-day events cycling through ROTATING_TEMPLATES.
 */
export function getCurrentEvent(now: Date = new Date()): EventDefinition {
  const { eventKey, rotationIndex, startsAt, endsAt } = eventWindow(now);
  const details = rotationIndex === null
    ? LAUNCH_EVENT
    : ROTATING_TEMPLATES[rotationIndex % ROTATING_TEMPLATES.length];
  return { ...details, eventKey, startsAt, endsAt };
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
