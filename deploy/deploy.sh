#!/usr/bin/env bash
# Deploy OpenShift Pulse (UI + Agent) to an OpenShift cluster.
#
# Builds images locally with Podman, pushes to Quay.io, deploys via Helm.
# Never uses S2I or on-cluster builds.
#
# Usage:
#   ./deploy/deploy.sh                                  # UI only (no agent)
#   ./deploy/deploy.sh --agent-repo /path/to/pulse-agent # UI + Agent
#   ANTHROPIC_API_KEY=sk-ant-... ./deploy/deploy.sh --agent-repo ../pulse-agent
#
# Prerequisites: oc (logged in), helm, npm, podman

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
AGENT_REPO=""
NO_AGENT=false
NAMESPACE="openshiftpulse"
AGENT_RELEASE="pulse-agent"
UI_IMAGE="quay.io/amobrem/openshiftpulse"
AGENT_IMAGE="quay.io/amobrem/pulse-agent"
UI_TAG="latest"
AGENT_TAG="latest"
_WS_TOKEN_OVERRIDE="${PULSE_AGENT_WS_TOKEN:-}"
GCP_KEY_FILE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --agent-repo) AGENT_REPO="$2"; shift 2 ;;
    --no-agent)   NO_AGENT=true; shift ;;
    --namespace)  NAMESPACE="$2"; shift 2 ;;
    --ws-token)   _WS_TOKEN_OVERRIDE="$2"; shift 2 ;;
    --gcp-key)    GCP_KEY_FILE="$2"; shift 2 ;;
    --ui-tag)     UI_TAG="$2"; shift 2 ;;
    --agent-tag)  AGENT_TAG="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: $0 [--agent-repo /path/to/pulse-agent] [options]"
      echo ""
      echo "Options:"
      echo "  --agent-repo PATH   Path to pulse-agent repo (deploys UI + Agent)"
      echo "  --no-agent          Deploy UI only, skip agent"
      echo "  --namespace NS      Target namespace (default: openshiftpulse)"
      echo "  --gcp-key PATH      GCP service account JSON for Vertex AI"
      echo "  --ws-token TOKEN    WebSocket auth token (auto-generated if unset)"
      echo "  --ui-tag TAG        UI image tag (default: latest)"
      echo "  --agent-tag TAG     Agent image tag (default: latest)"
      echo ""
      echo "Images (built locally, pushed to Quay.io):"
      echo "  UI:    $UI_IMAGE:<tag>"
      echo "  Agent: $AGENT_IMAGE:<tag>"
      echo ""
      echo "AI Backend (pick one):"
      echo "  Option A — Vertex AI (recommended for GCP):"
      echo "    ANTHROPIC_VERTEX_PROJECT_ID=proj CLOUD_ML_REGION=us-east5 \\"
      echo "      $0 --agent-repo ../pulse-agent --gcp-key ~/sa-key.json"
      echo ""
      echo "  Option B — Anthropic API directly:"
      echo "    ANTHROPIC_API_KEY=sk-ant-... $0 --agent-repo ../pulse-agent"
      exit 0 ;;
    *) echo "ERROR: Unknown argument: $1. Use --help for usage."; exit 1 ;;
  esac
done

# ─── Helper Functions ────────────────────────────────────────────────────────

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }
step()  { echo ""; echo -e "${CYAN}═══ $1 ═══${NC}"; }

wait_for_rollout() {
  local deploy="$1" ns="$2" timeout="${3:-120}"
  info "Waiting for $deploy to be ready (timeout: ${timeout}s)..."
  if ! oc rollout status "deployment/$deploy" -n "$ns" --timeout="${timeout}s" 2>/dev/null; then
    warn "Rollout not complete within ${timeout}s — continuing anyway"
  fi
}

wait_for_route() {
  local name="$1" ns="$2"
  for i in $(seq 1 10); do
    local host
    host=$(oc get route "$name" -n "$ns" -o jsonpath='{.spec.host}' 2>/dev/null || echo "")
    [[ -n "$host" ]] && echo "$host" && return 0
    sleep 2
  done
  echo ""
}

