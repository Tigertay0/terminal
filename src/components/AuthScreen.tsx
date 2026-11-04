import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Wordmark } from "@/components/BrandMark";
import { MarketPreview } from "@/components/MarketPreview";

interface AuthScreenProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (email: string, password: string, displayName?: string) => Promise<void>;
  onSkip: () => void;
  error: string | null;
}

const INPUT = "w-full h-11 rounded-md bg-card border border-border focus:border-ink/60 px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground";
const LABEL = "block text-xs text-dim mb-2";
const PRIMARY = "w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-[background-color,opacity,transform]";
const SECONDARY = "w-full h-11 rounded-md border border-border bg-card text-sm text-foreground hover:bg-raised transition-colors";

function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="text-xs text-down bg-down/10 border border-down/30 rounded-md px-3 py-2">
      {message}
    </p>
  );
}

export function AuthScreen({ onLogin, onSignup, onSkip, error }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [step, setStep] = useState<"email" | "password">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  // Google sign-in is offered only once the server has its keys.
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/config", { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((config) => setGoogleEnabled(config?.google === true))
      .catch((err) => { if ((err as Error)?.name !== "AbortError") console.error("Failed to load auth config:", err); });
    return () => controller.abort();
  }, []);

  // Coming back from Google with the Back button restores this page as it was
  // left, mid-submit; let the buttons work again.
  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => { if (e.persisted) setSubmitting(false); };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

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
      // Redirects to Google, then back to the app signed in.
      const { error } = await authClient.signIn.social({ provider: "google", callbackURL: "/", errorCallbackURL: "/" });
      if (error) throw new Error(error.message || "Google sign-in is unavailable");
    } catch (err: any) {
      setLocalError(err.message || "Google sign-in is unavailable. Use email and password, or continue as a guest");
      setSubmitting(false);
    }
  };

  const displayError = localError || error;
  const isLogin = mode === "login";

  return (
    <div className="h-screen overflow-y-auto bg-background text-foreground grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      {/* Left: what this is, and the way in */}
      <div className="flex flex-col min-h-screen px-6 sm:px-12">
        <header className="h-16 flex items-center shrink-0">
          <Wordmark size={20} />
        </header>

        <main className="flex-1 flex items-center py-12">
          <div className="w-full max-w-[400px] rise-in">
            <h1 className="text-3xl sm:text-4xl font-medium leading-[1.1] tracking-[-0.02em] text-foreground">
              Watch the market live, then practice trading it
            </h1>
            <p className="mt-4 text-sm text-dim leading-relaxed">
              Real quotes, charts and news from Yahoo Finance, plus a paper-trading simulation you can speed up, with timed events and a leaderboard.
            </p>

            <div className="mt-10 space-y-3">
              {googleEnabled && (
                <>
                  <button
                    type="button"
                    onClick={handleGoogle}
                    disabled={submitting}
                    className={`${SECONDARY} flex items-center justify-center gap-3 disabled:opacity-50`}
                    data-testid="button-google"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                  </button>
                  <div className="flex items-center gap-3 py-1 text-xs text-muted-foreground">
                    <div className="flex-1 h-px bg-border" />
                    or
                    <div className="flex-1 h-px bg-border" />
                  </div>
                </>
              )}

              {step === "email" ? (
                <form onSubmit={handleEmailContinue} className="space-y-3">
                  <div>
                    <label htmlFor="auth-email" className={LABEL}>Email</label>
                    <input
                      id="auth-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      required
                      autoFocus
                      className={INPUT}
                      data-testid="input-email"
                    />
                  </div>
                  <button type="submit" disabled={!email || submitting} className={PRIMARY} data-testid="button-continue">
                    Continue
                  </button>
                </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <button
                    type="button"
                    onClick={() => { setStep("email"); setPassword(""); setLocalError(null); }}
                    className="w-full h-11 rounded-md border border-border bg-card px-3 flex items-center justify-between gap-3 text-left hover:bg-raised transition-colors"
                    data-testid="button-change-email"
                  >
                    <span className="text-sm text-foreground truncate">{email}</span>
                    <span className="text-xs text-dim shrink-0">Change</span>
                  </button>

                  {!isLogin && (
                    <div>
                      <label htmlFor="auth-name" className={LABEL}>Display name <span className="text-muted-foreground">· optional, shown on leaderboards</span></label>
                      <input
                        id="auth-name"
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="Your name"
                        autoComplete="nickname"
                        maxLength={40}
                        className={INPUT}
                        data-testid="input-display-name"
                      />
                    </div>
                  )}

                  <div>
                    <label htmlFor="auth-password" className={LABEL}>Password{!isLogin && <span className="text-muted-foreground"> · at least 8 characters</span>}</label>
                    <input
                      id="auth-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={isLogin ? "current-password" : "new-password"}
                      required
                      autoFocus
                      minLength={isLogin ? undefined : 8}
                      maxLength={128}
                      className={INPUT}
                      data-testid="input-password"
                    />
                  </div>

                  {displayError && <ErrorNote message={displayError} />}

                  <button type="submit" disabled={submitting || !password} className={PRIMARY} data-testid="button-submit">
                    {submitting ? (isLogin ? "Signing in…" : "Creating account…") : isLogin ? "Sign in" : "Create account"}
                  </button>
                </form>
              )}

              <button
                onClick={onSkip}
                className={SECONDARY}
                data-testid="button-skip"
              >
                Continue as guest <span className="text-muted-foreground">· nothing is saved</span>
              </button>

              {step === "email" && displayError && <ErrorNote message={displayError} />}

              <p className="pt-2 text-xs text-muted-foreground">
                {isLogin ? "New here? " : "Have an account? "}
                <button
                  onClick={() => { setMode(isLogin ? "signup" : "login"); setLocalError(null); }}
                  className="text-foreground underline underline-offset-4 decoration-border hover:decoration-foreground transition-colors"
                  data-testid="button-toggle-mode"
                >
                  {isLogin ? "Create an account" : "Sign in"}
                </button>
              </p>
            </div>
          </div>
        </main>

        <footer className="py-6 text-2xs text-muted-foreground leading-relaxed max-w-[400px]">
          By continuing, you agree to use Rochambeau Finance Terminal for educational purposes only. Market data from Yahoo Finance. Created by Adetayo Agueh
        </footer>
      </div>

      {/* Right: the real market, as the terminal shows it */}
      <aside className="flex items-center justify-center px-6 sm:px-12 py-12 bg-sidebar lg:border-l border-t lg:border-t-0 border-border">
        <MarketPreview />
      </aside>
    </div>
  );
}
