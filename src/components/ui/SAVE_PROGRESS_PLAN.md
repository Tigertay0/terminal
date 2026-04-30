# Plan: Persist Real-Mode Watchlist & Add Named Simulation Saves

**Owner:** Lead engineer
**Author:** Adetayo (planning)
**Status:** Plan only — do NOT implement yet
**Repo:** `Tigertay0/terminal` (master)
**Goal:** (1) Real mode watchlist must persist across refresh and re-login. (2) Simulation mode must support multiple named saves the user can pick from on relaunch.

---

## 1. What already exists (don't rebuild)

The DB schema, Supabase client, and most helpers are already wired. **Most of the work is wiring UI and rehydration — not new infrastructure.**

### Supabase tables (already created, RLS enforces `auth.uid() = user_id`)

| Table         | Columns                                                                                                                                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `watchlists`  | `user_id` (PK, FK → auth.users), `symbols text[]`, `updated_at`                                                                                                  |
| `sim_saves`   | `id` (PK, uuid), `user_id` (FK), `name text`, `settings jsonb`, `portfolio jsonb`, `watchlist text[]`, `day_number int`, `sim_time timestamptz`, `updated_at`    |

A trigger `on_auth_user_created` already auto-creates a default 15-symbol watchlist for every new user.

### Helpers already in `src/lib/supabase.ts`

- `getWatchlist(userId)` / `saveWatchlist(userId, symbols)`
- `listSimSaves(userId)` — returns `{ id, name, settings, portfolio, watchlist, day_number, sim_time, updated_at }[]`, ordered newest first
- `upsertSimSave(userId, payload)` — insert if no `id`, update if `id` provided
- `deleteSimSave(userId, id)`

### Existing wiring (status)

