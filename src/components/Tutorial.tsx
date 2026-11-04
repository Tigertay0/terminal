import { useEffect, useState } from "react";
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
    title: "How the simulation works",
    content: "You start with virtual cash and today's real prices. Grow the portfolio by buying and selling as the simulated market moves. This walkthrough covers the basics.",
    icon: GraduationCap,
    tip: "No real money is involved, so try things",
  },
  {
    title: "The time controls",
    content: "You control the clock here. Pause, run at one market minute per second (1×) or five (5×), or jump ahead an hour or a whole trading day.",
    icon: Clock,
    highlight: "time-controls",
    tip: "Start paused, look around, then let time run",
  },
  {
    title: "Reading the market",
    content: "The watchlist on the left shows each stock's last price and today's change: green is up, red is down. Select a stock to see its chart and numbers.",
    icon: TrendingUp,
    highlight: "watchlist",
    tip: "Strong momentum shows up as large green changes",
  },
  {
    title: "Following the news",
    content: "The news panel shows events that move prices. Bullish stories tend to push a stock up and bearish ones push it down. Act before the market prices them in.",
    icon: Newspaper,
    highlight: "sim-news-feed",
    tip: "Breaking stories move prices the most",
  },
  {
    title: "Making a trade",
    content: "Select a stock, open the Trade tab in the portfolio panel, choose Buy or Sell, enter the number of shares and confirm. The percentage buttons fill in a share amount for you.",
    icon: ShoppingCart,
    highlight: "portfolio-panel",
    tip: "Spread your cash across several stocks instead of one",
  },
  {
    title: "Tracking your portfolio",
    content: "The portfolio panel shows total value, cash and each holding's profit and loss. The History tab lists every trade you've made.",
    icon: Wallet,
    highlight: "portfolio-panel",
    tip: "The goal is to finish above your starting cash",
  },
  {
    title: "Ready to trade",
    content: "Press 1× in the time controls to start the market. Watch the news, look for openings and build your portfolio.",
    icon: CheckCircle,
    tip: "Start at 1× to get a feel for it, then speed up",
  },
];

export function Tutorial({ onComplete }: TutorialProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onComplete(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onComplete]);

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="tutorial-overlay">
        <div role="dialog" aria-modal="true" aria-labelledby="tutorial-title" className="w-full max-w-md bg-popover border border-border rounded-lg shadow-xl rise-in overflow-hidden">
          <div className="flex items-center justify-between h-11 px-4 border-b border-border">
            <span className="text-xs text-dim">
              Walkthrough <span className="num text-muted-foreground ml-2">{step + 1} of {STEPS.length}</span>
            </span>
            <button
              onClick={onComplete}
              className="h-7 w-7 -mr-2 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-raised transition-colors"
              aria-label="Close walkthrough"
              data-testid="button-skip-tutorial"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>

          <div className="h-0.5 bg-raised">
            <div
              className="h-full bg-primary origin-left transition-transform duration-300"
              style={{ transform: `scaleX(${(step + 1) / STEPS.length})` }}
            />
          </div>

          <div className="p-5">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-md border border-border flex items-center justify-center text-dim shrink-0">
                <Icon className="w-4 h-4" strokeWidth={1.5} />
              </span>
              <h3 id="tutorial-title" className="text-base font-medium text-foreground">{current.title}</h3>
            </div>

            <p className="mt-4 text-sm text-dim leading-relaxed">{current.content}</p>

            {current.tip && (
              <div className="mt-4 rounded-md bg-raised px-3 py-2">
                <div className="text-2xs text-muted-foreground">Tip</div>
                <div className="text-xs text-foreground mt-1">{current.tip}</div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-border">
            <button
              onClick={() => setStep(s => s - 1)}
              disabled={step === 0}
              className="h-8 px-3 rounded-md flex items-center gap-2 text-xs text-dim hover:text-foreground hover:bg-raised disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              data-testid="button-prev"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              Back
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onComplete}
                className="h-8 px-3 rounded-md text-xs text-dim hover:text-foreground hover:bg-raised transition-colors"
                data-testid="button-skip"
              >
                Skip
              </button>
              <button
                onClick={() => isLast ? onComplete() : setStep(s => s + 1)}
                autoFocus
                className="h-8 px-3 rounded-md flex items-center gap-2 bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 active:scale-[0.98] transition-[background-color,transform]"
                data-testid="button-next"
              >
                {isLast ? "Start trading" : "Next"}
                {isLast ? <Play className="w-4 h-4" strokeWidth={1.5} /> : <ArrowRight className="w-4 h-4" strokeWidth={1.5} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