# ─── Phase 0: Preflight Checks ──────────────────────────────────────────────

step "Preflight checks"

for cmd in oc helm npm podman; do
  command -v "$cmd" &>/dev/null || { error "'$cmd' not found. Install it and try again."; exit 1; }
done
oc whoami &>/dev/null || { error "Not logged in to OpenShift. Run 'oc login' first."; exit 1; }

# Verify podman machine is running
if ! podman info &>/dev/null; then
  error "Podman machine not running. Start it: podman machine start"
  exit 1
fi

# Verify Quay.io login
if ! podman login --get-login quay.io &>/dev/null; then
  error "Not logged in to Quay.io. Run: podman login quay.io"
  exit 1
fi

info "Tools: oc, helm, npm, podman — OK"
CLUSTER_API=$(oc whoami --show-server)
info "Cluster: $CLUSTER_API"

# Agent repo validation
if [[ -z "$AGENT_REPO" ]]; then
  NO_AGENT=true
  warn "No --agent-repo provided — deploying UI only"
fi

if [[ "$NO_AGENT" == "false" ]]; then
  if [[ -z "${ANTHROPIC_API_KEY:-}" && -z "${ANTHROPIC_VERTEX_PROJECT_ID:-}" ]]; then
    error "No AI backend configured. Set ANTHROPIC_API_KEY or ANTHROPIC_VERTEX_PROJECT_ID."
    exit 1
  fi
  if [[ ! -d "$AGENT_REPO" ]]; then
    error "Agent repo not found: $AGENT_REPO"
    exit 1
  fi
  [[ -d "$AGENT_REPO/chart" ]] || { error "Agent repo missing chart/: $AGENT_REPO"; exit 1; }
  AGENT_REPO="$(cd "$AGENT_REPO" && pwd)"
  info "Agent repo: $AGENT_REPO"
fi

# GCP key for Vertex AI
GCP_KEY=""
if [[ -n "${ANTHROPIC_VERTEX_PROJECT_ID:-}" ]]; then
  if [[ -z "$GCP_KEY_FILE" ]]; then
    GCP_KEY_FILE="$HOME/.config/gcloud/application_default_credentials.json"
  fi
  [[ -f "$GCP_KEY_FILE" ]] || { error "GCP key not found: $GCP_KEY_FILE"; exit 1; }
  GCP_KEY="$GCP_KEY_FILE"
  info "GCP credentials: $GCP_KEY"
fi

info "All preflight checks passed"

# ─── Phase 1: Detect Cluster Configuration ──────────────────────────────────

step "Detecting cluster configuration"

# Ensure namespace exists
oc get namespace "$NAMESPACE" &>/dev/null || oc create namespace "$NAMESPACE"

# OAuth proxy image
OAUTH_TAG=$(oc get imagestream oauth-proxy -n openshift -o jsonpath='{.status.tags[0].tag}' 2>/dev/null || echo "")
if [[ -z "$OAUTH_TAG" ]]; then
  warn "oauth-proxy ImageStream not found — using registry.redhat.io fallback"
  OAUTH_IMAGE="registry.redhat.io/openshift4/ose-oauth-proxy:v4.17"
else
  OAUTH_IMAGE="image-registry.openshift-image-registry.svc:5000/openshift/oauth-proxy:${OAUTH_TAG}"
fi
info "OAuth proxy: $OAUTH_IMAGE"

# Cluster apps domain
CLUSTER_DOMAIN=$(oc get ingresses.config.openshift.io cluster -o jsonpath='{.spec.domain}' 2>/dev/null || echo "")
if [[ -z "$CLUSTER_DOMAIN" ]]; then
  error "Could not detect cluster apps domain."
  exit 1
fi
info "Apps domain: $CLUSTER_DOMAIN"

# Monitoring stack
MONITORING_ENABLED="false"
if oc get service thanos-querier -n openshift-monitoring -o name &>/dev/null; then
  MONITORING_ENABLED="true"
fi

# Agent deployment name
AGENT_DEPLOY="${AGENT_RELEASE}-openshift-sre-agent"

info "Namespace: $NAMESPACE"

