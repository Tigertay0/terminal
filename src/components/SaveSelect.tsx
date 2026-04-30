import { useState } from "react";
import { Play, Trash2, Plus, ArrowLeft, Save, Clock, Calendar, DollarSign, TrendingUp, TrendingDown, Trophy } from "lucide-react";
import type { SimSaveRow } from "@/lib/supabase";
import type { EventParticipantRow } from "@/lib/supabase";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SaveSelectProps {
  saves: SimSaveRow[];
  loading: boolean;
  onContinue: (save: SimSaveRow) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onBack: () => void;
  completedEvents?: EventParticipantRow[];
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatCurrency(val: number): string {
  return val.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function SaveSelect({ saves, loading, onContinue, onNew, onDelete, onBack, completedEvents }: SaveSelectProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background" data-testid="save-select-loading">
        <div className="text-center space-y-3">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="mx-auto animate-pulse">
            <rect x="2" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" />
            <rect x="14" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.7" />
            <rect x="2" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.5" />
            <rect x="14" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.3" />
          </svg>
          <div className="text-bb-orange font-bold text-sm tracking-wider">LOADING SAVES</div>
          <div className="text-muted-foreground text-xs">Fetching your simulations…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-background" data-testid="save-select">
      <div className="w-full max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" />
              <rect x="14" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.7" />
              <rect x="2" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.5" />
              <rect x="14" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.3" />
            </svg>
            <span className="text-bb-orange font-bold text-lg tracking-wider">SIMULATION SAVES</span>
          </div>
          <p className="text-muted-foreground text-xs">Continue a previous simulation or start fresh</p>
        </div>

        {/* Save Cards */}
        <div className="space-y-2 mb-6 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
          {saves.map((save) => {
            const portfolioValue = getPortfolioValue(save);
            const startingCash = save.settings?.startingCash ?? 100000;
            const pnl = portfolioValue - startingCash;
            const pnlPct = startingCash > 0 ? (pnl / startingCash) * 100 : 0;
            const isPositive = pnl >= 0;

            return (
              <div
                key={save.id}
                className="group border border-border bg-card rounded-sm p-4 hover:border-bb-orange/40 hover:bg-bb-orange/[0.02] transition-all"
                data-testid={`save-card-${save.id}`}
              >
                <div className="flex items-center justify-between gap-4">
                  {/* Left: Save info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Save className="w-3.5 h-3.5 text-bb-orange shrink-0" />
                      <span className="text-sm font-bold text-foreground truncate">{save.name || "Untitled"}</span>
                      <span className="text-[9px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-sm shrink-0">
                        {save.settings?.variation?.toUpperCase() ?? "REALISTIC"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5" />
                        Day {save.day_number}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {formatRelativeTime(save.updated_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-2.5 h-2.5" />
                        {formatCurrency(startingCash)} start
                      </span>
                    </div>
                  </div>

                  {/* Middle: Portfolio value */}
                  <div className="text-right shrink-0">
                    <div className="text-xs font-bold text-foreground tabular-nums">
                      {formatCurrency(portfolioValue)}
                    </div>
                    <div className={`flex items-center justify-end gap-0.5 text-[10px] font-bold tabular-nums ${isPositive ? "text-bb-green" : "text-bb-red"}`}>
                      {isPositive ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {isPositive ? "+" : ""}{formatCurrency(pnl)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => onContinue(save)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-bb-orange/10 text-bb-orange text-[10px] font-bold border border-bb-orange/20 hover:bg-bb-orange/20 transition-all"
                      data-testid={`continue-${save.id}`}
                    >
                      <Play className="w-3 h-3" />
                      CONTINUE
                    </button>
                    <button
                      onClick={() => setDeleteTarget(save.id)}
                      className="p-1.5 rounded-sm text-muted-foreground hover:text-bb-red hover:bg-bb-red/10 transition-all opacity-0 group-hover:opacity-100"
                      data-testid={`delete-${save.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* New Simulation button */}
        <button
          onClick={() => {
            if (saves.length >= 20) {
              // Soft cap — handled via toast in parent, but guard here too
              return;
            }
            onNew();
          }}
          className="w-full py-3 bg-bb-orange text-black font-bold text-sm rounded-sm hover:bg-bb-orange/90 transition-colors flex items-center justify-center gap-2"
          data-testid="button-new-sim"
        >
          <Plus className="w-4 h-4" />
          NEW SIMULATION
        </button>

        <button
          onClick={onBack}
          className="w-full mt-3 py-2 text-muted-foreground text-xs hover:text-foreground transition-colors flex items-center justify-center gap-1"
          data-testid="button-back-saves"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to Mode Select
        </button>

        {/* Completed Events */}
        {completedEvents && completedEvents.length > 0 && (
          <>
            <div className="flex items-center gap-2 mt-6 mb-3">
              <Trophy className="w-3.5 h-3.5 text-bb-cyan" />
              <span className="text-[10px] font-bold text-bb-cyan tracking-wider">COMPLETED EVENTS</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
              {completedEvents.map((ep) => {
                const profit = ep.profit ?? 0;
                const isPositive = profit >= 0;
                const startingCash = ep.settings?.startingCash ?? 10000;
                const pnlPct = startingCash > 0 ? (profit / startingCash) * 100 : 0;

                return (
                  <div
                    key={ep.id}
                    className="border border-border/60 bg-card/50 rounded-sm p-3 opacity-80"
                    data-testid={`event-save-${ep.id}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[8px] font-bold tracking-wider text-bb-cyan bg-bb-cyan/10 px-1.5 py-0.5 rounded-sm border border-bb-cyan/20">EVENT</span>
                          <span className="text-xs font-bold text-foreground/80 truncate">
                            {ep.settings?.eventName ?? ep.event_key}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-2.5 h-2.5" />
                            Day {ep.current_day}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {formatRelativeTime(ep.updated_at)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`text-xs font-bold tabular-nums ${isPositive ? 'text-bb-green' : 'text-bb-red'}`}>
                          {isPositive ? '+' : ''}{formatCurrency(profit)}
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          {isPositive ? '+' : ''}{pnlPct.toFixed(1)}% return
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Save?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this simulation save. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteTarget) {
                    onDelete(deleteTarget);
                    setDeleteTarget(null);
                  }
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

/** Extract portfolio value from a save row, handling various serialization shapes */
function getPortfolioValue(save: SimSaveRow): number {
  const p = save.portfolio;
  if (!p) return save.settings?.startingCash ?? 100000;
  const cash = typeof p.cash === "number" ? p.cash : 0;
  let holdingsValue = 0;
  // holdings is stored as [[symbol, {shares, avgCost, ...}], ...]
  if (Array.isArray(p.holdings)) {
    for (const entry of p.holdings) {
      if (Array.isArray(entry) && entry.length >= 2) {
        const holding = entry[1];
        if (holding && typeof holding.shares === "number" && typeof holding.avgCost === "number") {
          // Use avgCost as best proxy since we don't have live prices on this screen
          holdingsValue += holding.shares * holding.avgCost;
        }
      }
    }
  }
  return cash + holdingsValue;
}
