// Bloomberg Terminal — Types only (no DB needed for this app)
import { z } from "zod";

// ---- Quote data ----
export const quoteSchema = z.object({
  symbol: z.string(),
  name: z.string().optional(),
  price: z.number(),
  change: z.number(),
  changesPercentage: z.number(),
  volume: z.number().optional(),
  avgVolume: z.number().optional(),
  marketCap: z.number().optional(),
  pe: z.number().nullable().optional(),
  eps: z.number().nullable().optional(),
  dayHigh: z.number().optional(),
  dayLow: z.number().optional(),
  yearHigh: z.number().optional(),
  yearLow: z.number().optional(),
  previousClose: z.number().optional(),
  open: z.number().optional(),
});

export type Quote = z.infer<typeof quoteSchema>;

// ---- OHLCV data ----
export const ohlcvSchema = z.object({
  date: z.string(),
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  volume: z.number(),
});

export type OHLCV = z.infer<typeof ohlcvSchema>;

// ---- Market movers ----
export const moverSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  price: z.number(),
  change: z.number(),
  changesPercentage: z.number(),
});

export type Mover = z.infer<typeof moverSchema>;

// ---- Watchlist item ----
export const watchlistItemSchema = z.object({
  symbol: z.string(),
  name: z.string().optional(),
});

export type WatchlistItem = z.infer<typeof watchlistItemSchema>;

// ---- News item ----
export const newsItemSchema = z.object({
  title: z.string(),
  source: z.string(),
  time: z.string(),
  url: z.string().optional(),
  symbol: z.string().optional(),
});

export type NewsItem = z.infer<typeof newsItemSchema>;

// ---- Company profile ----
export const companyProfileSchema = z.object({
  symbol: z.string(),
  companyName: z.string(),
  industry: z.string().optional(),
  sector: z.string().optional(),
  ceo: z.string().optional(),
  employees: z.number().optional(),
  website: z.string().optional(),
  description: z.string().optional(),
  exchange: z.string().optional(),
  country: z.string().optional(),
});

export type CompanyProfile = z.infer<typeof companyProfileSchema>;
