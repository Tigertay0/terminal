import { useState, useEffect, useRef } from "react";
import { subscribeToLeaderboard, type LeaderboardEntry } from "@/lib/user-data";
import { getEventTimeRemaining, type EventDefinition } from "@/lib/events";

interface EventLeaderboardProps {
  event: EventDefinition;
}

function formatCurrency(val: number): string {
  if (val >= 0) return `+$${Math.abs(val).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return `-$${Math.abs(val).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getRankBadge(rank: number) {
  const tone = rank <= 3 ? "text-foreground font-medium" : "text-muted-foreground";
  return <span className={`num text-xs ${tone}`}>{rank}</span>;
}

export function EventLeaderboard({ event }: EventLeaderboardProps) {
  const [participants, setParticipants] = useState<LeaderboardEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Subscribe to realtime leaderboard
  useEffect(() => {
    const unsub = subscribeToLeaderboard(event.eventKey, (data) => {
      setParticipants(data);
    });
    return unsub;
  }, [event.eventKey]);

  // Update countdown every minute
  useEffect(() => {
    setTimeLeft(getEventTimeRemaining(event));
    const interval = setInterval(() => {
      setTimeLeft(getEventTimeRemaining(event));
    }, 60_000);
    return () => clearInterval(interval);
  }, [event.eventKey]);

  const userRank = participants.findIndex(p => p.is_you) + 1;

  return (
    <div className="rf-panel flex flex-col h-full" data-testid="event-leaderboard">
      {/* Header */}
      <div className="rf-panel-header">
        <span className="rf-panel-title">Leaderboard</span>
        <span className="text-2xs text-muted-foreground">
          Ends in <span className="num">{timeLeft}</span>
        </span>
      </div>
      <div className="flex items-center justify-between h-8 px-3 border-b border-border">
        <span className="text-xs text-dim truncate">{event.name}</span>
        <span className="text-2xs text-muted-foreground shrink-0">
          <span className="num">{participants.length}</span> players
        </span>
      </div>
      {userRank > 0 && (
        <div className="px-3 py-2 text-xs text-dim border-b border-border">
          Your rank <span className="num">#{userRank}</span> of <span className="num">{participants.length}</span>
        </div>
      )}

      {/* Column Headers */}
      <div className="sticky top-0 z-10 flex items-center h-7 px-3 border-b border-border bg-card text-2xs text-muted-foreground">
        <span className="w-8">#</span>
        <span className="flex-1">Player</span>
        <span className="w-12 text-center">Day</span>
        <span className="w-20 text-right">Profit</span>
      </div>

      {/* Participant Rows */}
      <div className="flex-1 overflow-y-auto rf-scrollbar" ref={scrollRef}>
        {participants.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">Nobody has joined yet</p>
        ) : (
          participants.map((p, i) => {
            const rank = i + 1;
            const isCurrentUser = p.is_you;
            const isCompleted = p.status === "completed";
            const profitTone = p.profit > 0 ? "text-up" : p.profit < 0 ? "text-down" : "text-muted-foreground";

            return (
              <div
                key={p.id}
                className={`flex items-center min-h-8 px-3 py-2 border-b border-border/60 transition-colors ${
                  isCurrentUser ? "bg-raised rf-marker" : "hover:bg-raised/60"
                }`}
                data-testid={`leaderboard-row-${p.id}`}
              >
                <div className="w-8 shrink-0">{getRankBadge(rank)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs truncate ${isCurrentUser ? "text-foreground font-medium" : "text-foreground"}`}>
                      {p.display_name}
                    </span>
                    {isCurrentUser && (
                      <span className="text-2xs text-muted-foreground shrink-0">You</span>
                    )}
                    {isCompleted && (
                      <span className="text-2xs text-muted-foreground shrink-0">Finished</span>
                    )}
                  </div>
                </div>
                <div className="w-12 text-center shrink-0">
                  <span className="num text-xs text-muted-foreground">{p.current_day}</span>
                </div>
                <div className="w-20 text-right shrink-0">
                  <span className={`num text-xs ${profitTone}`}>{formatCurrency(p.profit)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
