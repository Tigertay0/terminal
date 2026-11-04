import { useState, useEffect, useRef } from "react";
import { Search, X, LogOut, Home, Sun, Moon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/hooks/use-theme";
import { Wordmark } from "@/components/BrandMark";

interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
}

interface TopBarProps {
  onSearch: (query: string) => void;
  selectedSymbol: string;
  simMode?: boolean;
  searchSymbols?: (query: string) => Promise<SearchResult[]>;
  onHome?: () => void;
  onAuth?: () => void;
}

const TYPE_LABEL: Record<string, string> = { EQUITY: "Stock", ETF: "ETF", INDEX: "Index", MUTUALFUND: "Fund" };

const ICON = "w-4 h-4";
const ICON_BUTTON = "h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-raised transition-colors";

/** New York wall-clock parts, so the clock and market status are right in any time zone. */
function newYorkTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  return {
    weekday: get("weekday"),
    date: `${get("month")} ${get("day")}`,
    time: `${String(hour).padStart(2, "0")}:${get("minute")}:${get("second")}`,
    minutes: hour * 60 + minute,
  };
}

function marketStatus(weekday: string, minutes: number): { label: string; open: boolean } {
  const isWeekday = !["Sat", "Sun"].includes(weekday);
  if (isWeekday && minutes >= 570 && minutes < 960) return { label: "Open", open: true };
  if (isWeekday && minutes >= 240 && minutes < 570) return { label: "Pre-market", open: false };
  if (isWeekday && minutes >= 960 && minutes < 1200) return { label: "After hours", open: false };
  return { label: "Closed", open: false };
}

export function TopBar({ onSearch, selectedSymbol, searchSymbols, onHome, onAuth }: TopBarProps) {
  const [time, setTime] = useState(new Date());
  const [searchValue, setSearchValue] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!searchSymbols || searchValue.trim().length < 1) {
      setResults([]);
      setShowDropdown(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const r = await searchSymbols(searchValue.trim());
      setResults(r);
      setShowDropdown(r.length > 0);
      setSelectedIdx(-1);
    }, 250);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [searchValue, searchSymbols]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIdx >= 0 && results[selectedIdx]) {
      selectResult(results[selectedIdx]);
    } else if (searchValue.trim()) {
      onSearch(searchValue.trim().toUpperCase());
      setSearchValue("");
      setShowDropdown(false);
    }
  };

  const selectResult = (r: SearchResult) => {
    onSearch(r.symbol);
    setSearchValue("");
    setShowDropdown(false);
    setSelectedIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  const ny = newYorkTime(time);
  const status = marketStatus(ny.weekday, ny.minutes);

  return (
    <div
      className="flex items-center h-11 px-3 gap-4 border-b border-border bg-sidebar shrink-0 select-none"
      data-testid="topbar"
    >
      <Wordmark className="shrink-0" />

      {onHome && (
        <button
          onClick={onHome}
          className="flex items-center gap-2 h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-raised transition-colors"
          title="Back to mode select"
          data-testid="button-home"
        >
          <Home className={ICON} strokeWidth={1.5} />
          Home
        </button>
      )}

      {/* Search with autocomplete */}
      <div className="relative flex-1 max-w-sm" ref={dropdownRef}>
        <form onSubmit={handleSubmit} className="flex items-center">
          <label className="flex items-center gap-2 h-7 w-full px-2 rounded-md bg-raised border border-border focus-within:border-ink/60 transition-colors">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
            <input
              type="text"
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
              placeholder="Search symbols"
              aria-label="Search symbols"
              className="bg-transparent text-foreground text-xs w-full outline-none placeholder:text-muted-foreground"
              data-testid="input-search"
            />
            {searchValue && (
              <button type="button" aria-label="Clear search" onClick={() => { setSearchValue(""); setShowDropdown(false); }} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </label>
        </form>

        {showDropdown && results.length > 0 && (
          <div className="absolute top-9 left-0 right-0 bg-popover border border-border rounded-lg shadow-md z-50 max-h-72 overflow-y-auto rf-scrollbar p-1" data-testid="search-dropdown">
            {results.map((r, i) => (
              <button
                key={r.symbol}
                className={`w-full h-8 flex items-center justify-between gap-3 px-2 rounded-md text-left transition-colors hover:bg-raised ${
                  i === selectedIdx ? "bg-raised" : ""
                }`}
                onClick={() => selectResult(r)}
                data-testid={`search-result-${r.symbol}`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <span className="num text-xs font-medium text-foreground w-16 shrink-0">{r.symbol}</span>
                  <span className="text-xs text-dim truncate">{r.name}</span>
                </span>
                <span className="text-2xs text-muted-foreground shrink-0">{TYPE_LABEL[r.type] ?? r.type} · {r.exchange}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedSymbol && (
        <span className="num text-xs font-medium text-foreground shrink-0">{selectedSymbol}</span>
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-2 shrink-0 text-xs" title="New York Stock Exchange regular session">
        <span className={`w-1.5 h-1.5 rounded-full ${status.open ? "bg-up" : "bg-muted-foreground/60"}`} />
        <span className={status.open ? "text-foreground" : "text-muted-foreground"}>{status.label}</span>
        <span className="text-muted-foreground">NYSE</span>
      </div>

      <div className="flex items-baseline gap-2 shrink-0">
        <span className="text-xs text-muted-foreground">{ny.date}</span>
        <span className="num text-xs text-foreground">{ny.time}</span>
        <span className="text-2xs text-muted-foreground">ET</span>
      </div>

      <div className="w-px h-4 bg-border" />

      <UserMenu onAuth={onAuth} />
      <ThemeToggle />
    </div>
  );
}

function UserMenu({ onAuth }: { onAuth?: () => void }) {
  const auth = useAuth();
  const { toast } = useToast();
  if (!auth.isAuthenticated || !auth.user) {
    return (
      <button
        onClick={onAuth}
        className="h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-raised transition-colors shrink-0"
        data-testid="button-sign-in"
      >
        Sign in
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1 shrink-0">
      <span className="text-xs text-dim px-1" data-testid="text-user">{auth.displayName}</span>
      <button
        onClick={() =>
          auth.logout().catch(() => toast({ title: "Could not sign out", description: "Check your connection and try again.", variant: "destructive" }))
        }
        className={ICON_BUTTON}
        data-testid="button-logout"
        title="Sign out"
        aria-label="Sign out"
      >
        <LogOut className={ICON} strokeWidth={1.5} />
      </button>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button onClick={toggleTheme} className={ICON_BUTTON} title={label} aria-label={label} data-testid="button-theme-toggle">
      {theme === "dark" ? <Sun className={ICON} strokeWidth={1.5} /> : <Moon className={ICON} strokeWidth={1.5} />}
    </button>
  );
}
