import { useState } from "react";
import { supabase } from "@/lib/supabase";

interface AuthScreenProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, password: string, displayName?: string) => Promise<void>;
  onSkip: () => void;
  error: string | null;
}

export function AuthScreen({ onLogin, onSignup, onSkip, error }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleEmailContinue = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!email) return;
    setStep("password");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setLocalError(null);
    try {
      if (mode === "login") {
        await onLogin(email, password);
      } else {
        await onSignup(email, password, displayName || undefined);
      }
    } catch (err: any) {
      setLocalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setLocalError(null);
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });
      if (error) {
        // Provide a clearer message for common issues
        if (error.message?.includes("provider") || error.message?.includes("not enabled")) {
          throw new Error("Google sign-in is not configured. Please use email/password or continue as guest.");
        }
        throw error;
      }
    } catch (err: any) {
      setLocalError(err.message || "Google sign-in unavailable. Please use email/password or continue as guest.");
      setSubmitting(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground select-none relative overflow-hidden">
      {/* subtle terminal grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(36, 100%, 50%) 1px, transparent 1px), linear-gradient(to bottom, hsl(36, 100%, 50%) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Top bar logo */}
      <header className="px-6 py-5 flex items-center justify-between shrink-0 z-10">
        <div className="flex items-center gap-2">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-label="Bloomberg Terminal">
            <rect x="2" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" />
            <rect x="14" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.7" />
            <rect x="2" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.5" />
            <rect x="14" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.3" />
          </svg>
          <span className="text-bb-orange font-bold text-xs tracking-[0.2em] font-mono">BLOOMBERG</span>
          <span className="text-muted-foreground text-xs tracking-[0.2em] font-mono">TERMINAL</span>
        </div>

        {/* live status */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-bb-green animate-pulse" />
          <span className="text-[10px] tracking-[0.2em] font-mono text-muted-foreground">SECURE CONNECTION</span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 z-10">
        <div className="w-full max-w-[420px] py-12">
          {/* Welcome heading */}
          <div className="text-center mb-10">
            <h1
              className="text-3xl font-light tracking-tight text-foreground mb-3"
              style={{ fontFamily: "'IBM Plex Serif', Georgia, serif", fontWeight: 300 }}
            >
              Welcome to <span className="text-bb-orange italic">terminal</span>
            </h1>
            <p className="text-sm text-muted-foreground font-mono">
              Real-time markets · paper trading · simulation
            </p>
          </div>

          {/* Auth options */}
          <div className="space-y-3">
            {/* Google */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={submitting}
              className="w-full h-11 flex items-center justify-center gap-3 bg-card border border-border hover:border-bb-orange/50 hover:bg-accent transition-colors disabled:opacity-50 group"
              data-testid="button-google"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="text-sm font-mono text-foreground">Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] tracking-[0.2em] font-mono text-muted-foreground">OR</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Email step */}
            {step === "email" ? (
              <form onSubmit={handleEmailContinue} className="space-y-3">
                <div>
                  <label className="block text-[10px] tracking-[0.2em] font-mono text-muted-foreground mb-1.5">
                    EMAIL
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    autoFocus
                    className="w-full h-11 bg-card border border-border focus:border-bb-orange px-3 text-sm text-foreground font-mono outline-none transition-colors placeholder:text-muted-foreground/50"
                    data-testid="input-email"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!email || submitting}
                  className="w-full h-11 bg-bb-orange text-black font-bold text-sm font-mono tracking-[0.15em] hover:bg-bb-orange/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  data-testid="button-continue"
                >
                  CONTINUE
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Email shown as a back-button */}
                <button
                  type="button"
                  onClick={() => { setStep("email"); setPassword(""); setLocalError(null); }}
                  className="w-full text-left h-11 bg-card border border-border px-3 flex items-center justify-between group"
                  data-testid="button-change-email"
                >
                  <span className="text-sm text-foreground font-mono truncate">{email}</span>
                  <span className="text-[10px] tracking-[0.2em] font-mono text-muted-foreground group-hover:text-bb-orange">CHANGE</span>
                </button>

                {mode === "signup" && (
                  <div>
                    <label className="block text-[10px] tracking-[0.2em] font-mono text-muted-foreground mb-1.5">
                      DISPLAY NAME · OPTIONAL
                    </label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      className="w-full h-11 bg-card border border-border focus:border-bb-orange px-3 text-sm text-foreground font-mono outline-none transition-colors placeholder:text-muted-foreground/50"
                      data-testid="input-display-name"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] tracking-[0.2em] font-mono text-muted-foreground mb-1.5">
                    PASSWORD
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoFocus
                    minLength={6}
                    className="w-full h-11 bg-card border border-border focus:border-bb-orange px-3 text-sm text-foreground font-mono outline-none transition-colors placeholder:text-muted-foreground/50"
                    data-testid="input-password"
                  />
                </div>

                {displayError && (
                  <div className="flex items-start gap-2 text-bb-red text-xs font-mono bg-bb-red/[0.08] border border-bb-red/30 px-3 py-2">
                    <span className="text-bb-red shrink-0">!</span>
                    <span>{displayError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !password}
                  className="w-full h-11 bg-bb-orange text-black font-bold text-sm font-mono tracking-[0.15em] hover:bg-bb-orange/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  data-testid="button-submit"
                >
                  {submitting
                    ? "..."
                    : mode === "login"
                      ? "SIGN IN"
                      : "CREATE ACCOUNT"}
                </button>
              </form>
            )}

            {/* Mode toggle */}
            <div className="text-center pt-2">
              <button
                onClick={() => { setMode(mode === "login" ? "signup" : "login"); setLocalError(null); }}
                className="text-xs text-muted-foreground hover:text-bb-orange font-mono transition-colors"
                data-testid="button-toggle-mode"
              >
                {mode === "login"
                  ? "Don't have an account? Sign up →"
                  : "Already have an account? Sign in →"}
              </button>
            </div>
          </div>

          {/* Guest access — prominent */}
          <div className="flex items-center gap-3 pt-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] tracking-[0.2em] font-mono text-muted-foreground">OR</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={onSkip}
            className="w-full h-11 border border-border bg-card hover:border-muted-foreground/30 hover:bg-accent transition-colors flex items-center justify-center gap-2 mt-3"
            data-testid="button-skip"
          >
            <span className="text-sm font-mono text-foreground">Continue as Guest</span>
            <span className="text-[10px] font-mono text-muted-foreground">— no save</span>
          </button>

          {/* Email error when shown on email step */}
          {step === "email" && displayError && (
            <div className="mt-4 flex items-start gap-2 text-bb-red text-xs font-mono bg-bb-red/[0.08] border border-bb-red/30 px-3 py-2">
              <span className="text-bb-red shrink-0">!</span>
              <span>{displayError}</span>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-5 border-t border-border bg-sidebar z-10">
        <div className="max-w-[420px] mx-auto text-center space-y-2">
          <p className="text-[10px] text-muted-foreground/70 font-mono leading-relaxed">
            By continuing, you agree to use this terminal for educational purposes only. Market data provided by Yahoo Finance.
          </p>
          <p className="text-[9px] text-muted-foreground/50 font-mono">
            Created by Adetayo Agueh
          </p>
        </div>
      </footer>
    </div>
  );
}
