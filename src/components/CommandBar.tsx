import { useState, useRef, useEffect } from "react";
import { Terminal, ChevronRight } from "lucide-react";

interface CommandBarProps {
  onCommand: (cmd: string) => void;
  commandHistory: string[];
}

export function CommandBar({ onCommand, commandHistory }: CommandBarProps) {
  const [input, setInput] = useState("");
  const [historyIdx, setHistoryIdx] = useState(-1);
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
    <div className="flex items-center h-7 px-2 gap-2 bg-[hsl(220,16%,5%)] border-t border-border shrink-0" data-testid="command-bar">
      <Terminal className="w-3 h-3 text-bb-orange shrink-0" />
      <ChevronRight className="w-3 h-3 text-bb-orange shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type ticker symbol or command... (press /)"
        className="bg-transparent text-foreground text-[11px] font-mono w-full outline-none placeholder:text-muted-foreground/50"
        data-testid="input-command"
      />
      <span className="text-2xs text-muted-foreground/40 shrink-0 font-mono">/</span>
      <div className="w-px h-3 bg-border mx-1" />
      <a
        href="https://www.perplexity.ai/computer"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[9px] text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors shrink-0 whitespace-nowrap"
      >
        Created with Perplexity Computer
      </a>
    </div>
  );
}