- `src/App.tsx` (root) already calls `getWatchlist` on login and `saveWatchlist` whenever the watchlist changes — **the real-mode watchlist already auto-saves.** Verify it actually works in production; if not, the bug is one of:
  1. RLS policy blocks the read on first login (run-once trigger sometimes hasn't completed).
  2. `setUserWatchlist` only fires when `mode === "auth"`, so a user who logs in while already on `"select"` won't reload.
  3. The default-on-empty fallback masks errors silently.
- `SimTerminal` already auto-saves to a row named `"Auto-save"` every 30 s — but there is **no UI to pick which save to load**, and `useSimulation` does not accept an initial state, so saves are write-only today.

---

## 2. What changes

### 2.1 Real mode — watchlist persistence (small fixes only)

Goal: a logged-in user's watchlist additions/removals survive refresh, logout/login, and cross-device login.

**Files to touch:** `src/App.tsx`, `src/lib/supabase.ts` (optional logging), `src/hooks/use-auth.ts` (no change expected).

**Required changes:**

1. In root `App` component, the `useEffect` that runs `getWatchlist` should refetch **whenever `auth.userId` changes**, not gated on `mode === "auth"`. Today the `if (mode === "auth") setMode("select")` branch hides the load on already-authed sessions when state changes.
2. On first login after signup, `getWatchlist` may return `null` for ~500 ms while the trigger fires. Add a **single retry after 750 ms** before falling back to `DEFAULT_WATCHLIST` so we don't silently overwrite the trigger-generated watchlist.
3. Surface errors from `saveWatchlist` to a toast (currently swallowed). Use existing `useToast` hook.
4. Add a small `lastSavedAt` indicator in the watchlist panel header (e.g. "Saved 2s ago") — gives the user feedback their changes are persisted. Optional but high value.

**Test plan:**
- Add MSFT to watchlist → refresh → MSFT still there.
- Logout → login on different device → MSFT still there.
- Network kill → add stock → toast surfaces error.

---

### 2.2 Simulation mode — named saves with a save picker

Goal: every time the user clicks "Start Simulation" they either **create a new save** or **continue an existing save**. On relaunch they see all their saves and pick one.

#### 2.2.1 New screen: `SaveSelect`

**New file:** `src/components/SaveSelect.tsx`.

**Props:**

```ts
interface SaveSelectProps {
  saves: SimSaveRow[];          // from listSimSaves
  loading: boolean;
  onContinue: (save: SimSaveRow) => void;
  onNew: () => void;            // routes to existing ModeSelect for settings
  onDelete: (id: string) => void;
  onBack: () => void;
}
```

**Layout (Bloomberg-style):**

- Title: `SIMULATION SAVES`
- Card grid showing each save:
  - Name (default "Save 1", "Save 2", … or rename inline)
  - Day number, sim time, current portfolio value, total P/L
  - "Continue" button + small trash icon
  - "Last played" relative time
- Bottom row: `+ NEW SIMULATION` button (full-width, orange).
- Empty state when `saves.length === 0`: skip this screen entirely and go straight to `ModeSelect` (don't make the user click through an empty list).

#### 2.2.2 Routing change in root `App`

Add a new mode value to `AppMode`:

```ts
type AppMode = "auth" | "select" | "save-select" | "real" | "sim";
```

Flow:

1. Login →
2. `select` (existing — Real vs Simulation) →
3. If user picks **Simulation**:
   - Fetch `listSimSaves(userId)`.
   - If `saves.length === 0` → fall through to existing `ModeSelect` (settings) → `sim`.
   - Else → `save-select` screen → either `Continue` (load save → `sim` with rehydrated state) or `New` → `ModeSelect` → `sim`.
4. If user picks **Real** → `real` (unchanged).

State to add at root:

```ts
const [savesList, setSavesList] = useState<SimSaveRow[]>([]);
const [activeSave, setActiveSave] = useState<SimSaveRow | null>(null);
```

#### 2.2.3 Make `useSimulation` rehydratable

**File:** `src/hooks/use-simulation.ts`.

**Today:** `useSimulation(settings, stocksMap)` always starts fresh — `cash = settings.startingCash`, `holdings = new Map()`, `trades = []`, `dayNumber = 1`, `simTime = new Date(...)`.

**Change:** add an optional `initialState` parameter:

```ts
interface SimInitialState {
  cash: number;
  holdings: Map<string, Holding>;
  trades: TradeRecord[];
  dayNumber: number;
  simTime: Date;
  // optional: news?: SimNewsItem[]   // probably skip — news is regenerated each tick
}

export function useSimulation(
  settings: SimSettings,
  stocks: Map<string, TickerData>,
  initialState?: SimInitialState
) { ... }
```

Inside the hook, the `useState` initializers for `cash`, `holdings`, `trades`, `dayNumber`, `simTime` should branch on `initialState`:

```ts
const [cash, setCash] = useState(() => initialState?.cash ?? settings.startingCash);
const [holdings, setHoldings] = useState<Map<string, Holding>>(
  () => initialState?.holdings ?? new Map()
);
// etc.
```

**Important:** the initializer runs once. If `initialState` arrives async (it will — it comes from Supabase), use either (a) lift state to `SimTerminal` and only render `<SimTerminal>` once `initialState` is loaded, or (b) gate `useSimulation` behind a `key` prop equal to the save id so React re-mounts the hook when the user picks a different save. (a) is simpler — recommended.

#### 2.2.4 Update `SimTerminal`

**File:** `src/App.tsx`.

**Changes to `SimTerminal`:**

- Accept new prop: `initialSave: SimSaveRow | null`.
- If `initialSave` is non-null:
  - Seed `useState` for `watchlist` from `initialSave.watchlist`.
  - Seed `useState` for `saveId` from `initialSave.id` (so auto-save updates the same row).
  - Pass `initialSave.portfolio` (deserialized — see §2.2.5) into `useSimulation` as `initialState`.
  - Use `initialSave.settings` as the `settings` argument (override the prop).
- Auto-save `useEffect` is mostly unchanged — but rename the auto-save row name from `"Auto-save"` to whatever the user-chosen save name is. Add a `name` state seeded from `initialSave.name ?? "Save N"` (where N = `saves.length + 1`).
- Add a small "SAVE" button in `TimeControlBar` for explicit manual save (calls `upsertSimSave` immediately with current state). Useful for "save before risky trade".
- Add an inline editable name in the top bar so users can rename their save (e.g. "Earnings season run").

#### 2.2.5 Serialization details

`portfolio` JSONB column needs a stable shape. **`Map` does not survive `JSON.stringify`** — current auto-save code sends a `Map` object which Postgres stores as `{}`, silently losing all holdings.

**Fix:** in the auto-save `useEffect`, serialize `holdings` and `trades` explicitly:

```ts
const portfolio = {
  cash: sim.cash,
  holdings: Array.from(sim.holdings.entries()),  // [[symbol, Holding], ...]
  trades: sim.trades.map(t => ({ ...t, timestamp: t.timestamp.toISOString() })),
};
```

And on load:

```ts
const loadedHoldings = new Map<string, Holding>(save.portfolio.holdings ?? []);
const loadedTrades = (save.portfolio.trades ?? []).map(t => ({
  ...t, timestamp: new Date(t.timestamp),
}));
```

**This is the actual reason auto-save isn't useful today** — even before the no-load problem, the holdings serialize to `{}`. Verify this is the bug by running `select portfolio from sim_saves where user_id = '...'` in Supabase SQL editor.

`sim_time` is already an ISO string in the payload — fine. Just `new Date(save.sim_time)` on load.

#### 2.2.6 Auto-save tuning

Today: every 30 s unconditionally. Improve to:

- **Debounce on state change** (lodash-style 2 s debounce) instead of fixed interval. Use `useEffect` keyed on `[sim.cash, sim.holdings, sim.trades, sim.dayNumber, watchlist]` with a `setTimeout`. Cancel on cleanup.
- **Don't save while `baseData.loading`** (already handled).
- **Don't save the very first render** — debounce naturally guards this, but assert with a `hasMountedRef`.
- **Save immediately on tab-close** via `beforeunload` — best-effort `navigator.sendBeacon` to a Supabase edge function is overkill; instead just call `upsertSimSave` synchronously in a `beforeunload` handler. Acceptable to skip in v1.

---

## 3. File-by-file change list

| File                                  | Change                                                                                                     | Touch |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----- |
| `src/components/SaveSelect.tsx`       | NEW — save picker UI                                                                                       | + new |
| `src/App.tsx`                         | Add `"save-select"` mode, fetch saves, route to/from picker, pass `initialSave` to `SimTerminal`           | edit  |
| `src/App.tsx` (`SimTerminal`)         | Accept `initialSave`, seed state, fix portfolio serialization, debounced auto-save, manual SAVE button     | edit  |
| `src/hooks/use-simulation.ts`         | Add optional `initialState` param; branch state initializers                                               | edit  |
| `src/components/TimeControlBar.tsx`   | Add SAVE button + "Last saved" indicator                                                                   | edit  |
| `src/lib/supabase.ts`                 | Export a `SimSaveRow` type for typed `listSimSaves` return; no logic changes                               | edit  |
| `src/components/ModeSelect.tsx`       | Tiny: add a "Back" button so the user can return from new-sim settings to the save picker                  | edit  |
| (No DB migration)                     | Schema already supports everything. Optional: add `name text NOT NULL DEFAULT 'Untitled'` if not already.   | maybe |

---

## 4. Edge cases to handle

1. **Concurrent tabs.** If the user opens the same save in two tabs and trades in both, last-write-wins. Acceptable for v1, but document it. To prevent, add an `updated_at` optimistic lock: include `.eq("updated_at", lastKnownUpdatedAt)` in the update; on miss, show "Save out of date — refresh".
2. **Save name collisions.** Allow duplicates. Don't enforce unique names.
3. **Stock price drift between save and load.** When loading, the sim's stock prices come from current `useFinanceData` quotes, not the saved snapshot. That's fine — sim mode mutates prices anyway. Just ensure `sim.simTime` and `dayNumber` are restored so news/time logic continues from where it left off.
4. **News history.** Don't persist `news` — it's noisy and regenerates. Loaded saves start with empty news; new news flows in as the sim runs.
5. **Logged-out user clicks "Simulation".** Same flow as today — no Supabase calls, no auto-save, no save picker. Just runs in-memory. (Optionally: prompt them to log in to save progress.)
6. **Soft-delete vs hard-delete.** Hard-delete is fine for v1. Add an "Are you sure?" confirm via `AlertDialog` from shadcn.
7. **Save limit per user.** Soft cap at 20 saves per user. When `saves.length >= 20` and user clicks "+ NEW", show a toast: "Delete an old save first." Prevents runaway DB rows.

---

## 5. Implementation order (≈4–6 hours)

1. **Fix portfolio serialization** in current auto-save (§2.2.5). Verify in Supabase that `holdings` is now a real array. *(30 min)*
2. **Add `initialState` to `useSimulation`** (§2.2.3). Unit-test by hardcoding an initial state and confirming `cash`/`holdings` render correctly. *(45 min)*
3. **Build `SaveSelect.tsx`** (§2.2.1) using existing shadcn `Card` + `Button` primitives. Follow existing Bloomberg theme tokens (`bb-orange`, `bb-green`). *(90 min)*
4. **Wire root `App`** (§2.2.2) — add the `save-select` mode, route based on `saves.length`. *(60 min)*
5. **Update `SimTerminal`** (§2.2.4) — accept `initialSave`, seed state, debounce auto-save, add SAVE button. *(60 min)*
6. **Real-mode watchlist polish** (§2.1) — fix the load-once gate, add retry, surface errors. *(30 min)*
7. **QA pass** — refresh tests, multi-tab, logout/login, edge cases from §4. *(45 min)*
8. **Deploy** — push to `master`, Vercel auto-deploys, smoke-test live.

---

## 6. Open questions for the lead

1. Should "Continue most recent save" be a one-click shortcut on the `select` screen (skip `save-select` entirely)? Recommendation: yes — show the most recent save as a "Resume [name]" button on the mode select screen, with "Other saves →" linking to the full picker.
2. Do we need to version the `portfolio` JSONB shape (e.g. `version: 1`) so future schema changes don't break old saves? Recommendation: yes, cheap insurance.
3. Should real-mode also support multiple named watchlists ("Tech", "Energy")? Out of scope for this ticket but worth a follow-up.
4. Auto-save indicator: green dot when synced, amber when pending, red on error. Tiny but meaningful. Worth doing in v1?

---

## 7. Out of scope (don't do in this ticket)

- Multi-watchlist support
- Save sharing between users
- Cloud-based news history persistence
- Sim "rewind" / undo
- Mobile-specific picker layout (current desktop-first design is fine for now)
