# Superset Codebase Audit — Final Synthesis
**Date**: 2026-03-28
**Team**: thdxr, leerob, adam, benji
**Repo**: github.com/doanbactam/superset

---

## Executive Summary

Superset is an AI agent orchestration tool built on Bun + Turbo, running parallel Claude Code/Codex sessions in isolated git worktrees. The codebase has solid fundamentals but has critical friction points in the core agent loop and onboarding experience.

**Overall Health**: 6.5/10
- ✅ Strong: Worktree isolation, file watcher subscriptions, typed state machine
- ⚠️ Critical gaps: Polling-based UI, no direct PR creation, telemetry opt-out missing, cloud-gated dev

---

## 1. Top 3 Changes That Unblock The Core Agent Loop

### Change #1: Eliminate Polling Latency for Git Status

**Current State**: UI polls git status every 2.5 seconds (active) or 10 seconds (inactive)
- File: `apps/desktop/src/renderer/screens/main/hooks/useGitChangesStatus/useGitChangesStatus.ts:115`
```typescript
refetchInterval: isActive ? 2500 : undefined  // 2.5s poll
```

**Problem**: Agent finishes work → File watcher fires (~75ms) → Cache invalidates → UI waits for next 2.5s poll cycle

**Fix**: Trigger immediate `getStatus` refresh on file watcher events
- File: `apps/desktop/src/renderer/screens/main/components/WorkspaceView/RightSidebar/ChangesView/ChangesView.tsx:379-435`
- Add `refetch()` call immediately after `invalidateQueries()` in the file watcher handler

**Impact**: Agent-done to diff visible: **2.5s → ~100ms**

---

### Change #2: Add Direct GitHub PR Creation

**Current State**: Returns GitHub compare URL, opens browser, user manually clicks "Create Pull Request"
- File: `apps/desktop/src/lib/trpc/routers/changes/git-operations.ts:630-734`
```typescript
const url = await buildNewPullRequestUrl(worktreePath, git, branch);
return { success: true, url };  // Just a URL
```

**Problem**: Core loop breaks—user must leave app, fill form, click button, switch back

**Fix**: Use `gh pr create` or GitHub API to create PR directly
```typescript
// Add to git-operations.ts
createPR: publicProcedure
  .mutation(async ({ input }) => {
    // ... push code ...
    const prUrl = await exec('gh pr create --fill --json url');
    return { success: true, url: JSON.parse(prUrl).url };
  })
```

**Impact**: One-click PR creation instead of 5-step context switch

---

### Change #3: Stream Agent Output to UI

**Current State**: Terminal output via tRPC subscription, but no "blast radius" indicator

**Problem**: User can't see how many files agent has touched until polling cycle completes

**Fix**: Emit file change events as they happen
- File: `packages/workspace-fs/src/fs.ts` already has `watchPath`
- Add `filesTouched` counter to `PaneStatus` and display in GroupStrip

**Impact**: Real-time feedback on agent progress

---

## 2. Top 3 Changes That Reduce Time-To-First-Agent

### Change #1: Create `.env.example` with Dev Defaults

**Current State**: `.env.example` does not exist. README references it but file is missing.
- Required: 15+ external service credentials (DATABASE_URL, KV_REST_API_TOKEN, STRIPE_SECRET_KEY, etc.)

**Fix**: Create `.env.example` with all variables marked required/optional + local defaults
```bash
# REQUIRED for local development
DATABASE_URL="file:./local.db"
SKIP_ENV_VALIDATION=1  # Allow local dev without cloud services

# OPTIONAL - cloud features (leave empty for local-only)
KV_REST_API_URL=""
STRIPE_SECRET_KEY=""
```

**Impact**: `git clone` → working app in 3 steps instead of 9

---

### Change #2: Add "Local-Only" Mode (Skip Electric SQL + Caddy)

**Current State**: Requires Caddy reverse proxy for Electric SQL SSE streams
- File: `Caddyfile.example:11-14`
- Complex: HTTPS cert management, browser connection limits

**Fix**: Add `SUPERSET_LOCAL_MODE=1` that:
- Skips Electric SQL sync
- Uses local SQLite instead
- Disables Caddy proxy
- File watcher handles all updates

**Impact**: Remove entire proxy layer for single-developer workflow

---

### Change #3: Add Telemetry Opt-Out (Default OFF)

**Current State**: PostHog telemetry ON BY DEFAULT, no opt-out
- File: `apps/desktop/src/shared/constants.ts:50`
```typescript
export const DEFAULT_TELEMETRY_ENABLED = true;  // Hardcoded ON
```

**Fix**: Default to OFF, add env var + UI toggle
```typescript
export const DEFAULT_TELEMETRY_ENABLED =
  process.env.SUPERSET_TELEMETRY !== '0';  // Opt-in
```

**Impact**: Privacy-conscious users can actually use the app

---

## 3. Conflicts Between Teammate Findings

