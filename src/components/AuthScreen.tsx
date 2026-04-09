import { useState } from "react";

interface AuthScreenProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, password: string, displayName?: string) => Promise<void>;
  onSkip: () => void;
  error: string | null;
}

export function AuthScreen({ onLogin, onSignup, onSkip, error }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

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

  const displayError = localError || error;

  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" />
              <rect x="14" y="2" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.7" />
              <rect x="2" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.5" />
              <rect x="14" y="14" width="8" height="8" rx="1" fill="hsl(36, 100%, 50%)" opacity="0.3" />
            </svg>
            <h1 className="text-bb-orange font-bold text-lg tracking-wider font-mono">
              BLOOMBERG TERMINAL
            </h1>
          </div>
          <p className="text-muted-foreground text-xs">
            {mode === "login" ? "Sign in to save your progress" : "Create an account to save your progress"}
          </p>
        </div>

        {/* Auth form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block text-xs text-muted-foreground mb-1 font-mono">DISPLAY NAME</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-bb-orange font-mono"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-muted-foreground mb-1 font-mono">EMAIL</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-bb-orange font-mono"
              data-testid="input-email"
            />
          </div>

          <div>
            <label className="block text-xs text-muted-foreground mb-1 font-mono">PASSWORD</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-foreground focus:outline-none focus:border-bb-orange font-mono"
              data-testid="input-password"
            />
          </div>

          {displayError && (
            <div className="text-bb-red text-xs font-mono bg-bb-red/10 border border-bb-red/30 rounded px-3 py-2">
              {displayError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-bb-orange text-black font-bold py-2 rounded text-sm font-mono tracking-wider hover:bg-bb-orange/90 disabled:opacity-50 transition-colors"
            data-testid="button-submit"
          >
            {submitting ? "..." : mode === "login" ? "SIGN IN" : "CREATE ACCOUNT"}
          </button>
        </form>

        {/* Toggle */}
        <div className="mt-4 text-center">
          <button
            onClick={() => { setMode(mode === "login" ? "signup" : "login"); setLocalError(null); }}
            className="text-xs text-muted-foreground hover:text-bb-orange font-mono transition-colors"
          >
            {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>

        {/* Skip */}
        <div className="mt-6 text-center">
          <button
            onClick={onSkip}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground font-mono transition-colors"
          >
            Continue without account →
          </button>
          <p className="text-[10px] text-muted-foreground/40 mt-1 font-mono">
            Progress won't be saved
          </p>
        </div>
      </div>
    </div>
  );
}
