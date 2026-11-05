import { useState } from "react";
import { LineChart, FastForward, ArrowRight } from "lucide-react";
import type { SimSettings, MarketVariation } from "@/hooks/use-simulation";
import { EventBanner } from "@/components/EventBanner";
import type { EventDefinition } from "@/lib/events";
import { EntryFrame } from "@/components/EntryFrame";

interface ModeSelectProps {
  onSelectReal: () => void;
  onSelectSim: (settings: SimSettings) => void;
  onBack?: () => void;
  startInSettings?: boolean;
  /** If provided, called when user clicks the Simulation card on the choose screen
   *  (instead of going to the internal settings phase). */
  onSimClick?: () => void;
  /** If provided (logged-in user), show the event banner */
  userId?: string | null;
  onJoinEvent?: (event: EventDefinition) => void;
}

const CASH_OPTIONS = [10_000, 50_000, 100_000, 500_000, 1_000_000];

const VARIATION_OPTIONS: { label: string; value: MarketVariation; desc: string }[] = [
  { label: "Low", value: "low", desc: "Calm markets, small moves" },
  { label: "Realistic", value: "realistic", desc: "Normal market conditions" },
  { label: "High", value: "high", desc: "Volatile, big swings" },
];

const formatCash = (n: number) => `$${n.toLocaleString("en-US")}`;

const OPTION = "relative rounded-md border text-left transition-colors";
const OPTION_ON = "border-ink bg-raised text-foreground";
const OPTION_OFF = "border-border bg-card text-dim hover:border-input hover:text-foreground";

/** The radio mark on an option card, so the choice is not shown by colour alone. */
function RadioMark({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex items-center justify-center w-4 h-4 rounded-full border transition-colors ${on ? "border-ink" : "border-input"}`}
    >
      <span className={`w-2 h-2 rounded-full bg-ink transition-[opacity,transform] ${on ? "opacity-100 scale-100" : "opacity-0 scale-50"}`} />
    </span>
  );
}

export function ModeSelect({ onSelectReal, onSelectSim, onBack, startInSettings, onSimClick, userId, onJoinEvent }: ModeSelectProps) {
  const [phase, setPhase] = useState<"choose" | "settings">(startInSettings ? "settings" : "choose");
  const [cash, setCash] = useState(100000);
  const [variation, setVariation] = useState<MarketVariation>("realistic");

  if (phase === "settings") {
    return (
      <EntryFrame
        title="Set up a simulation"
        subtitle="Pick your starting cash and how much the market moves. You can't change these later"
        width="narrow"
        testId="sim-settings"
      >
        <fieldset>
          <legend className="text-xs text-dim mb-3">Starting cash</legend>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2" role="radiogroup" aria-label="Starting cash">
            {CASH_OPTIONS.map(value => (
              <button
                key={value}
                role="radio"
                aria-checked={cash === value}
                onClick={() => setCash(value)}
                className={`${OPTION} h-10 px-3 flex items-center justify-center gap-2 num text-xs ${cash === value ? OPTION_ON : OPTION_OFF}`}
                data-testid={`cash-${value}`}
              >
                {formatCash(value)}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-8">
          <legend className="text-xs text-dim mb-3">Market volatility</legend>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Market volatility">
            {VARIATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                role="radio"
                aria-checked={variation === opt.value}
                onClick={() => setVariation(opt.value)}
                className={`${OPTION} px-4 py-3 flex items-start justify-between gap-3 ${variation === opt.value ? OPTION_ON : OPTION_OFF}`}
                data-testid={`variation-${opt.value}`}
              >
                <span>
                  <span className="block text-sm font-medium text-foreground">{opt.label}</span>
                  <span className="block text-xs text-muted-foreground mt-1">{opt.desc}</span>
                </span>
                <RadioMark on={variation === opt.value} />
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-10 flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={() => onSelectSim({ startingCash: cash, variation })}
            className="h-11 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-[background-color,transform] flex items-center justify-center gap-2"
            data-testid="button-start-sim"
          >
            Start simulation
            <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => (onBack ? onBack() : setPhase("choose"))}
            className="h-11 px-4 rounded-md text-sm text-dim hover:text-foreground hover:bg-raised transition-colors"
            data-testid="button-back"
          >
            {onBack ? "Back to saves" : "Back"}
          </button>
        </div>
      </EntryFrame>
    );
  }

  return (
    <EntryFrame
      title="Choose a mode"
      subtitle="Follow the real market, or practice in a simulation where you control the clock"
      testId="mode-select"
    >
      {userId && onJoinEvent && <EventBanner onJoinEvent={onJoinEvent} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ModeCard
          icon={<LineChart className="w-5 h-5" strokeWidth={1.5} />}
          title="Live market"
          lead="Real quotes during market hours"
          body="Live prices, charts and news from Yahoo Finance. Keep a watchlist and follow the day's biggest movers by sector."
          action="Open the live market"
          onClick={onSelectReal}
          testId="button-real-mode"
        />
        <ModeCard
          icon={<FastForward className="w-5 h-5" strokeWidth={1.5} />}
          title="Simulation"
          lead="Paper trading with virtual cash"
          body="Start from today's prices, then pause or fast-forward the market, react to news and see how your trades hold up."
          action="Set up a simulation"
          onClick={() => (onSimClick ? onSimClick() : setPhase("settings"))}
          testId="button-sim-mode"
        />
      </div>
    </EntryFrame>
  );
}

interface ModeCardProps {
  icon: React.ReactNode;
  title: string;
  lead: string;
  body: string;
  action: string;
  onClick: () => void;
  testId: string;
}

function ModeCard({ icon, title, lead, body, action, onClick, testId }: ModeCardProps) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-lg border border-border bg-card p-6 hover:bg-raised hover:border-foreground/20 transition-colors flex flex-col"
      data-testid={testId}
    >
      <span className="w-10 h-10 rounded-md border border-border bg-background flex items-center justify-center text-dim">{icon}</span>
      <span className="mt-5 text-base font-medium text-foreground">{title}</span>
      <span className="mt-1 text-xs text-muted-foreground">{lead}</span>
      <span className="mt-4 text-sm text-dim leading-relaxed">{body}</span>
      <span className="mt-6 flex items-center gap-2 text-sm text-foreground">
        {action}
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.5} />
      </span>
    </button>
  );
}