# ─── Phase 2: Build & Push Images (parallel-ready) ──────────────────────────

step "Building & pushing UI image"

cd "$PROJECT_DIR"
npm run build --silent
info "UI built (dist/)"

podman build --platform linux/amd64 -t "${UI_IMAGE}:${UI_TAG}" .
podman push "${UI_IMAGE}:${UI_TAG}"
info "Pushed ${UI_IMAGE}:${UI_TAG}"

if [[ "$NO_AGENT" == "false" ]]; then
  step "Building & pushing Agent image"
  cd "$AGENT_REPO"

  # Use Dockerfile.full for a clean single-stage build
  AGENT_DOCKERFILE="Dockerfile"
  [[ -f "Dockerfile.full" ]] && AGENT_DOCKERFILE="Dockerfile.full"

  podman build --platform linux/amd64 -t "${AGENT_IMAGE}:${AGENT_TAG}" -f "$AGENT_DOCKERFILE" .
  podman push "${AGENT_IMAGE}:${AGENT_TAG}"
  info "Pushed ${AGENT_IMAGE}:${AGENT_TAG}"
fi

# ─── Phase 3: Deploy Agent FIRST (it generates the WS token) ────────────────
# The agent Helm chart auto-generates a WS token secret on first install.
# We deploy the agent first, then read its token for the UI Helm install.
# This eliminates token mismatch issues.

WS_TOKEN=""