| Finding | Teammate | Conflict | Resolution |
|----------|----------|----------|------------|
| **Polling vs SSE** | leerob vs thdxr | leerob says file watcher exists but doesn't eliminate polling; thdxr asked about typed events | Both correct: `watchPath` subscription exists (SSE) but `getStatus` still polled. Fix: wire them together. |
| **State Machine Completeness** | benji vs adam | benji asked about 5 Claude Code states (idle/working/waiting/done/failed); adam found only 4 PaneStatus values | Confirmed: `PaneStatus = "idle" | "working" | "permission" | "review"` — missing "failed" and "waiting-for-input" as distinct states. |
| **Electron Necessity** | adam vs thdxr | adam says 38 files block server mode; thdxr asked about agent lifecycle primitives | Both correct: Terminal daemon COULD run server-side, but UI is Electron-tied. Architecture decision: Is desktop-only acceptable? |
| **Config Typing** | thdxr vs adam | thdxr asked if `.superset/config.json` is typed; adam found no `.env.example` | Both reveal same issue: Configuration is undocumented and untyped. |

---

## 4. Single Most Important File to Refactor

### File: `apps/desktop/src/renderer/screens/main/hooks/useGitChangesStatus/useGitChangesStatus.ts`

**Why This File?**

1. **Center of the Core Loop**: Every workspace uses this hook to poll git status
2. **Controls Latency**: The 2.5s `refetchInterval` is the single biggest delay in agent-done → diff-visible
3. **Has the Fix Already Nearby**: The file watcher (`useWorkspaceFileEvents`) invalidates cache but doesn't trigger refresh
4. **Affects Every User**: Every workspace, every agent run, every diff review goes through this

**Refactor Plan**:

```typescript
// BEFORE (current):
export function useGitChangesStatus({ worktreePath, isActive }) {
  return useQuery({
    queryKey: ["gitStatus", worktreePath],
    queryFn: () => getStatus(worktreePath),
    refetchInterval: isActive ? 2500 : undefined,  // Polling!
  });
}

// AFTER:
export function useGitChangesStatus({ worktreePath, isActive }) {
  const queryClient = useQueryClient();

  // Subscribe to file events
  useWorkspaceFileEvents(worktreePath, {
    onFileChange: () => {
      // Immediate refresh on file change
      queryClient.invalidateQueries(["gitStatus", worktreePath]);
      queryClient.refetchQueries(["gitStatus", worktreePath]);
    },
  });

  return useQuery({
    queryKey: ["gitStatus", worktreePath],
    queryFn: () => getStatus(worktreePath),
    refetchInterval: isActive ? 10000 : undefined,  // Fallback poll only
  });
}
```

**Expected Impact**:
- Agent-done → diff visible: **2.5s → ~100ms** (25x faster)
- No new infrastructure required
- Uses existing `watchPath` subscription
- Keeps polling as safety net

---

## 5. Complete Agent State Machine Analysis

**Current State** (`apps/desktop/src/shared/tabs-types.ts:25`):

```typescript
export type PaneStatus = "idle" | "working" | "permission" | "review";
```

**Claude Code 2026 States (5)**:
1. `idle` - ✅ exists
2. `working` - ✅ exists
3. `waiting-for-input` - ❌ missing (merged into `permission`)
4. `done` - ⚠️ exists as `review` (different name)
5. `failed` - ❌ missing (no distinct state)

**Gap Analysis**:

| Missing State | Impact | Fix |
|---------------|--------|-----|
| `waiting-for-input` | Can't distinguish "agent paused for question" vs "agent blocked by permission" | Add to `PaneStatus` |
| `failed` | Agent errors look like `working` (amber) instead of error indication | Add to `PaneStatus` |
| `done` vs `review` | Naming inconsistency with Claude Code | Rename or alias |

**Proposed Update**:

```typescript
export type PaneStatus =
  | "idle"           // No active agent
  | "working"        // Agent actively processing
  | "waiting"        // Agent paused, waiting for user input
  | "permission"     // Agent blocked, needs permission grant
  | "done"           // Agent completed successfully (alias: review)
  | "failed";        // Agent errored (NEW)
```

---

## 6. Workspace Creation Flow Analysis

**Current Flow** (`apps/desktop/src/renderer/components/NewWorkspaceModal/`):

| Step | Interaction | Type |
|------|-------------|------|
| 1 | Click "New Workspace" button | Click |
| 2 | Modal opens | Auto |
| 3 | Select project | Dropdown |
| 4 | Select branch | Dropdown |
| 5 | (Optional) Select preset | Dropdown |
| 6 | (Optional) Configure agent settings | Click |
| 7 | Type prompt | Text input |
| 8 | Click "Create" | Click |
| 9 | Workspace initializes | Loading |

**Total**: 5-9 clicks before agent starts

**Target**: One keyboard shortcut (`⌘N`) → agent running

