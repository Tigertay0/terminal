import { useState, useEffect, useRef } from "react";
import { Trophy, Clock, TrendingUp, TrendingDown, Minus, Users } from "lucide-react";
import { subscribeToLeaderboard, type EventParticipantRow } from "@/lib/supabase";
import { getEventTimeRemaining, type EventDefinition } from "@/lib/events";

interface EventLeaderboardProps {
  event: EventDefinition;
  userId: string;
}

function formatCurrency(val: number): string {
  if (val >= 0) return `+$${Math.abs(val).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  return `-$${Math.abs(val).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getRankBadge(rank: number) {
  if (rank === 1) return <span className="text-yellow-400">🥇</span>;
  if (rank === 2) return <span className="text-gray-300">🥈</span>;
  if (rank === 3) return <span className="text-amber-600">🥉</span>;
  return <span className="text-[10px] text-muted-foreground font-mono w-5 text-center">{rank}</span>;
}

export function EventLeaderboard({ event, userId }: EventLeaderboardProps) {
  const [participants, setParticipants] = useState<EventParticipantRow[]>([]);
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

  const userRank = participants.findIndex(p => p.user_id === userId) + 1;

  return (
    <div className="bb-panel flex flex-col h-full" data-testid="event-leaderboard">
      {/* Header */}
      <div className="bg-[hsl(var(--bb-panel-header))] px-2 py-1.5 border-b border-border">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-1">
            <Trophy className="w-3 h-3 text-bb-cyan" />
            <span className="text-[10px] font-bold text-bb-cyan tracking-wider">LEADERBOARD</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-2.5 h-2.5 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground">Ends in</span>
            <span className="text-[10px] font-bold text-bb-cyan tabular-nums">{timeLeft}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-foreground font-medium">{event.name}</span>
          <div className="flex items-center gap-1">
            <Users className="w-2.5 h-2.5 text-muted-foreground" />
            <span className="text-[9px] text-muted-foreground">{participants.length} players</span>
          </div>
        </div>
        {userRank > 0 && (
          <div className="flex items-center gap-1 mt-1 bg-bb-cyan/10 border border-bb-cyan/20 rounded-sm px-1.5 py-0.5">
            <span className="text-[9px] text-bb-cyan font-bold">YOUR RANK:</span>
            <span className="text-[10px] text-bb-cyan font-bold">#{userRank}</span>
            <span className="text-[9px] text-muted-foreground">of {participants.length}</span>
          </div>
        )}
      </div>

      {/* Column Headers */}
      <div className="flex items-center px-2 py-1 border-b border-border/50 bg-white/[0.01]">
        <span className="w-6 text-[8px] font-bold text-muted-foreground tracking-wider">#</span>
        <span className="flex-1 text-[8px] font-bold text-muted-foreground tracking-wider">PLAYER</span>
        <span className="w-12 text-[8px] font-bold text-muted-foreground tracking-wider text-center">DAY</span>
        <span className="w-20 text-[8px] font-bold text-muted-foreground tracking-wider text-right">PROFIT</span>
      </div>

      {/* Participant Rows */}
      <div className="flex-1 overflow-y-auto bb-scrollbar" ref={scrollRef}>
        {participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center px-4">
            <Trophy className="w-6 h-6 text-muted-foreground/30 mb-2" />
            <div className="text-[11px] text-muted-foreground">No participants yet</div>
            <div className="text-[10px] text-muted-foreground/60 mt-1">Be the first to join!</div>
          </div>
        ) : (
          participants.map((p, i) => {
            const rank = i + 1;
            const isCurrentUser = p.user_id === userId;
            const isPositive = p.profit >= 0;
            const isCompleted = p.status === "completed";

            return (
              <div
                key={p.id}
                className={`flex items-center px-2 py-1.5 border-b border-border/30 transition-colors ${
                  isCurrentUser
                    ? "bg-bb-cyan/[0.06] border-l-2 border-l-bb-cyan"
                    : "hover:bg-white/[0.02]"
                } ${rank <= 3 ? "bg-white/[0.01]" : ""}`}
                data-testid={`leaderboard-row-${p.id}`}
              >
                <div className="w-6 flex items-center justify-center shrink-0">
                  {getRankBadge(rank)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={`text-[11px] font-medium truncate ${
                      isCurrentUser ? "text-bb-cyan font-bold" : "text-foreground"
                    }`}>
                      {p.display_name}
                    </span>
                    {isCurrentUser && (
                      <span className="text-[8px] bg-bb-cyan/20 text-bb-cyan px-1 rounded-sm font-bold">YOU</span>
                    )}
                    {isCompleted && (
                      <span className="text-[8px] bg-bb-green/20 text-bb-green px-1 rounded-sm font-bold">DONE</span>
                    )}
                  </div>
                </div>
                <div className="w-12 text-center shrink-0">
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {p.current_day}
                  </span>
                </div>
                <div className="w-20 text-right shrink-0">
                  <div className={`text-[10px] font-bold tabular-nums flex items-center justify-end gap-0.5 ${
                    isPositive ? "text-bb-green" : p.profit < 0 ? "text-bb-red" : "text-muted-foreground"
                  }`}>
                    {isPositive && p.profit > 0 ? (
                      <TrendingUp className="w-2.5 h-2.5" />
                    ) : p.profit < 0 ? (
                      <TrendingDown className="w-2.5 h-2.5" />
                    ) : (
                      <Minus className="w-2.5 h-2.5" />
                    )}
                    {formatCurrency(p.profit)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
