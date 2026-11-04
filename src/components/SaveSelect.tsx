import { useState } from "react";
import { Trash2, Plus, ArrowLeft } from "lucide-react";
import type { SimSaveRow, EventParticipantRow } from "@/lib/user-data";
import { formatWholeDollars as formatCurrency, getChangeColor } from "@/lib/finance-api";
import { MAX_SIM_SAVES } from "@shared/limits";
import { EntryFrame } from "@/components/EntryFrame";
import { LoadingScreen } from "@/components/BrandMark";
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

const VOLATILITY: Record<string, string> = { low: "Low", realistic: "Realistic", high: "High" };

function formatRelativeTime(dateStr: string): string {
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const signed = (n: number) => `${n >= 0 ? "+" : ""}${formatCurrency(n)}`;
const signedPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

export function SaveSelect({ saves, loading, onContinue, onNew, onDelete, onBack, completedEvents }: SaveSelectProps) {
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  if (loading) {
    return <LoadingScreen title="Loading your simulations" />;
  }

  return (
    <EntryFrame
      title="Your simulations"
      subtitle={saves.length > 0 ? "Pick up where you left off, or start a new one" : "You have no saved simulations yet"}
      testId="save-select"
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <button
          onClick={onNew}
          className="h-11 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-[background-color,transform] flex items-center justify-center gap-2"
          data-testid="button-new-sim"
        >
          <Plus className="w-4 h-4" strokeWidth={1.5} />
          New simulation
        </button>
        <button
          onClick={onBack}
          className="h-11 px-4 rounded-md text-sm text-dim hover:text-foreground hover:bg-raised transition-colors flex items-center justify-center gap-2"
          data-testid="button-back-saves"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          Back to modes
        </button>
        <span className="sm:ml-auto num text-xs text-muted-foreground">{saves.length} of {MAX_SIM_SAVES} saves</span>
      </div>

      {saves.length > 0 && (
        <div className="rounded-lg border border-border bg-card divide-y divide-border max-h-[420px] overflow-y-auto rf-scrollbar">
          {saves.map((save) => {
            const value = getPortfolioValue(save);
            const startingCash = save.settings?.startingCash ?? 100000;
            const pnl = value - startingCash;
            const pnlPct = startingCash > 0 ? (pnl / startingCash) * 100 : 0;

            return (
              <div key={save.id} className="group flex items-center gap-4 px-4 py-3 hover:bg-raised/60 transition-colors" data-testid={`save-card-${save.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{save.name || "Untitled"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Day <span className="num">{save.day_number}</span>
                    {" · "}{VOLATILITY[save.settings?.variation ?? "realistic"] ?? "Realistic"} volatility
                    {" · "}<span className="num">{formatCurrency(startingCash)}</span> start
                    {" · "}saved {formatRelativeTime(save.updated_at)}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="num text-sm text-foreground">{formatCurrency(value)}</div>
                  <div className={`num text-xs mt-1 ${getChangeColor(pnl)}`} title="Cash plus holdings at what you paid for them">
                    {signed(pnl)} ({signedPct(pnlPct)}) at cost
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onContinue(save)}
                    className="h-8 px-3 rounded-md border border-border text-xs text-foreground hover:bg-raised transition-colors"
                    data-testid={`continue-${save.id}`}
                  >
                    Continue
                  </button>
                  <button
                    onClick={() => setDeleteTarget(save.id)}
                    className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-down hover:bg-raised opacity-0 group-hover:opacity-100 focus:opacity-100 transition-[opacity,color,background-color]"
                    aria-label={`Delete ${save.name || "Untitled"}`}
                    data-testid={`delete-${save.id}`}
                  >
                    <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {completedEvents && completedEvents.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs text-dim mb-3">Finished events</h2>
          <div className="rounded-lg border border-border divide-y divide-border max-h-[220px] overflow-y-auto rf-scrollbar">
            {completedEvents.map((ep) => {
              const profit = ep.profit ?? 0;
              const startingCash = ep.settings?.startingCash ?? 10000;
              const pnlPct = startingCash > 0 ? (profit / startingCash) * 100 : 0;
              return (
                <div key={ep.id} className="flex items-center gap-4 px-4 py-3" data-testid={`event-save-${ep.id}`}>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground truncate">{ep.settings?.eventName ?? ep.event_key}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Day <span className="num">{ep.current_day}</span> · finished {formatRelativeTime(ep.updated_at)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`num text-sm ${getChangeColor(profit)}`}>{signed(profit)}</div>
                    <div className="num text-xs text-muted-foreground mt-1">{signedPct(pnlPct)} return</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this simulation?</AlertDialogTitle>
            <AlertDialogDescription>
              Its portfolio and trade history are removed for good. This can't be undone.
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
    </EntryFrame>
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
