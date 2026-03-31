---
name: kubernetes-alert-diagnosis
description: "Kubernetes Alert diagnosis tool. Trigger conditions: (1) User requests diagnosis/troubleshoot/analyze/check Kubernetes issues (e.g., 'diagnose this pod', 'troubleshoot node not ready', 'analyze why http://mydomain.com return 503 ); (2) User mentions Kubernetes object state (e.g., 'pod crashlooping', 'pod always restart'); (3) User directly mentions Prometheus alert names (e.g., KubePodCrashLooping, KubeNodeNotReady, KubeDeploymentRolloutStuck). Diagnostic workflow: Pre-check → Identify alert → Read runbook → Analyze root cause → Output report."
---

# Kubernetes Alert Diagnosis

## Diagnostic Workflow

0. **Pre-check** - Confirm required information
   - No namespace provided → Remind user to specify namespace or use `-A` to query all namespaces
   - No kubeconfig specified → Remind user to confirm kubeconfig path or use default `~/.kube/config`
1. **Identify Alert Type** - Match alert type based on user description
2. **Read Runbook** - Fetch corresponding runbook based on matched alert name to enrich troubleshooting context
3. **Diagnosis Analysis** - Analyze root cause based on runbook guidance and actual state
4. **Output Diagnostic Report** - Structured report with conclusions and recommendations

## Runbook Reference

Each Kubernetes alert has a corresponding runbook providing detailed troubleshooting steps:

**Runbook URL Format:**

```
https://runbooks.prometheus-operator.dev/runbooks/kubernetes/<alert-name>
```

**Examples:**

- `KubePodCrashLooping` → `https://runbooks.prometheus-operator.dev/runbooks/kubernetes/kubepodcrashlooping`
- `KubeNodeNotReady` → `https://runbooks.prometheus-operator.dev/runbooks/kubernetes/kubenodenotready`

**Usage:** After matching an alert, use WebFetch tool to read the corresponding runbook page to get:

- Issue description and causes
- Recommended diagnostic steps
- Common root causes and solutions

## Alert Categories

### Pod Issues

- `KubePodCrashLooping` → Pod in CrashLoopBackOff state
- `KubePodNotReady` → Pod in Pending or Unknown state for extended time
- `KubeContainerWaiting` → Container in waiting state for over 1 hour

**Auxiliary Diagnostic Commands** (optional):

```bash
kubectl get pod <pod> -n <ns> -o yaml
kubectl describe pod <pod> -n <ns>
kubectl logs <pod> -n <ns> [--previous]
kubectl events --field-selector involvedObject.name=<pod> -n <ns>
```

### Workload Issues

- `KubeDeploymentGenerationMismatch` / `KubeDeploymentReplicasMismatch` / `KubeDeploymentRolloutStuck`
- `KubeStatefulSetReplicasMismatch` / `KubeStatefulSetGenerationMismatch` / `KubeStatefulSetUpdateNotRolledOut`
- `KubeDaemonSetRolloutStuck` / `KubeDaemonSetNotScheduled` / `KubeDaemonSetMisScheduled`
- `KubeJobFailed` / `KubeJobNotCompleted`
- `KubeHpaReplicasMismatch` / `KubeHpaMaxedOut`
- `KubePdbNotEnoughHealthyPods` → PDB insufficient healthy replicas

**Auxiliary Diagnostic Commands** (optional):

```bash
kubectl get <kind> <name> -n <ns> -o yaml
kubectl describe <kind> <name> -n <ns>
kubectl get pods -n <ns> -l <selector> -o wide
kubectl rollout status <kind>/<name> -n <ns>
kubectl get events -n <ns> --field-selector involvedObject.name=<name>
```

### Node Issues

- `KubeNodeNotReady` - Node in NotReady state for extended time
- `KubeNodePressure` - MemoryPressure/DiskPressure/PIDPressure
- `KubeNodeUnreachable` - Node unreachable
- `KubeletTooManyPods` - Pod capacity approaching limit
- `KubeNodeReadinessFlapping` - Ready state frequently switching
- `KubeNodeEviction` - Node evicting Pods

**Auxiliary Diagnostic Commands** (optional):

```bash
kubectl get nodes -o wide
kubectl describe node <node>
kubectl get node <node> -o jsonpath='{.status.conditions}'
kubectl top node
kubectl get pods --all-namespaces -o wide --field-selector spec.nodeName=<node>
```

### Storage Issues

- `KubePersistentVolumeFillingUp` - PV space insufficient (<3% or predicted to fill within 4 days)
- `KubePersistentVolumeInodesFillingUp` - Inode shortage
- `KubePersistentVolumeErrors` - PV in Failed/Pending state

**Auxiliary Diagnostic Commands** (optional):

```bash
kubectl get pvc -n <ns>
kubectl describe pvc <pvc> -n <ns>
kubectl get pv
kubectl describe pv <pv>
kubectl top pod -n <ns> --containers
```

### Resource Issues

- `KubeCPUOvercommit` / `KubeMemoryOvercommit` - Cluster resource overcommit
- `KubeCPUQuotaOvercommit` / `KubeMemoryQuotaOvercommit` - Namespace quota overcommit
- `KubeQuotaAlmostFull` / `KubeQuotaFullyUsed` / `KubeQuotaExceeded` - Namespace quota issues
- `CPUThrottlingHigh` - High CPU throttling (>25%)

**Auxiliary Diagnostic Commands** (optional):

```bash
kubectl top nodes
kubectl top pods -A
kubectl describe quota -n <ns>
kubectl get resourcequota -n <ns>
kubectl describe pod <pod> -n <ns> | grep -A5 "Limits:"
```

### Control Plane Issues

- `KubeAPIDown` / `KubeAPIErrorBudgetBurn` / `KubeAPITerminatedRequests`
- `KubeClientCertificateExpiration` / `KubeAggregatedAPIErrors` / `KubeAggregatedAPIDown`
- `KubeletDown` / `KubeletPlegDurationHigh` / `KubeletPodStartUpLatencyHigh`
- `KubeletClientCertificateExpiration` / `KubeletServerCertificateExpiration`
- `KubeletClientCertificateRenewalErrors` / `KubeletServerCertificateRenewalErrors`
- `KubeSchedulerDown` / `KubeControllerManagerDown` / `KubeProxyDown`
- `KubeVersionMismatch` / `KubeClientErrors`

**Auxiliary Diagnostic Commands** (optional):

```bash
kubectl get componentstatuses
kubectl get pods -n kube-system -o wide
kubectl logs -n kube-system <component-pod>
kubectl cluster-info
kubectl version -o yaml
```

## Diagnostic Report Template

```markdown
## K8s Diagnostic Report

### Issue Overview

- **Alert Type**: [matched alert name]
- **Affected Object**: [namespace/pod or node name]
- **Severity**: [critical/warning/info]

### Root Cause Analysis

[analysis conclusions based on diagnostic command output]

### Diagnostic Evidence

[key kubectl output fragments]

### Recommended Actions

1. [specific actionable recommendations]
2. [next troubleshooting directions]

### Related Alerts

[other potentially related alert types]
```
