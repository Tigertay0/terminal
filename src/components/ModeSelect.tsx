import { useState } from "react";
import { TrendingUp, Gamepad2, ArrowRight, DollarSign, Activity } from "lucide-react";
import type { SimSettings, MarketVariation } from "@/hooks/use-simulation";
import { EventBanner } from "@/components/EventBanner";
import type { EventDefinition } from "@/lib/events";

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

const CASH_OPTIONS = [
  { label: "$10,000", value: 10000 },
  { label: "$50,000", value: 50000 },
  { label: "$100,000", value: 100000 },
  { label: "$500,000", value: 500000 },
  { label: "$1,000,000", value: 1000000 },
];

const VARIATION_OPTIONS: { label: string; value: MarketVariation; desc: string }[] = [
  { label: "LOW", value: "low", desc: "Calm markets, small moves" },
  { label: "REALISTIC", value: "realistic", desc: "Normal market conditions" },
  { label: "HIGH", value: "high", desc: "Volatile, big swings" },
];

export function ModeSelect({ onSelectReal, onSelectSim, onBack, startInSettings, onSimClick, userId, onJoinEvent }: ModeSelectProps) {
  const [phase, setPhase] = useState<"choose" | "settings">(startInSettings ? "settings" : "choose");
  const [cash, setCash] = useState(100000);
  const [variation, setVariation] = useState<MarketVariation>("realistic");

  if (phase === "settings") {
    return (
      <div className="h-screen flex items-center justify-center bg-background" data-testid="sim-settings">
        <div className="w-full max-w-lg mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-3">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" />
                <rect x="14" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.7" />
                <rect x="2" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.5" />
                <rect x="14" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.3" />
              </svg>
              <span className="text-bb-orange font-bold text-lg tracking-wider">SIMULATION SETUP</span>
            </div>
            <p className="text-muted-foreground text-xs">Configure your trading simulation</p>
          </div>

          {/* Starting Cash */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-3.5 h-3.5 text-bb-green" />
              <span className="text-xs font-bold text-foreground tracking-wider">STARTING CAPITAL</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {CASH_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setCash(opt.value)}
                  className={`py-2 px-2 text-xs font-mono rounded-sm border transition-all ${
                    cash === opt.value
                      ? "border-bb-orange bg-bb-orange/10 text-bb-orange"
                      : "border-border bg-card hover:border-muted-foreground/30 text-muted-foreground"
                  }`}
                  data-testid={`cash-${opt.value}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Market Variation */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-3.5 h-3.5 text-bb-cyan" />
              <span className="text-xs font-bold text-foreground tracking-wider">MARKET VARIATION</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {VARIATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setVariation(opt.value)}
                  className={`py-3 px-3 rounded-sm border text-left transition-all ${
                    variation === opt.value
                      ? "border-bb-orange bg-bb-orange/10"
                      : "border-border bg-card hover:border-muted-foreground/30"
                  }`}
                  data-testid={`variation-${opt.value}`}
                >
                  <div className={`text-xs font-bold mb-1 ${
                    variation === opt.value ? "text-bb-orange" : "text-foreground"
                  }`}>
                    {opt.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Start button */}
          <button
            onClick={() => onSelectSim({ startingCash: cash, variation })}
            className="w-full py-3 bg-bb-orange text-black font-bold text-sm rounded-sm hover:bg-bb-orange/90 transition-colors flex items-center justify-center gap-2"
            data-testid="button-start-sim"
          >
            START SIMULATION
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              if (onBack) {
                onBack();
              } else {
                setPhase("choose");
              }
            }}
            className="w-full mt-3 py-2 text-muted-foreground text-xs hover:text-foreground transition-colors"
            data-testid="button-back"
          >
            {onBack ? "Back to Saves" : "Back to Mode Select"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-background" data-testid="mode-select">
      <div className="w-full max-w-2xl mx-auto px-4">
        {/* Logo & Title */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" />
              <rect x="14" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.7" />
              <rect x="2" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.5" />
              <rect x="14" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.3" />
            </svg>
            <span className="text-bb-orange font-bold text-xl tracking-wider">BLOOMBERG TERMINAL</span>
          </div>
          <p className="text-muted-foreground text-xs tracking-wide">SELECT MODE</p>
        </div>

        {/* Event Banner — only for logged-in users */}
        {userId && onJoinEvent && (
          <EventBanner onJoinEvent={onJoinEvent} />
        )}

        {/* Mode Cards */}
        <div className="grid grid-cols-2 gap-4">
          {/* Real Mode */}
          <button
            onClick={onSelectReal}
            className="group p-6 rounded-sm border border-border bg-card hover:border-bb-green/50 hover:bg-bb-green/[0.03] transition-all text-left"
            data-testid="button-real-mode"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-sm bg-bb-green/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-bb-green" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">REAL MODE</div>
                <div className="text-2xs text-muted-foreground">Live market data</div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">
              View real-time simulated market data, track stocks, analyze charts, and monitor market movements.
            </p>
            <div className="flex items-center gap-1 text-bb-green text-xs font-medium group-hover:gap-2 transition-all">
              Enter Terminal <ArrowRight className="w-3 h-3" />
            </div>
          </button>

          {/* Simulation Mode */}
          <button
            onClick={() => onSimClick ? onSimClick() : setPhase("settings")}
            className="group p-6 rounded-sm border border-border bg-card hover:border-bb-orange/50 hover:bg-bb-orange/[0.03] transition-all text-left"
            data-testid="button-sim-mode"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-sm bg-bb-orange/10 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-bb-orange" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">SIMULATION</div>
                <div className="text-2xs text-muted-foreground">Paper trading</div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">
              Trade with virtual currency. Control time flow, react to news events, and learn to invest risk-free.
            </p>
            <div className="flex items-center gap-1 text-bb-orange text-xs font-medium group-hover:gap-2 transition-all">
              Configure & Start <ArrowRight className="w-3 h-3" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
