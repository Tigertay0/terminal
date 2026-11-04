import { useState, useRef, useEffect } from "react";
import { ChevronRight } from "lucide-react";

interface CommandBarProps {
  onCommand: (cmd: string) => void;
  commandHistory: string[];
}

export function CommandBar({ onCommand, commandHistory }: CommandBarProps) {
  const [input, setInput] = useState("");
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && input.trim()) {
      onCommand(input.trim().toUpperCase());
      setInput("");
      setHistoryIdx(-1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIdx = Math.min(historyIdx + 1, commandHistory.length - 1);
        setHistoryIdx(newIdx);
        setInput(commandHistory[commandHistory.length - 1 - newIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIdx > 0) {
        const newIdx = historyIdx - 1;
        setHistoryIdx(newIdx);
        setInput(commandHistory[commandHistory.length - 1 - newIdx]);
      } else {
        setHistoryIdx(-1);
        setInput("");
      }
    } else if (e.key === "Escape") {
      inputRef.current?.blur();
    }
  };

  // Focus on slash key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex items-center h-9 px-3 gap-2 bg-sidebar border-t border-border shrink-0" data-testid="command-bar">
      <ChevronRight className="w-4 h-4 text-ink shrink-0" strokeWidth={1.5} />
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Symbol or command"
        aria-label="Command"
        className="num bg-transparent text-foreground text-xs w-full outline-none placeholder:font-sans placeholder:text-muted-foreground"
        data-testid="input-command"
      />
      <span className="flex items-center gap-1 text-2xs text-muted-foreground shrink-0">
        {focused ? (
          <><span className="kbd">↵</span> run <span className="kbd ml-2">↑</span> history</>
        ) : (
          <><span className="kbd">/</span> to type</>
        )}
      </span>
      <div className="w-px h-4 bg-border mx-2" />
      <span className="text-2xs text-muted-foreground shrink-0 whitespace-nowrap">Created by Adetayo Agueh</span>
    </div>
  );
}
