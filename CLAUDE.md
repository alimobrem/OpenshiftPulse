# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

OpenShift Pulse — a React/TypeScript dashboard for OpenShift Day-2 operations. All data comes from live Kubernetes APIs (no mock data in production code). v5.13.0, ~190 source files, 1884 tests.

## Commands

```bash
# Dev server (requires `oc proxy --port=8001` running separately)
npm run dev              # rspack dev server on port 9000

# Build
npm run build            # production build (~1s)

# Tests
npx vitest --run         # run all tests (~8s)
npx vitest --run src/kubeview/views/__tests__/WorkloadsView.test.tsx  # single file
npx vitest --run -t "test name pattern"  # single test by name

# Type checking
npm run type-check       # tsc --noEmit

# Full verify
npm run verify           # type-check + strict + lint + test + build

# Lint & format
npm run lint             # eslint with --fix
npm run format           # prettier
```

## Architecture

### Entry & Routing
- **Entry**: `src/index.tsx` → `src/kubeview/App.tsx` (`OpenshiftPulseApp`)
- **Shell**: `components/Shell.tsx` wraps all routes (CommandBar + TabBar + Dock + StatusBar)
- **Routes**: `routes/resourceRoutes.tsx` (generic CRUD), `routes/domainRoutes.tsx` (domain views), `routes/redirects.tsx` (legacy + feature-gated redirects)
- URL pattern for resources: `/r/{group~version~plural}/{namespace}/{name}` (GVR encoding uses `~` separator)
- **Feature flags**: All flags default to ON. Toggle in Admin > Overview > Feature Flags. Stored in localStorage via `engine/featureFlags.ts`.

### Navigation Structure
```
Home:     Welcome (smart launchpad — cluster stats, primary actions, all views grid)
Operate:  Pulse, Incident Center, Workloads, Compute, Networking, Storage, Fleet
Govern:   Identity & Access, Security, GitOps, Alerts
Platform: Admin (9 tabs), Onboarding (readiness wizard/checklist)
```

**Key routes:**
- `/welcome` — launchpad with cluster stats + primary action cards
- `/pulse` — daily health briefing (risk score, control plane, capacity)
- `/incidents` — unified incident triage (5 tabs: Now, Investigate, Actions, History, Config)
- `/alerts` — Prometheus alert rules, silences, firing alerts (kept as deep-dive tool)
- `/identity` — merged Users + Groups + RBAC + Impersonation
- `/onboarding` — production readiness wizard (30 gates, 6 categories)
- `/monitor` — redirects to `/incidents`

**Dock panels**: Logs, Terminal, Events, Agent (no Monitor tab — replaced by Incident Center)
**StatusBar**: Incidents link (with badge count), Degraded indicator, Agent toggle
**CommandBar bell**: links to `/incidents`

### Data Layer
- **API proxy**: All K8s calls go through `/api/kubernetes` → rspack dev proxy → `oc proxy :8001`
- **Query**: `engine/query.ts` — CRUD functions with TanStack Query
- **List+Watch**: `hooks/useK8sListWatch.ts` — REST list + WebSocket watch with 60s safety polling
- **Watch manager**: `engine/watch.ts` — singleton WebSocket manager with heartbeat/reconnect
- **Discovery**: `engine/discovery.ts` — discovers all resource types from `/apis` endpoint
- **Impersonation**: `getImpersonationHeaders()` in `engine/query.ts`

### State Management (Zustand stores)
| Store | Purpose | Persisted |
|-------|---------|-----------|
| `uiStore` | tabs, toasts, dock, namespace, impersonation, degradedReasons | yes (except degradedReasons) |
| `clusterStore` | cluster discovery, version, HyperShift detection | no |
| `monitorStore` | findings, predictions, actions, fix history | yes (partial) |
| `agentStore` | chat messages, streaming, confirmations | yes |
| `trustStore` | trust level (0-4), auto-fix categories | yes |
| `errorStore` | tracked K8s API errors by category | yes |
| `fleetStore` | multi-cluster connections, ACM detection | no |
| `argoCDStore` | ArgoCD availability, apps, sync status | no |
| `onboardingStore` | readiness gate results, waivers, wizard mode | yes |

### Canonical Data Models (define once, import everywhere)
- **`engine/types/incident.ts`** — `IncidentItem`, `PrometheusAlert`, `FleetAlert` + 5 mapper functions
- **`engine/readiness/types.ts`** — `ReadinessGate`, `GateResult`, `GateStatus`, `GatePriority`, `ReadinessReport`, `CategorySummary`
- **`engine/monitorClient.ts`** — `Finding`, `ResourceRef`, `ActionReport`, `Prediction`, `MonitorEvent`
- **`engine/fixHistory.ts`** — `ActionRecord`, `FixHistoryResponse`
- **`components/onboarding/types.ts`** — re-exports from engine + `CategoryView`, `buildCategoryViews()` bridge

