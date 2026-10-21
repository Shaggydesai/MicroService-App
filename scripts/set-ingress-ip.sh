#!/usr/bin/env bash
# Writes the ingress IP into everything in Git that depends on it: ingress-nginx's loadBalancerIP and
# every <name>.<a-b-c-d>.sslip.io hostname (Argo CD, Grafana, Prometheus, Vault, shop-dev, shop).
#
#   scripts/set-ingress-ip.sh              # new IP = output of the persistent Terraform layer
#   scripts/set-ingress-ip.sh 34.93.1.20   # or give it explicitly
#
# Then review `git diff`, commit on a branch, open a PR and merge it BEFORE applying the cluster layer:
# Argo CD deploys whatever main says.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
cd "$ROOT"

NEW=${1:-$(terraform -chdir=infra/terraform/envs/lab/persistent output -raw ingress_ip 2>/dev/null || true)}
if [[ ! "$NEW" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  echo "No valid IP. Reserve one first (terraform apply -var reserve_ingress_ip=true in persistent/)," >&2
  echo "or pass it: $0 <ip>" >&2
  exit 1
fi

# The IP currently in Git is the one ingress-nginx asks for.
OLD=$(sed -nE 's/^ *loadBalancerIP: *([0-9.]+).*/\1/p' gitops/platform/values/ingress-nginx.yaml)
if [[ -z "$OLD" ]]; then
  echo "Could not find loadBalancerIP in gitops/platform/values/ingress-nginx.yaml" >&2
  exit 1
fi
if [[ "$OLD" == "$NEW" ]]; then
  echo "Git already uses $NEW; nothing to do."
  exit 0
fi

OLD_DASH=${OLD//./-}
NEW_DASH=${NEW//./-}
OLD_DOTS=${OLD//./\\.}

# Only tracked files under gitops/ and the root README; nothing else mentions the IP.
mapfile -t FILES < <(git grep -lE "${OLD_DASH}|${OLD_DOTS}" -- gitops README.md)
for f in "${FILES[@]}"; do
  sed -i -e "s/${OLD_DASH}/${NEW_DASH}/g" -e "s/${OLD_DOTS}/${NEW}/g" "$f"
  echo "updated $f"
done

echo
echo "Ingress IP in Git: $OLD -> $NEW (${#FILES[@]} files). New URLs, for example:"
echo "  https://shop-dev.${NEW_DASH}.sslip.io"
echo "  https://argocd.${NEW_DASH}.sslip.io"
echo "Next: git diff, commit on a branch, PR, merge; then apply the cluster layer."
