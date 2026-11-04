import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { getCurrentEvent, getEventTimeRemaining, type EventDefinition } from "@/lib/events";

interface EventBannerProps {
  onJoinEvent: (event: EventDefinition) => void;
}

const VOLATILITY: Record<string, string> = { low: "Low volatility", realistic: "Realistic volatility", high: "High volatility" };

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

  const facts = [
    `${event.durationDays} trading day${event.durationDays !== 1 ? "s" : ""}`,
    `$${event.startingCash.toLocaleString("en-US")} to start`,
    VOLATILITY[event.variation] ?? event.variation,
    event.allowedSymbols ? `${event.allowedSymbols.length} stocks` : "Every stock",
  ];

  return (
    <section className="relative rounded-lg border border-border bg-card p-5 mb-4" aria-label="Current event" data-testid="event-banner">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-raised transition-colors"
        aria-label="Hide event"
        data-testid="dismiss-event-banner"
      >
        <X className="w-4 h-4" strokeWidth={1.5} />
      </button>

      <div className="flex flex-col md:flex-row md:items-end gap-5 md:gap-8 pr-8">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">
            Event · ends in <span className="num text-dim">{timeLeft}</span>
          </p>
          <h2 className="mt-2 text-base font-medium text-foreground">{event.name}</h2>
          <p className="mt-1 text-sm text-dim">{event.description}</p>
          <p className="mt-3 text-xs text-muted-foreground">{facts.join(" · ")}</p>
          {event.prize && <p className="mt-1 text-xs text-dim">{event.prize}</p>}
        </div>
        <button
          onClick={() => onJoinEvent(event)}
          className="h-10 px-5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] transition-[background-color,transform] shrink-0 self-start md:self-end"
          data-testid="join-event-btn"
        >
          Join event
        </button>
      </div>
    </section>
  );
}
