import { useState } from "react";
import {
  GraduationCap, ArrowRight, ArrowLeft, X, Play, ShoppingCart,
  TrendingUp, Newspaper, Clock, Wallet, CheckCircle
} from "lucide-react";

interface TutorialProps {
  onComplete: () => void;
}

interface TutorialStep {
  title: string;
  content: string;
  icon: typeof GraduationCap;
  highlight?: string; // data-testid to highlight
  tip?: string;
}

const STEPS: TutorialStep[] = [
  {
    title: "Welcome to Simulation Mode",
    content: "You've been given virtual cash to practice investing. Your goal is to grow your portfolio by buying low and selling high. This tutorial will walk you through the basics.",
    icon: GraduationCap,
    tip: "No real money is at risk — experiment freely!",
  },
  {
    title: "The Time Controls",
    content: "Unlike real markets, you control time here. Use the time control bar to pause, advance at 1x speed (1 minute per second), 5x speed, skip 1 hour, or skip an entire trading day — just like in a city-builder game.",
    icon: Clock,
    highlight: "time-controls",
    tip: "Start paused, study the market, then let time flow.",
  },
  {
    title: "Reading the Market",
    content: "The watchlist on the left shows stock prices and daily changes. Green means the price is up, red means it's down. Click any stock to see its chart and detailed metrics.",
    icon: TrendingUp,
    highlight: "watchlist",
    tip: "Look for stocks with strong momentum (big green % changes).",
  },
  {
    title: "Following the News",
    content: "The news panel shows breaking events that affect stock prices. Bullish news (green arrow) tends to push prices up — that's a buy signal. Bearish news (red arrow) suggests selling. React to news before the market fully prices it in!",
    icon: Newspaper,
    highlight: "sim-news-feed",
    tip: "Breaking ALERT news has the biggest price impact.",
  },
  {
    title: "Making Your First Trade",
    content: "Select a stock from the watchlist, then go to the Portfolio panel's TRADE tab. Choose BUY or SELL, enter the number of shares, and hit execute. Use the % buttons to quickly set share amounts.",
    icon: ShoppingCart,
    highlight: "portfolio-panel",
    tip: "Don't go all-in on one stock. Diversify your portfolio!",
  },
  {
    title: "Tracking Your Portfolio",
    content: "The Portfolio panel shows your total value, cash balance, and all your holdings with real-time P&L (profit and loss). The HISTORY tab records every trade you've made.",
    icon: Wallet,
    highlight: "portfolio-panel",
    tip: "Watch your Total P&L — try to beat the starting amount!",
  },
  {
    title: "You're Ready!",
    content: "Start the simulation by pressing PLAY on the time controls. Watch for news, spot opportunities, and build your portfolio. Remember: buy when others are fearful, sell when others are greedy. Good luck!",
    icon: CheckCircle,
    tip: "Pro tip: Start with 1x speed to get familiar, then increase.",
  },
];

export function Tutorial({ onComplete }: TutorialProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" />

      {/* Tutorial card */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="tutorial-overlay">
        <div className="w-full max-w-md bg-card border border-border rounded-sm shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-[hsl(var(--bb-panel-header))]">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-bb-orange" />
              <span className="text-xs font-bold text-bb-orange tracking-wider">TUTORIAL</span>
              <span className="text-[10px] text-muted-foreground ml-2">
                {step + 1} / {STEPS.length}
              </span>
            </div>
            <button
              onClick={onComplete}
              className="text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-skip-tutorial"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-0.5 bg-border">
            <div
              className="h-full bg-bb-orange transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>

          {/* Content */}
          <div className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-sm bg-bb-orange/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-bb-orange" />
              </div>
              <h3 className="text-sm font-bold text-foreground">{current.title}</h3>
            </div>

            <p className="text-[12px] text-muted-foreground leading-relaxed mb-4">
              {current.content}
            </p>

            {current.tip && (
              <div className="bg-bb-orange/[0.06] border border-bb-orange/20 rounded-sm px-3 py-2 mb-4">
                <div className="text-[10px] font-bold text-bb-orange mb-0.5">TIP</div>
                <div className="text-[11px] text-foreground/80">{current.tip}</div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-[hsl(var(--bb-panel-header))]">
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              data-testid="button-prev"
            >
              <ArrowLeft className="w-3 h-3" />
              Back
            </button>

            <button
              onClick={onComplete}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              data-testid="button-skip"
            >
              Skip Tutorial
            </button>

            <button
              onClick={() => isLast ? onComplete() : setStep(s => s + 1)}
              className="flex items-center gap-1 px-3 py-1.5 bg-bb-orange text-black text-xs font-bold rounded-sm hover:bg-bb-orange/90 transition-colors"
              data-testid="button-next"
            >
              {isLast ? "Start Trading" : "Next"}
              {isLast ? <Play className="w-3 h-3" /> : <ArrowRight className="w-3 h-3" />}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
