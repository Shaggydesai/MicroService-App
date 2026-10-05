#!/usr/bin/env bash
# Lists everything in the lab project that can cost money, so you can confirm a teardown worked.
set -euo pipefail
PROJECT=${PROJECT:-shopverse-lab}

section() { printf '\n== %s\n' "$1"; }

section "GKE clusters"
gcloud container clusters list --project "$PROJECT" --format="table(name,location,status,currentNodeCount)"
section "VM instances (nodes)"
gcloud compute instances list --project "$PROJECT" --format="table(name,zone.basename(),status,scheduling.provisioningModel)"
section "Persistent disks"
gcloud compute disks list --project "$PROJECT" --format="table(name,zone.basename(),sizeGb,users.len():label=ATTACHED)"
section "Load balancers (forwarding rules)"
gcloud compute forwarding-rules list --project "$PROJECT" --format="table(name,region.basename(),IPAddress)"
section "Static IPs (RESERVED = unused, still billed)"
gcloud compute addresses list --project "$PROJECT" --format="table(name,region.basename(),address,status)"
echo
echo "Expected after scripts/lab-down.sh: no clusters, instances, disks or forwarding rules;"
echo "one address 'shopverse-ingress' in status RESERVED (kept on purpose)."
