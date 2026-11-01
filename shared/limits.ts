// Shared by the app and the Worker, so both agree on defaults and limits.

/** Every new account starts with this watchlist. */
export const DEFAULT_WATCHLIST = [
  "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "TSLA", "META", "JPM",
  "V", "UNH", "BRK-B", "JNJ", "WMT", "MA", "PG",
];

/** Tickers, indices (^GSPC), currencies (EURUSD=X) and share classes (BRK-B). */
export const SYMBOL_PATTERN = /^[A-Z0-9.\-^=]{1,15}$/;

export const MAX_WATCHLIST_SYMBOLS = 200;

/** Simulation saves one account may keep. */
export const MAX_SIM_SAVES = 20;