if [[ "$NO_AGENT" == "false" ]]; then
  step "Deploying Agent via Helm (creates WS token)"
  cd "$AGENT_REPO"

  # Create secrets BEFORE Helm install
  if [[ -n "$GCP_KEY" ]]; then
    oc delete secret gcp-sa-key -n "$NAMESPACE" 2>/dev/null || true
    oc create secret generic gcp-sa-key --from-file=key.json="$GCP_KEY" -n "$NAMESPACE"
    info "GCP secret: created"
  fi
  if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    oc delete secret anthropic-api-key -n "$NAMESPACE" 2>/dev/null || true
    oc create secret generic anthropic-api-key --from-literal=api-key="${ANTHROPIC_API_KEY}" -n "$NAMESPACE"
    info "Anthropic API key secret: created"
  fi

  HELM_AGENT_ARGS="--set rbac.allowWriteOperations=true --set rbac.allowSecretAccess=true"
  HELM_AGENT_ARGS="$HELM_AGENT_ARGS --set image.repository=$AGENT_IMAGE"
  HELM_AGENT_ARGS="$HELM_AGENT_ARGS --set image.tag=$AGENT_TAG"
  HELM_AGENT_ARGS="$HELM_AGENT_ARGS --set image.internalRegistry=false"

  if [[ -n "${ANTHROPIC_VERTEX_PROJECT_ID:-}" ]]; then
    HELM_AGENT_ARGS="$HELM_AGENT_ARGS --set vertexAI.projectId=${ANTHROPIC_VERTEX_PROJECT_ID}"
    HELM_AGENT_ARGS="$HELM_AGENT_ARGS --set vertexAI.region=${CLOUD_ML_REGION:-us-east5}"
    HELM_AGENT_ARGS="$HELM_AGENT_ARGS --set vertexAI.existingSecret=gcp-sa-key"
    AI_BACKEND="vertex"
    info "AI backend: Vertex AI (project: ${ANTHROPIC_VERTEX_PROJECT_ID})"
  elif [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
    HELM_AGENT_ARGS="$HELM_AGENT_ARGS --set anthropicApiKey.existingSecret=anthropic-api-key"
    AI_BACKEND="anthropic"
    info "AI backend: Anthropic API (direct)"
  fi

  helm upgrade --install "$AGENT_RELEASE" chart/ \
    -n "$NAMESPACE" \
    $HELM_AGENT_ARGS \
    --timeout 120s
  info "Helm release: $AGENT_RELEASE"

  # Read the token the agent chart generated
  WS_TOKEN_SECRET="${AGENT_RELEASE}-openshift-sre-agent-ws-token"
  step "Reading WS token from agent secret"
  # Wait briefly for the secret to be created
  for i in $(seq 1 5); do
    EXISTING_TOKEN=$(oc get secret "$WS_TOKEN_SECRET" -n "$NAMESPACE" -o jsonpath='{.data.token}' 2>/dev/null || echo "")
    if [[ -n "$EXISTING_TOKEN" ]]; then
      WS_TOKEN=$(echo "$EXISTING_TOKEN" | base64 -d 2>/dev/null || echo "$EXISTING_TOKEN")
      info "WS token: read from agent secret ($WS_TOKEN_SECRET)"
      break
    fi
    sleep 2
  done
  if [[ -z "$WS_TOKEN" ]]; then
    # Fallback: use override or generate
    if [[ -n "$_WS_TOKEN_OVERRIDE" ]]; then
      WS_TOKEN="$_WS_TOKEN_OVERRIDE"
      info "WS token: from environment/flag override"
    else
      WS_TOKEN=$(openssl rand -hex 16)
      warn "WS token: auto-generated (could not read agent secret)"
    fi
  fi
fi

# ─── Phase 4: Deploy UI (with agent's token) ────────────────────────────────

step "Deploying Pulse UI via Helm"
cd "$PROJECT_DIR"

AGENT_ENABLED="false"
[[ "$NO_AGENT" == "false" ]] && AGENT_ENABLED="true"

# Label namespace for Helm ownership (prevents conflict if namespace was pre-created)
oc label namespace "$NAMESPACE" app.kubernetes.io/managed-by=Helm --overwrite 2>/dev/null || true
oc annotate namespace "$NAMESPACE" meta.helm.sh/release-name=openshiftpulse meta.helm.sh/release-namespace="$NAMESPACE" --overwrite 2>/dev/null || true

HELM_UI_ARGS=""
HELM_UI_ARGS="$HELM_UI_ARGS --set image.repository=$UI_IMAGE"
HELM_UI_ARGS="$HELM_UI_ARGS --set image.tag=$UI_TAG"
HELM_UI_ARGS="$HELM_UI_ARGS --set oauthProxy.image=$OAUTH_IMAGE"
HELM_UI_ARGS="$HELM_UI_ARGS --set route.clusterDomain=$CLUSTER_DOMAIN"
HELM_UI_ARGS="$HELM_UI_ARGS --set agent.enabled=$AGENT_ENABLED"
HELM_UI_ARGS="$HELM_UI_ARGS --set agent.serviceName=$AGENT_DEPLOY"
HELM_UI_ARGS="$HELM_UI_ARGS --set monitoring.prometheus.enabled=$MONITORING_ENABLED"
HELM_UI_ARGS="$HELM_UI_ARGS --set monitoring.alertmanager.enabled=$MONITORING_ENABLED"
if [[ -n "$WS_TOKEN" ]]; then
  HELM_UI_ARGS="$HELM_UI_ARGS --set agent.wsToken=$WS_TOKEN"
fi

helm upgrade --install openshiftpulse deploy/helm/openshiftpulse/ \
  -n "$NAMESPACE" --create-namespace \
  $HELM_UI_ARGS \
  --timeout 120s
info "Helm release: openshiftpulse"

# Fix OAuth redirect URI
ROUTE=$(wait_for_route "openshiftpulse" "$NAMESPACE")
if [[ -n "$ROUTE" ]]; then
  oc patch oauthclient openshiftpulse --type merge \
    -p "{\"redirectURIs\":[\"https://${ROUTE}/oauth/callback\"]}" 2>/dev/null || true
  info "OAuth redirect: https://$ROUTE/oauth/callback"
else
  warn "Route not ready — OAuth redirect URI may need manual fix"
fi

# ─── Phase 5: Restart & Verify ───────────────────────────────────────────────

step "Restarting deployments"
oc rollout restart "deployment/openshiftpulse" -n "$NAMESPACE"
wait_for_rollout "openshiftpulse" "$NAMESPACE" 120

if [[ "$NO_AGENT" == "false" ]]; then
  oc rollout restart "deployment/$AGENT_DEPLOY" -n "$NAMESPACE"
  wait_for_rollout "$AGENT_DEPLOY" "$NAMESPACE" 120
fi

# ─── Phase 6: Health & Token Verification ────────────────────────────────────

HEALTHY="n/a"
AI_BACKEND="${AI_BACKEND:-none}"

if [[ "$NO_AGENT" == "false" ]]; then
  step "Health verification"

  HEALTHY=false
  for i in $(seq 1 12); do
    sleep 10
    HEALTH=$(oc exec "deployment/$AGENT_DEPLOY" -n "$NAMESPACE" -- curl -sf http://localhost:8080/healthz 2>/dev/null || echo "")
    if [[ "$HEALTH" == *"ok"* ]]; then
      HEALTHY=true
      info "Agent healthy!"
      VERSION=$(oc exec "deployment/$AGENT_DEPLOY" -n "$NAMESPACE" -- curl -sf http://localhost:8080/version 2>/dev/null || echo "")
      [[ -n "$VERSION" ]] && info "Agent: $VERSION"
      break
    fi
    [[ $i -eq 12 ]] && warn "Agent health check failed after 120s"
  done

  # Verify WS token sync
  step "Verifying WS token sync"
  WS_TOKEN_AGENT=$(oc exec "deployment/$AGENT_DEPLOY" -n "$NAMESPACE" -- env 2>/dev/null | grep PULSE_AGENT_WS_TOKEN | cut -d= -f2 || echo "")
  WS_TOKEN_NGINX=$(oc get configmap openshiftpulse-nginx -n "$NAMESPACE" -o jsonpath='{.data.nginx\.conf}' 2>/dev/null | grep -o 'token=[a-zA-Z0-9]*' | head -1 | cut -d= -f2 || echo "")
  if [[ -n "$WS_TOKEN_AGENT" && -n "$WS_TOKEN_NGINX" ]]; then
    if [[ "$WS_TOKEN_AGENT" == "$WS_TOKEN_NGINX" ]]; then
      info "WS token: synced ✓"
    else
      warn "WS token mismatch — auto-fixing..."
      oc get configmap openshiftpulse-nginx -n "$NAMESPACE" -o json | \
        sed "s/$WS_TOKEN_NGINX/$WS_TOKEN_AGENT/g" | oc replace -f -
      oc rollout restart deployment/openshiftpulse -n "$NAMESPACE"
      wait_for_rollout "openshiftpulse" "$NAMESPACE" 60
      info "WS token: patched and restarted UI ✓"
    fi
  fi
fi

# ─── Phase 7: Cleanup ───────────────────────────────────────────────────────

# Clean up old build pods if any remain from previous S2I deploys
oc delete pod -n "$NAMESPACE" -l openshift.io/build.name --field-selector=status.phase!=Running 2>/dev/null || true
# Clean up orphaned S2I BuildConfigs/ImageStreams from previous deploys
oc delete bc -n "$NAMESPACE" --all 2>/dev/null || true
oc delete is openshiftpulse pulse-agent pulse-agent-deps -n "$NAMESPACE" 2>/dev/null || true

# ─── Summary ─────────────────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════"
if [[ "$HEALTHY" == "true" ]]; then
  info "Deploy complete! (UI + Agent)"
elif [[ "$NO_AGENT" == "true" ]]; then
  info "Deploy complete! (UI only)"
else
  warn "Agent health check did not pass — it may still be starting"
fi
echo ""
echo "  URL:       https://$ROUTE"
echo "  Cluster:   $CLUSTER_API"
echo "  NS:        $NAMESPACE"
echo "  UI image:  ${UI_IMAGE}:${UI_TAG}"
if [[ "$NO_AGENT" == "false" ]]; then
  echo "  Agent img: ${AGENT_IMAGE}:${AGENT_TAG}"
  echo "  AI:        $AI_BACKEND"
  VERSION=$(oc exec "deployment/$AGENT_DEPLOY" -n "$NAMESPACE" -- curl -sf http://localhost:8080/version 2>/dev/null || echo "unknown")
  echo "  Agent:     $VERSION"
fi
echo ""
echo "  Run integration tests: ./deploy/integration-test.sh --namespace $NAMESPACE"
echo "════════════════════════════════════════════"
