import { Pause, Play, FastForward, SkipForward, Clock, Calendar, Save } from "lucide-react";
import type { TimeSpeed } from "@/hooks/use-simulation";

interface TimeControlBarProps {
  simTime: Date;
  dayNumber: number;
  timeSpeed: TimeSpeed;
  onSetSpeed: (speed: TimeSpeed) => void;
  saveName?: string;
  onSaveNameChange?: (name: string) => void;
  onManualSave?: () => void;
  saveStatus?: "idle" | "saving" | "saved" | "error";
  lastSavedAt?: Date | null;
  /** Event mode: show countdown and EVENT badge */
  eventMode?: boolean;
  totalEventDays?: number;
}

const SPEED_BUTTONS: { speed: TimeSpeed; label: string; icon: "pause" | "play" | "fast" | "skip" }[] = [
  { speed: "paused", label: "PAUSE", icon: "pause" },
  { speed: "1min", label: "1x", icon: "play" },
  { speed: "5min", label: "5x", icon: "fast" },
  { speed: "1hr", label: "1HR", icon: "skip" },
  { speed: "1day", label: "1DAY", icon: "skip" },
];

function SpeedIcon({ type, className }: { type: string; className: string }) {
  switch (type) {
    case "pause": return <Pause className={className} />;
    case "play": return <Play className={className} />;
    case "fast": return <FastForward className={className} />;
    case "skip": return <SkipForward className={className} />;
    default: return null;
  }
}

function formatSavedAgo(date: Date | null | undefined): string {
  if (!date) return "";
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export function TimeControlBar({
  simTime, dayNumber, timeSpeed, onSetSpeed,
  saveName, onSaveNameChange, onManualSave, saveStatus, lastSavedAt,
  eventMode, totalEventDays,
}: TimeControlBarProps) {
  const timeStr = simTime.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  const dateStr = simTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const hours = simTime.getHours();
  const mins = simTime.getMinutes();
  const totalMins = hours * 60 + mins;
  const isMarketHours = totalMins >= 570 && totalMins < 960; // 9:30 - 16:00

  const savedAgoStr = formatSavedAgo(lastSavedAt);

  return (
    <div className="flex items-center h-8 px-3 gap-3 bg-sidebar border-t border-b border-border shrink-0 select-none" data-testid="time-controls">
      {/* Sim/Event badge */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${eventMode ? 'bg-bb-cyan' : 'bg-bb-orange'}`} />
        <span className={`text-[10px] font-bold tracking-wider ${eventMode ? 'text-bb-cyan' : 'text-bb-orange'}`}>
          {eventMode ? 'EVENT' : 'SIM'}
        </span>
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Inline editable save name */}
      {saveName !== undefined && onSaveNameChange && (
        <>
          <div className="flex items-center gap-1 shrink-0 max-w-[120px]">
            <Save className="w-3 h-3 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={saveName}
              onChange={(e) => onSaveNameChange(e.target.value)}
              className="bg-transparent text-2xs font-bold text-foreground border-none outline-none w-full truncate placeholder:text-muted-foreground"
              placeholder="Untitled"
              maxLength={30}
              data-testid="save-name-input"
            />
          </div>
          <div className="w-px h-4 bg-border" />
        </>
      )}

      {/* Day counter / Event countdown */}
      <div className="flex items-center gap-1 shrink-0">
        <Calendar className={`w-3 h-3 ${eventMode ? 'text-bb-cyan' : 'text-muted-foreground'}`} />
        {eventMode && totalEventDays ? (
          <>
            <span className="text-2xs text-bb-cyan font-bold">DAYS LEFT</span>
            <span className="text-2xs font-bold text-bb-cyan tabular-nums">
              {Math.max(0, totalEventDays - dayNumber)}
            </span>
          </>
        ) : (
          <>
            <span className="text-2xs text-muted-foreground">DAY</span>
            <span className="text-2xs font-bold text-foreground">{dayNumber}</span>
          </>
        )}
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Sim clock */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Clock className="w-3 h-3 text-muted-foreground" />
        <span className="text-2xs text-muted-foreground">{dateStr}</span>
        <span className="text-xs font-bold text-foreground tabular-nums">{timeStr}</span>
        <span className="text-2xs text-muted-foreground">ET</span>
        {isMarketHours ? (
          <span className="text-[9px] font-bold text-bb-green ml-1">OPEN</span>
        ) : (
          <span className="text-[9px] font-bold text-bb-red ml-1">CLOSED</span>
        )}
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Speed controls */}
      <div className="flex items-center gap-1">
        {SPEED_BUTTONS.map(btn => (
          <button
            key={btn.speed}
            onClick={() => onSetSpeed(btn.speed)}
            className={`flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold transition-all ${
              timeSpeed === btn.speed
                ? "bg-bb-orange/20 text-bb-orange border border-bb-orange/30"
                : "text-muted-foreground hover:text-foreground hover:bg-white/[0.04] border border-transparent"
            }`}
            data-testid={`speed-${btn.speed}`}
          >
            <SpeedIcon type={btn.icon} className="w-2.5 h-2.5" />
            {btn.label}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* Manual SAVE button */}
      {onManualSave && (
        <button
          onClick={onManualSave}
          disabled={saveStatus === "saving"}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-bold transition-all border shrink-0 ${
            saveStatus === "saving"
              ? "text-muted-foreground border-border cursor-wait"
              : saveStatus === "saved"
              ? "text-bb-green border-bb-green/30 bg-bb-green/10"
              : saveStatus === "error"
              ? "text-bb-red border-bb-red/30 bg-bb-red/10"
              : "text-muted-foreground border-border hover:text-foreground hover:bg-white/[0.04]"
          }`}
          data-testid="manual-save-btn"
        >
          <Save className="w-2.5 h-2.5" />
          {saveStatus === "saving" ? "SAVING…" : saveStatus === "saved" ? "SAVED" : "SAVE"}
        </button>
      )}

      {/* Save status indicator */}
      {lastSavedAt && savedAgoStr && (
        <div className="flex items-center gap-1 shrink-0">
          <div className={`w-1 h-1 rounded-full ${
            saveStatus === "error" ? "bg-bb-red" : saveStatus === "saving" ? "bg-yellow-500 animate-pulse" : "bg-bb-green"
          }`} />
          <span className="text-[9px] text-muted-foreground">
            Saved {savedAgoStr}
          </span>
        </div>
      )}

      {/* Speed indicator */}
      {timeSpeed !== "paused" && (
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-1 h-1 rounded-full bg-bb-green animate-pulse" />
          <span className="text-[9px] text-bb-green font-bold">RUNNING</span>
        </div>
      )}
    </div>
  );
}
