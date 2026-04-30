import { useState, useEffect } from "react";
import { Zap, X, ArrowRight, Clock, Trophy } from "lucide-react";
import { getCurrentEvent, getEventTimeRemaining, type EventDefinition } from "@/lib/events";

interface EventBannerProps {
  onJoinEvent: (event: EventDefinition) => void;
}

export function EventBanner({ onJoinEvent }: EventBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const event = getCurrentEvent();

  // Update countdown every minute
  useEffect(() => {
    setTimeLeft(getEventTimeRemaining(event));
    const interval = setInterval(() => {
      setTimeLeft(getEventTimeRemaining(event));
    }, 60_000);
    return () => clearInterval(interval);
  }, [event.eventKey]);

  if (dismissed) return null;

  return (
    <div
      className="relative overflow-hidden rounded-sm border border-bb-cyan/30 bg-gradient-to-r from-bb-cyan/[0.08] via-bb-cyan/[0.04] to-transparent mb-6"
      data-testid="event-banner"
    >
      {/* Animated glow line at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[1px]"
        style={{
          background: "linear-gradient(90deg, transparent, hsl(187, 80%, 55%), transparent)",
          animation: "eventGlow 3s ease-in-out infinite",
        }}
      />

      <div className="flex items-center gap-4 px-4 py-3">
        {/* Icon + Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative">
            <div className="w-9 h-9 rounded-sm bg-bb-cyan/15 flex items-center justify-center border border-bb-cyan/20">
              <Trophy className="w-4.5 h-4.5 text-bb-cyan" />
            </div>
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-bb-cyan rounded-full animate-pulse" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold tracking-[0.2em] text-bb-cyan bg-bb-cyan/15 px-1.5 py-0.5 rounded-sm border border-bb-cyan/20">
                NEW
              </span>
              <span className="text-[9px] font-bold tracking-wider text-muted-foreground">
                LIMITED TIME EVENT
              </span>
            </div>
            <span className="text-sm font-bold text-foreground mt-0.5 tracking-wide">
              {event.name}
            </span>
          </div>
        </div>

        {/* Description + Meta */}
        <div className="flex-1 min-w-0 hidden sm:block">
          <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">
            {event.description}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[9px] text-muted-foreground flex items-center gap-1">
              <Zap className="w-2.5 h-2.5 text-bb-cyan" />
              {event.durationDays} day{event.durationDays !== 1 ? "s" : ""}
            </span>
            <span className="text-[9px] text-muted-foreground">
              ${event.startingCash.toLocaleString()} start
            </span>
            <span className="text-[9px] text-muted-foreground capitalize">
              {event.variation} volatility
            </span>
            {event.allowedSymbols && (
              <span className="text-[9px] text-muted-foreground">
                {event.allowedSymbols.length} stocks
              </span>
            )}
          </div>
        </div>

        {/* Timer + CTA */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right hidden sm:block">
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
              <Clock className="w-2.5 h-2.5" />
              <span>Ends in</span>
            </div>
            <span className="text-xs font-bold text-bb-cyan tabular-nums">{timeLeft}</span>
          </div>
          <button
            onClick={() => onJoinEvent(event)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-sm bg-bb-cyan text-black text-xs font-bold hover:bg-bb-cyan/90 transition-all group"
            data-testid="join-event-btn"
          >
            JOIN EVENT
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded-sm text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-colors"
            data-testid="dismiss-event-banner"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* CSS animation */}
      <style>{`
        @keyframes eventGlow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
