# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KubeLab is a Kubernetes failure simulation lab - a learning tool that lets users deliberately break things in a Kubernetes cluster to observe self-healing behavior. The backend runs **inside** the cluster and uses a ServiceAccount to call the real Kubernetes API. Simulations perform actual operations (delete pods, drain nodes, trigger OOMKills) - nothing is mocked when running in-cluster.

## Key Commands

```bash
# Deploy full stack to Kubernetes cluster (requires k8s/secrets.yaml)
./scripts/deploy-all.sh

# Run smoke tests against deployed cluster
./scripts/smoke-test.sh

# Local development with Docker Compose (mounts ~/.kube/config)
./scripts/test-local.sh

# Teardown - deletes the kubelab namespace
./scripts/teardown.sh

# Port-forwarding for local access
kubectl port-forward -n kubelab svc/frontend 8080:80    # UI
kubectl port-forward -n kubelab svc/backend 3000:3000  # API
kubectl port-forward -n kubelab svc/grafana 3000:3000  # Grafana
```

## Architecture

```
Browser → Frontend (React/Nginx :30080)
               ↓ /api/* proxied by Nginx
          Backend (Node.js :30081)
               ↓                    ↓
          PostgreSQL          Kubernetes API
```

**Backend** (`backend/src/`):
- Express server with `@kubernetes/client-node`
- Two auth modes: in-cluster (ServiceAccount token) or kubeconfig (local dev)
- Routes: `/api/cluster/*` for status, `/api/simulate/*` for failure scenarios
- Prometheus metrics at `/metrics`, health at `/health` and `/ready`

**Frontend** (`frontend/src/`):
- React + Vite + TailwindCSS
- Components: ClusterMap, ClusterOverview, SimulationPanel, EventsFeed
- `src/data/simulations.js` is the single source of truth for all simulation content
- Two modes: "guided" (sequential with gates) and "explore" (all unlocked)

**Kubernetes manifests** (`k8s/`):
- `base/` - namespace, frontend, backend, postgres (StatefulSet)
- `security/` - RBAC (ClusterRole for nodes, Role for kubelab namespace), NetworkPolicies
- `observability/` - Prometheus, Grafana, kube-state-metrics, node-exporter (DaemonSet)
- `simulation/` - Job manifests for stress tests (alternative to in-process stress)

## Important Patterns

**Backend simulation endpoints** (`backend/src/routes/simulation.js`):
- All simulations are POST-only
- CPU/memory stress runs in-process in the backend pod (not as separate Jobs)
- Memory stress uses `Buffer.alloc()` to trigger real OOMKill
- Readiness simulation uses a shared state module (`utils/readiness-state.js`) to fail `/ready` endpoint
- Concurrency guard prevents overlapping stress simulations

**K8s client initialization** (`backend/src/k8s-client.js`):
- Auto-detects in-cluster vs kubeconfig based on service account token presence
- Creates CoreV1Api, BatchV1Api, AppsV1Api clients

**RBAC requirements** (see `k8s/security/rbac.yaml`):
- Pods: get, list, watch, delete
- Nodes: get, list, watch, patch (for drain/uncordon)
- Jobs: get, list, watch, create, delete
- StatefulSets: get, list, watch, patch (for db-failure sim)
- Pods/eviction: create (for drain via Eviction API)

## Secrets

The deploy script requires `k8s/secrets.yaml` (not in git). Copy from template:
```bash
cp k8s/secrets.yaml.example k8s/secrets.yaml
```

## When Running in Docker Compose (Mock Mode)

- Backend sets `mockMode: true` in `/health` response when no service account token exists
- Frontend shows warning banner; simulations return fake responses
- Used for UI preview without a real cluster
