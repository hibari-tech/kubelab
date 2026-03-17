# Cryptocurrency Infrastructure

This directory contains Kubernetes manifests for Bitcoin and Lightning Network nodes deployed as part of KubeLab's educational platform.

## Overview

KubeLab deploys real cryptocurrency infrastructure on Bitcoin **testnet** (not mainnet) to teach Kubernetes deployment patterns for blockchain applications. All deployments use:

- **Bitcoin testnet** - No real value, safe for learning
- **Pruned mode** - ~10GB storage instead of 500GB+ full node
- **StatefulSets** - Persistent storage and stable network identities
- **Prometheus exporters** - Full observability integration

## Components

### 1. Bitcoin Node (`bitcoin.yaml`)

- **Image**: `bitcoin/bitcoin:latest`
- **Network**: Bitcoin testnet
- **Mode**: Pruned (~10GB blockchain data)
- **Storage**: 15Gi PersistentVolumeClaim
- **Ports**:
  - `18332` - RPC (internal cluster access only)
  - `18333` - P2P networking (external)
  - `9332` - Prometheus metrics exporter

### 2. Lightning Node (`lightning.yaml`)

- **Image**: `lightninglabs/lnd:v0.17.0-beta.rc1`
- **Network**: Bitcoin testnet
- **Storage**: 5Gi PersistentVolumeClaim
- **Dependencies**: Waits for Bitcoin RPC readiness
- **Ports**:
  - `10009` - REST API (internal cluster access)
  - `9735` - P2P networking (external)
  - `9092` - Prometheus metrics exporter

## Prerequisites

### 1. Generate RPC Credentials

Create a secure password for Bitcoin RPC:

```bash
# Generate secure password
openssl rand -base64 32

# Create secrets file
cp secrets.yaml.example secrets.yaml

# Edit secrets.yaml and replace:
# - bitcoin-rpc-password with your generated password
# - Leave admin-macaroon empty for now (generate after first deployment)
```

### 2. Deploy Infrastructure

```bash
# From repository root
./scripts/deploy-all.sh
```

The deploy script will:
1. Check for `k8s/crypto/secrets.yaml`
2. Deploy Bitcoin StatefulSet
3. Wait for Bitcoin RPC to be ready (~5-10 minutes initial sync)
4. Deploy Lightning StatefulSet
5. Wait for Lightning to sync to chain

### 3. Generate Lightning Macaroon

After Lightning starts successfully, generate the admin macaroon:

```bash
# Get admin macaroon
kubectl exec -n kubelab lightning-0 -- cat /root/.lnd/data/chain/bitcoin/testnet/admin.macaroon | base64

# Update secrets.yaml with the base64-encoded macaroon
# Redeploy: kubectl apply -f k8s/crypto/secrets.yaml
# Restart Lightning: kubectl rollout restart statefulset/lightning -n kubelab
```

## Monitoring

### Check Sync Status

```bash
# Bitcoin blockchain info
kubectl exec -n kubelab bitcoin-0 -- bitcoin-cli -testnet getblockchaininfo

# Lightning node info
kubectl exec -n kubelab lightning-0 -- lncli getinfo
```

### View Logs

```bash
# Bitcoin logs
kubectl logs -n kubelab bitcoin-0 -c bitcoind -f

# Lightning logs
kubectl logs -n kubelab lightning-0 -c lnd -f

# Prometheus exporter logs
kubectl logs -n kubelab bitcoin-0 -c exporter -f
kubectl logs -n kubelab lightning-0 -c lnd-exporter -f
```

### Prometheus Metrics

```bash
# Port-forward Prometheus
kubectl port-forward -n kubelab svc/prometheus 9090:9090

# Query Bitcoin metrics
curl http://localhost:9090/api/v1/query?query=bitcoin_block_height

# Query Lightning metrics
curl http://localhost:9090/api/v1/query?query=lightning_channels_active
```

### Grafana Dashboard

```bash
# Port-forward Grafana
kubectl port-forward -n kubelab svc/grafana 3000:3000

# Open http://localhost:3000
# Navigate to "Crypto Overview" dashboard
```

## Simulations

KubeLab includes crypto-specific failure simulations:

### 1. Bitcoin Crash (`bitcoin-crash`)
Deletes the Bitcoin pod. StatefulSet recreates it with the same PVC.

```bash
kubectl delete pod bitcoin-0 -n kubelab
# Watch: kubectl get pods -n kubelab -w
```

**Learning**: StatefulSet recovery preserves blockchain data.

### 2. Bitcoin Sync Failure (`bitcoin-sync-failure`)
Corrupts blockchain index, forcing a full reindex.

```bash
kubectl exec -n kubelab bitcoin-0 -- rm -rf /root/.bitcoin/testnet3/blocks/index/*
kubectl exec -n kubelab bitcoin-0 -- bitcoin-cli -testnet stop
# Pod restarts and reindexes from scratch
```