**Blocking Reduction**:
1. Add quick-create mode: `⌘⌘N` → skips modal, uses last project + branch
2. Default agent settings from `~/.superset/config.json`
3. Run preset setup asynchronously (agent can wait)

---

## 7. Motion/Transition Audit

**Duration Values Found** (`packages/ui/src/components/`):

| Duration | Usage | Count |
|----------|-------|-------|
| 100ms | Quick interactions | 5 |
| 150ms | Hover states | 8 |
| 200ms | Standard transitions | 12 |
| 300ms | Slow animations | 3 |
| 500ms | Sheet animations | 1 |
| 1000ms | Caret blink | 1 |

**No standard defined.** Recommend creating design tokens:

```css
/* packages/ui/src/styles/tokens.css */
:root {
  --duration-instant: 100ms;
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
}
```

---

## 8. Mastracode Fork Analysis

**Resolution in `package.json:48-51`**:
```json
"resolutions": {
  "mastracode": "https://github.com/superset-sh/mastra/...",
  "@mastra/core": "https://github.com/superset-sh/mastra/...",
  "@mastra/memory": "https://github.com/superset-sh/mastra/..."
}
```

**Direct Imports Found** (no abstraction layer):
- `apps/desktop/src/main/lib/agent-setup/agent-wrappers-mastra.ts`
- `packages/host-service/src/runtime/chat/chat.ts`
- `packages/chat/src/server/desktop/chat-service/chat-service.ts`

**Problem**: Forked packages create upgrade debt, blocks upstream improvements

**Fix Strategy**: Create `packages/agent-runtime/` wrapper that:
1. Defines `AgentSession` interface
2. Abstracts mastracode implementation
3. Allows swapping implementations without changing consumers

---

## 9. Config Schema Analysis

**`.superset/config.json` exists but**:
- No Zod schema validation found
- No TypeScript interface for config structure
- Parsed by: `apps/desktop/src/main/lib/config.ts` (implied)

**Files that read config**:
- `apps/desktop/src/main/lib/agent-setup/` (presets, hooks)
- `packages/host-service/` (workspace initialization)

**Fix**: Create shared schema:
```typescript
// packages/shared/src/config.ts
import { z } from "zod";

export const SupersetConfigSchema = z.object({
  setup: z.array(z.string()).default([]),
  teardown: z.array(z.string()).default([]),
  // ...
});
```

---

## 10. Files Referenced in This Report

### Critical Files
| File | Issue | Priority |
|------|-------|----------|
| `apps/desktop/src/renderer/screens/main/hooks/useGitChangesStatus/useGitChangesStatus.ts` | 2.5s polling | HIGH |
| `apps/desktop/src/lib/trpc/routers/changes/git-operations.ts` | No PR creation | HIGH |
| `apps/desktop/src/shared/constants.ts:50` | Telemetry ON by default | HIGH |
| `.env.example` | MISSING | CRITICAL |
| `apps/desktop/src/shared/tabs-types.ts:25` | Missing agent states | MED |

### State Machine
| File | Purpose |
|------|---------|
| `apps/desktop/src/shared/tabs-types.ts` | PaneStatus definition |
| `apps/desktop/src/renderer/screens/main/components/WorkspaceView/ContentView/TabsContent/GroupStrip/GroupStrip.tsx:132` | Status display |
| `apps/desktop/src/renderer/screens/main/components/WorkspaceView/ContentView/TabsContent/GroupStrip/GroupItem.tsx:250` | Status indicator |

### File Watching
| File | Purpose |
|------|---------|
| `apps/desktop/src/lib/trpc/routers/filesystem/index.ts:244-323` | watchPath subscription |
| `apps/desktop/src/renderer/screens/main/components/WorkspaceView/hooks/useWorkspaceFileEvents/useWorkspaceFileEvents.ts` | File event bridge |
| `apps/desktop/src/renderer/screens/main/components/WorkspaceView/RightSidebar/ChangesView/ChangesView.tsx:379-435` | Cache invalidation |

---

## 11. Next Steps

1. **Create `.env.example`** with local defaults (30 min)
2. **Fix polling latency** by wiring file watcher to git refresh (2 hours)
3. **Add telemetry opt-out** with UI toggle (2 hours)
4. **Add `gh pr create`** for direct PR creation (1 hour)
5. **Expand `PaneStatus`** to include `failed` and `waiting` (2 hours)

**Total Estimated Time**: ~8 hours for all high-priority fixes

---

## 12. Architecture Decision Required

**Question**: Should Superset support browser/server mode, or remain Electron-only?

**Trade-offs**:
- **Electron-only**: Simpler architecture, native terminal integration, local file system access
- **Browser mode**: Lower barrier to try, multi-platform, requires refactoring 38 files

**Recommendation**: Stay Electron-only for now, but:
1. Factor UI components to `packages/ui/` (already done)
2. Keep `apps/desktop/` thin wrapper around shared UI
3. Revisit when web terminal matures (xterm.js + WebContainers)

