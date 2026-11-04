import type { ReactNode } from "react";
import { Wordmark } from "@/components/BrandMark";

interface EntryFrameProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  width?: "narrow" | "wide";
  testId?: string;
}

/** Shared frame for the screens before the terminal: mode select, setup and saves. */
export function EntryFrame({ title, subtitle, children, width = "wide", testId }: EntryFrameProps) {
  return (
    <div className="h-screen overflow-y-auto bg-background flex flex-col" data-testid={testId}>
      <header className="h-16 px-6 sm:px-12 flex items-center shrink-0 border-b border-border">
        <Wordmark size={20} />
      </header>
      <main className="flex-1 flex items-center px-6 sm:px-12 py-12">
        <div className={`w-full mx-auto rise-in ${width === "narrow" ? "max-w-[560px]" : "max-w-[880px]"}`}>
          <h1 className="text-3xl font-medium leading-tight tracking-[-0.02em] text-foreground">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-dim">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
