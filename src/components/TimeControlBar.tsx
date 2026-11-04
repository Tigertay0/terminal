import { Pause, Play, FastForward, SkipForward, Save } from "lucide-react";
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
  /** Event mode: show days left instead of the day counter */
  eventMode?: boolean;
  totalEventDays?: number;
}

const SPEED_BUTTONS: { speed: TimeSpeed; label: string; title: string; icon: typeof Pause }[] = [
  { speed: "paused", label: "Pause", title: "Pause the market", icon: Pause },
  { speed: "1min", label: "1×", title: "One market minute per second", icon: Play },
  { speed: "5min", label: "5×", title: "Five market minutes per second", icon: FastForward },
  { speed: "1hr", label: "1 hour", title: "One market hour per second", icon: SkipForward },
  { speed: "1day", label: "1 day", title: "One trading day per second", icon: SkipForward },
];

function formatSavedAgo(date: Date | null | undefined): string {
  if (!date) return "";
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

const SAVE_LABEL = { idle: "Save", saving: "Saving", saved: "Saved", error: "Save failed" } as const;

export function TimeControlBar({
  simTime, dayNumber, timeSpeed, onSetSpeed,
  saveName, onSaveNameChange, onManualSave, saveStatus = "idle", lastSavedAt,
  eventMode, totalEventDays,
}: TimeControlBarProps) {
  const timeStr = simTime.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" });
  const dateStr = simTime.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  const totalMins = simTime.getHours() * 60 + simTime.getMinutes();
  const isMarketHours = totalMins >= 570 && totalMins < 960; // 9:30 - 16:00

  const savedAgoStr = formatSavedAgo(lastSavedAt);
  const daysLeft = totalEventDays ? Math.max(0, totalEventDays - dayNumber) : 0;

  return (
    <div className="flex items-center h-10 px-3 gap-4 bg-sidebar border-b border-border shrink-0 select-none text-xs" data-testid="time-controls">
      {saveName !== undefined && onSaveNameChange ? (
        <input
          type="text"
          value={saveName}
          onChange={(e) => onSaveNameChange(e.target.value)}
          className="h-7 w-40 px-2 -ml-2 rounded-md bg-transparent font-medium text-foreground outline-none hover:bg-raised focus:bg-raised transition-colors placeholder:text-muted-foreground"
          placeholder="Untitled"
          aria-label="Save name"
          maxLength={30}
          data-testid="save-name-input"
        />
      ) : (
        <span className="font-medium text-foreground">{eventMode ? "Event" : "Simulation"}</span>
      )}

      <div className="w-px h-4 bg-border" />

      <div className="flex items-baseline gap-2 shrink-0">
        {eventMode && totalEventDays ? (
          <>
            <span className="text-muted-foreground">Days left</span>
            <span className="num text-foreground">{daysLeft}</span>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">Day</span>
            <span className="num text-foreground">{dayNumber}</span>
          </>
        )}
      </div>

      <div className="flex items-baseline gap-2 shrink-0">
        <span className="text-muted-foreground">{dateStr}</span>
        <span className="num text-foreground">{timeStr}</span>
        <span className="text-2xs text-muted-foreground">ET</span>
        <span className={isMarketHours ? "text-foreground" : "text-muted-foreground"}>{isMarketHours ? "Open" : "Closed"}</span>
      </div>

      <div className="w-px h-4 bg-border" />

      <div className="rf-segmented" role="group" aria-label="Market speed">
        {SPEED_BUTTONS.map(({ speed, label, title, icon: Icon }) => {
          const active = timeSpeed === speed;
          return (
            <button
              key={speed}
              aria-pressed={active}
              title={title}
              onClick={() => onSetSpeed(speed)}
              className="rf-segment"
              data-testid={`speed-${speed}`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex-1" />

      {timeSpeed !== "paused" && (
        <span className="flex items-center gap-2 text-dim shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-up" />
          Running
        </span>
      )}

      {lastSavedAt && savedAgoStr && saveStatus !== "error" && (
        <span className="text-muted-foreground shrink-0">Saved {savedAgoStr}</span>
      )}

      {onManualSave && (
        <button
          onClick={onManualSave}
          disabled={saveStatus === "saving"}
          className={`flex items-center gap-2 h-7 px-2 rounded-md border border-border transition-colors shrink-0 disabled:cursor-wait ${
            saveStatus === "error" ? "text-down" : "text-dim hover:text-foreground hover:bg-raised"
          }`}
          data-testid="manual-save-btn"
        >
          <Save className="w-3.5 h-3.5" strokeWidth={1.5} />
          {SAVE_LABEL[saveStatus]}
        </button>
      )}
    </div>
  );
}
