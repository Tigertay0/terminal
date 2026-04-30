import { useState, useEffect, useRef } from "react";
import { Search, X, LogOut, User, Home, Sun, Moon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";

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
}

export function TopBar({ onSearch, selectedSymbol, simMode, searchSymbols, onHome }: TopBarProps) {
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

  const timeStr = time.toLocaleTimeString("en-US", { hour12: false });
  const dateStr = time.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });

  const hours = time.getHours();
  const minutes = time.getMinutes();
  const day = time.getDay();
  const totalMinutes = hours * 60 + minutes;
  const isWeekday = day >= 1 && day <= 5;
  const isMarketOpen = isWeekday && totalMinutes >= 570 && totalMinutes < 960;
  const isPreMarket = isWeekday && totalMinutes >= 240 && totalMinutes < 570;
  const isAfterHours = isWeekday && totalMinutes >= 960 && totalMinutes < 1200;

  let marketStatus = "CLOSED";
  let statusColor = "text-bb-red";
  if (isMarketOpen) { marketStatus = "OPEN"; statusColor = "text-bb-green"; }
  else if (isPreMarket) { marketStatus = "PRE-MKT"; statusColor = "text-bb-yellow"; }
  else if (isAfterHours) { marketStatus = "AFTER-HRS"; statusColor = "text-bb-yellow"; }

  return (
    <div
      className="flex items-center h-8 px-2 gap-3 border-b border-border bg-sidebar shrink-0 select-none"
      data-testid="topbar"
    >
      {/* Bloomberg logo */}
      <div className="flex items-center gap-1.5 shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-label="Bloomberg Terminal">
          <rect x="2" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" />
          <rect x="14" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.7" />
          <rect x="2" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.5" />
          <rect x="14" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.3" />
        </svg>
        <span className="text-bb-orange font-bold text-xs tracking-wider">BLOOMBERG</span>
        {simMode && (
          <span className="text-[9px] font-bold bg-bb-orange/20 text-bb-orange px-1.5 py-0.5 rounded-sm ml-1">SIM</span>
        )}
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Home button */}
      {onHome && (
        <>
          <button
            onClick={onHome}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-muted-foreground hover:text-bb-orange hover:bg-bb-orange/10 transition-all"
            title="Back to Mode Select"
            data-testid="button-home"
          >
            <Home className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold tracking-wider">HOME</span>
          </button>
          <div className="w-px h-4 bg-border" />
        </>
      )}

      {/* Search bar with autocomplete */}
      <div className="relative flex-1 max-w-md" ref={dropdownRef}>
        <form onSubmit={handleSubmit} className="flex items-center">
          <div className="flex items-center bg-card border border-border rounded-sm px-2 h-5 w-full">
            <Search className="w-3 h-3 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
              placeholder="Search any stock, ETF, or index..."
              className="bg-transparent text-foreground text-[11px] font-mono pl-1.5 w-full outline-none placeholder:text-muted-foreground"
              data-testid="input-search"
            />
            {searchValue && (
              <button type="button" onClick={() => { setSearchValue(""); setShowDropdown(false); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            )}
            <span className="text-2xs text-muted-foreground shrink-0 ml-1">GO</span>
          </div>
        </form>

        {/* Autocomplete dropdown */}
        {showDropdown && results.length > 0 && (
          <div className="absolute top-6 left-0 right-0 bg-card border border-border rounded-sm shadow-xl z-50 max-h-64 overflow-y-auto bb-scrollbar" data-testid="search-dropdown">
            {results.map((r, i) => (
              <button
                key={r.symbol}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left hover:bg-white/[0.04] transition-colors ${
                  i === selectedIdx ? "bg-white/[0.06]" : ""
                }`}
                onClick={() => selectResult(r)}
                data-testid={`search-result-${r.symbol}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[11px] font-bold text-bb-orange shrink-0">{r.symbol}</span>
                  <span className="text-[11px] text-foreground truncate">{r.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <span className="text-[9px] text-muted-foreground uppercase">{r.type}</span>
                  <span className="text-[9px] text-muted-foreground">{r.exchange}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active symbol */}
      {selectedSymbol && (
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-bb-orange font-bold text-xs">{selectedSymbol}</span>
          <span className="text-2xs text-muted-foreground">Equity</span>
        </div>
      )}

      <div className="flex-1" />

      {/* Market status */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${isMarketOpen ? "bg-bb-green" : isPreMarket || isAfterHours ? "bg-bb-yellow" : "bg-bb-red"}`} />
          <span className={`text-2xs font-medium ${statusColor}`}>{marketStatus}</span>
        </div>
        <span className="text-2xs text-muted-foreground">NYSE</span>
      </div>

      <div className="w-px h-4 bg-border" />

      {/* User menu */}
      <UserMenu />

      <div className="w-px h-4 bg-border" />

      {/* Theme toggle */}
      <ThemeToggle />

      {/* Clock */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-2xs text-muted-foreground">{dateStr}</span>
        <span className="text-xs font-bold text-foreground tabular-nums">{timeStr}</span>
        <span className="text-2xs text-muted-foreground">ET</span>
      </div>
    </div>
  );
}

function UserMenu() {
  const auth = useAuth();
  if (!auth.isAuthenticated || !auth.user) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <User className="w-3 h-3 text-muted-foreground" />
        <span className="text-2xs text-muted-foreground">Guest</span>
      </div>
    );
  }
  const name = (auth.user.user_metadata?.display_name as string) || auth.user.email?.split("@")[0] || "User";
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="flex items-center gap-1">
        <div className="w-1.5 h-1.5 rounded-full bg-bb-green" />
        <span className="text-2xs font-medium text-foreground" data-testid="text-user">{name}</span>
      </div>
      <button
        onClick={() => supabase.auth.signOut()}
        className="flex items-center gap-1 text-2xs text-muted-foreground hover:text-bb-orange transition-colors"
        data-testid="button-logout"
        title="Sign out"
      >
        <LogOut className="w-3 h-3" />
      </button>
    </div>
  );
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="flex items-center gap-1 px-1.5 py-0.5 rounded-sm text-muted-foreground hover:text-bb-orange hover:bg-bb-orange/10 transition-all"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      data-testid="button-theme-toggle"
    >
      {theme === "dark" ? (
        <Sun className="w-3.5 h-3.5" />
      ) : (
        <Moon className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