**Learning**: PVC durability and recovery from corruption.

### 3. Lightning Channel Force-Close (`lightning-channel-force-close`)
Force-closes a Lightning channel, triggering time-locked settlement.

```bash
# List channels
kubectl exec -n kubelab lightning-0 -- lncli listchannels

# Force close first channel
CHANNEL_ID=$(kubectl exec -n kubelab lightning-0 -- lncli listchannels | jq -r '.channels[0].chan_id')
kubectl exec -n kubelab lightning-0 -- lncli closechannel --force $CHANNEL_ID
```

**Learning**: On-chain settlement and fund time-locks.

### 4. Network Partition (`crypto-network-partition`)
Blocks P2P traffic, isolating nodes from the network.

```bash
# Apply deny-all NetworkPolicy (automated via API)
# After 60s, policy is removed and nodes reconnect
```

**Learning**: Network partitions break consensus.

## Troubleshooting

### Bitcoin Won't Start

**Symptoms**: Pod in `CrashLoopBackOff`

**Solutions**:
1. Check logs: `kubectl logs -n kubelab bitcoin-0 -c bitcoind`
2. Verify PVC mounted: `kubectl describe pod bitcoin-0 -n kubelab`
3. Check RPC credentials in secrets.yaml
4. Increase memory limits if OOMKilled

### Lightning Can't Connect to Bitcoin

**Symptoms**: "connection refused" errors in logs

**Solutions**:
1. Verify Bitcoin RPC ready: `kubectl exec -n kubelab bitcoin-0 -- bitcoin-cli -testnet getblockchaininfo`
2. Check DNS: `kubectl exec -n kubelab lightning-0 -- nslookup bitcoin-0.bitcoin.kubelab.svc.cluster.local`
3. Verify NetworkPolicy allows Lightning → Bitcoin traffic
4. Check RPC credentials match in both StatefulSets

### Sync Taking Too Long

**Symptoms**: Bitcoin stuck at <10% for >1 hour

**Solutions**:
1. Check P2P connections: `kubectl exec -n kubelab bitcoin-0 -- bitcoin-cli -testnet getconnectioncount`
2. Verify NetworkPolicy allows egress to port 18333
3. Check resources: `kubectl top pod bitcoin-0 -n kubelab`
4. Increase pruned mode limit if disk full

### Prometheus Not Scraping Metrics

**Symptoms**: No data in Grafana dashboards

**Solutions**:
1. Verify exporters running: `kubectl logs -n kubelab bitcoin-0 -c exporter`
2. Check Prometheus config: `kubectl get configmap -n kubelab prometheus-config -o yaml`
3. Verify NetworkPolicy allows Prometheus → exporters
4. Test manually: `kubectl exec -it <prometheus-pod> -n kubelab -- wget http://bitcoin-0:9332/metrics`

## Security Notes

⚠️ **IMPORTANT**: This is for educational purposes only!

- **Testnet only** - No real Bitcoin or value at risk
- **No seed backups** - `--noseedbackup` flag used (NOT for production)
- **NetworkPolicies** - Default deny-all, explicit allow rules
- **Non-root containers** - All pods run as uid 1000
- **No external exposure** - Only accessible via kubectl port-forward
- **Secrets management** - Never commit `secrets.yaml` to git

## Production Considerations

For production deployments (not covered in KubeLab):

1. **Mainnet**: Remove `-testnet` flags, use mainnet ports (8332/8333)
2. **Full nodes**: Remove `-prune` flag, allocate 500GB+ storage
3. **Seed backups**: Remove `--noseedbackup`, implement secure backup strategy
4. **HSM**: Use hardware security modules for key management
5. **Multi-sig**: Implement multi-signature wallets
6. **Monitoring**: Add alerting rules for sync stalls, low disk space
7. **Backups**: CronJob to backup Lightning channel state
8. **Updates**: Regular security updates for Bitcoin/Lightning versions

## Resources

- [Bitcoin Core Documentation](https://bitcoincore.org/en/doc/)
- [LND Documentation](https://docs.lightning.engineering/)
- [Kubernetes StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
- [Bitcoin Testnet Faucet](https://testnet-faucet.mempool.co/) (get testnet coins)

## Related Files

- `k8s/security/network-policies.yaml` - Network access rules
- `backend/src/utils/bitcoin-client.js` - Bitcoin RPC wrapper
- `backend/src/utils/lightning-client.js` - Lightning REST wrapper
- `backend/src/routes/crypto.js` - Crypto status API
- `frontend/src/components/CryptoStatus.jsx` - Status dashboard
- `k8s/observability/dashboards/crypto-overview.json` - Grafana dashboard
