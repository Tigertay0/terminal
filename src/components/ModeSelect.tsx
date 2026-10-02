import { useState } from "react";
import { TrendingUp, Gamepad2, ArrowRight, DollarSign, Activity } from "lucide-react";
import type { SimSettings, MarketVariation } from "@/hooks/use-simulation";
import { EventBanner } from "@/components/EventBanner";
import type { EventDefinition } from "@/lib/events";
import { BrandMark } from "@/components/BrandMark";

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
              <BrandMark size={28} />
              <span className="text-rf-orange font-bold text-lg tracking-wider">SIMULATION SETUP</span>
            </div>
            <p className="text-muted-foreground text-xs">Configure your trading simulation</p>
          </div>

          {/* Starting Cash */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="w-3.5 h-3.5 text-rf-green" />
              <span className="text-xs font-bold text-foreground tracking-wider">STARTING CAPITAL</span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {CASH_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setCash(opt.value)}
                  className={`py-2 px-2 text-xs font-mono rounded-sm border transition-all ${
                    cash === opt.value
                      ? "border-rf-orange bg-rf-orange/10 text-rf-orange"
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
              <Activity className="w-3.5 h-3.5 text-rf-cyan" />
              <span className="text-xs font-bold text-foreground tracking-wider">MARKET VARIATION</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {VARIATION_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setVariation(opt.value)}
                  className={`py-3 px-3 rounded-sm border text-left transition-all ${
                    variation === opt.value
                      ? "border-rf-orange bg-rf-orange/10"
                      : "border-border bg-card hover:border-muted-foreground/30"
                  }`}
                  data-testid={`variation-${opt.value}`}
                >
                  <div className={`text-xs font-bold mb-1 ${
                    variation === opt.value ? "text-rf-orange" : "text-foreground"
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
            className="w-full py-3 bg-rf-orange text-black font-bold text-sm rounded-sm hover:bg-rf-orange/90 transition-colors flex items-center justify-center gap-2"
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
            <BrandMark size={32} />
            <span className="text-rf-orange font-bold text-xl tracking-wider">ROCHAMBEAU FINANCE TERMINAL</span>
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
            className="group p-6 rounded-sm border border-border bg-card hover:border-rf-green/50 hover:bg-rf-green/[0.03] transition-all text-left"
            data-testid="button-real-mode"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-sm bg-rf-green/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-rf-green" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">REAL MODE</div>
                <div className="text-2xs text-muted-foreground">Live market data</div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">
              View real-time simulated market data, track stocks, analyze charts, and monitor market movements.
            </p>
            <div className="flex items-center gap-1 text-rf-green text-xs font-medium group-hover:gap-2 transition-all">
              Enter Live Markets <ArrowRight className="w-3 h-3" />
            </div>
          </button>

          {/* Simulation Mode */}
          <button
            onClick={() => onSimClick ? onSimClick() : setPhase("settings")}
            className="group p-6 rounded-sm border border-border bg-card hover:border-rf-orange/50 hover:bg-rf-orange/[0.03] transition-all text-left"
            data-testid="button-sim-mode"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-sm bg-rf-orange/10 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-rf-orange" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">SIMULATION</div>
                <div className="text-2xs text-muted-foreground">Paper trading</div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">
              Trade with virtual currency. Control time flow, react to news events, and learn to invest risk-free.
            </p>
            <div className="flex items-center gap-1 text-rf-orange text-xs font-medium group-hover:gap-2 transition-all">
              Configure & Start <ArrowRight className="w-3 h-3" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