### Agent Integration
- **Default agent mode**: `auto` — uses `/ws/agent` endpoint which auto-routes between SRE and Security based on query intent
- **Agent endpoint**: `/ws/agent?token=...` — auto-routing orchestrated agent (classifies intent per message)
- **Legacy endpoints**: `/ws/sre` and `/ws/security` still available for explicit mode selection
- **Monitor WebSocket**: `engine/monitorClient.ts` → `store/monitorStore.ts` — single connection via `agentNotifications.ts`
- **Trust level**: sent as integer (0-4) to backend, NOT as label string
- **Agent Chat**: `engine/agentClient.ts` → `store/agentStore.ts`
- **Confirmation flow**: `confirm_request` with nonce → UI shows dialog → `confirm_response` with nonce echoed back
- **Degraded mode**: `engine/degradedMode.ts` — 5 failure reasons, displayed via `DegradedBanner`
- **Auto-fix**: at trust level 3/4, monitor fixes crashloop (pod delete) and workloads (deployment restart) WITHOUT confirmation gate. Has safety guardrails: max 3/scan, 5min cooldown, no bare pods.
- **Agent version**: v1.5.0 (Protocol v2, 109 tools, 11 scanners)

### Incident Center (`/incidents`) — 5 tabs
- **Now**: unified feed from `useIncidentFeed` hook (findings + alerts + errors), silence management
- **Investigate**: correlation groups from timeline
- **Actions**: pending/recent actions with approve/reject/rollback
- **History**: chronological stream + fix history
- **Config**: monitoring toggle, trust level (0-4), auto-fix categories, scan now

### Readiness Engine
- **Gates**: `engine/readiness/gates.ts` — 30 gates across 6 categories
- **Scoring**: `engine/readiness/scoring.ts` — weighted scoring, `isProductionReady()` with 80% threshold
- **UI bridge**: `components/onboarding/types.ts` — `CategoryView` + `buildCategoryViews()`
- **OnboardingView**: dual mode (wizard/checklist), uses `evaluateAllGates()` for real checks

### Unified Incident Feed
- **`hooks/useIncidentFeed.ts`** — merges 4 sources via canonical mappers, deduplicates by correlationKey, sorts by severity
- Sets `observability_unavailable` degraded reason on Prometheus failure
- Configurable: severity filter, limit, sources, timeRange

### UI Components
- **Primitives**: Panel, Card, DataTable, Badge, EmptyState, DegradedBanner
- **Feedback**: Toast, ConfirmDialog, ProgressModal
- **Onboarding**: ReadinessWizard, ReadinessChecklist, GateCard, ReadinessScore, WaiverDialog, CategoryStep

### Views
- **Operate**: Pulse, IncidentCenter (5 tabs), Workloads, Compute, Networking, Storage, Fleet
- **Govern**: Identity (4 tabs), Security, GitOps (ArgoCD), Alerts (rules + silences)
- **Platform**: Admin (9 tabs: Overview, Readiness, Operators, Config, Updates, Snapshots, Quotas, Certificates, GitOps), Onboarding

### Testing
- **Framework**: vitest + jsdom + @testing-library/react
- **Config**: `vitest.config.ts` — excludes `.claude/worktrees/**`
- **Setup**: `src/kubeview/__tests__/setup.tsx` — factories, mock server, renderWithProviders
- **1884 tests** across 141 files

### Key Conventions
- Path alias: `@/` maps to `src/`
- CSS: Tailwind with slate/violet color scheme
- Icons: lucide-react
- State: Zustand with `persist` middleware, `openshiftpulse-` prefix
- Routing: react-router-dom v7
- Types: define once in `engine/types/` or `engine/readiness/`, import everywhere. **Never duplicate interfaces.**
- Feature flags: all default ON. Toggle in Admin. `isFeatureEnabled(flag)` to check.
- Trust level: always send as integer (0-4), never as string label
- Confirmation nonce: always echo `nonce` from `confirm_request` back in `confirm_response`
- Builds page metrics: computed locally from build objects (no Prometheus dependency)
- Welcome page: every element must be clickable and link to a valid route

### Deploy to OpenShift
```bash
# UI only (quick) — build locally, push to Quay, deploy via Helm
npm run build && podman build -t quay.io/amobrem/openshiftpulse:latest . && podman push quay.io/amobrem/openshiftpulse:latest && helm upgrade --install openshiftpulse deploy/helm/openshiftpulse/ -n openshiftpulse --set image.repository=quay.io/amobrem/openshiftpulse --set image.tag=latest && oc rollout restart deployment/openshiftpulse -n openshiftpulse

# Full stack (UI + Agent) — uses deploy.sh with Quay images
./deploy/deploy.sh --agent-repo ../pulse-agent

# Agent only (quick)
cd ../pulse-agent && ./deploy/quick-deploy.sh openshiftpulse
```
Helm chart in `deploy/helm/openshiftpulse/`. OAuth proxy, 2 replicas, PDB, topology spread. WS token auto-synced from agent secret on re-deploys. Container images go to `quay.io/amobrem/openshiftpulse` (UI) and `quay.io/amobrem/pulse-agent` (agent) — never use S2I builds on the cluster.
