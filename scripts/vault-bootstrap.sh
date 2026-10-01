#!/usr/bin/env bash
# One-time (idempotent) Vault setup for ShopVerse:
#   1. initialise + unseal Vault (unseal keys/root token saved to ./vault-init.json - KEEP IT SAFE, never commit it)
#   2. enable KV v2 at secret/ and Kubernetes auth
#   3. create the read-only policy + role used by External Secrets Operator
#   4. seed secret/shopverse/<env> and secret/platform/grafana with random values (existing ones are kept)
#
# Usage: scripts/vault-bootstrap.sh [envs...]        (default: dev prod)
# Re-run after a Vault pod restart to unseal it again.
set -euo pipefail

NS=${VAULT_NAMESPACE:-vault}
POD=${VAULT_POD:-vault-0}
INIT_FILE=${VAULT_INIT_FILE:-vault-init.json}
ESO_SA=${ESO_SERVICE_ACCOUNT:-external-secrets}
ESO_NS=${ESO_NAMESPACE:-external-secrets}
ENVS=("$@")
[[ $# -eq 0 ]] && ENVS=(dev prod)

command -v jq >/dev/null || { echo "jq is required"; exit 1; }
v() { kubectl -n "$NS" exec -i "$POD" -- env VAULT_TOKEN="${ROOT_TOKEN:-}" vault "$@"; }
rand() { openssl rand -hex "${1:-24}"; }

echo "==> Waiting for pod $NS/$POD"
kubectl -n "$NS" wait --for=jsonpath='{.status.phase}'=Running "pod/$POD" --timeout=300s >/dev/null

STATUS=$(kubectl -n "$NS" exec "$POD" -- vault status -format=json || true)
if [[ $(jq -r .initialized <<<"$STATUS") != "true" ]]; then
  echo "==> Initialising Vault (5 key shares, threshold 3)"
  kubectl -n "$NS" exec "$POD" -- vault operator init -key-shares=5 -key-threshold=3 -format=json > "$INIT_FILE"
  chmod 600 "$INIT_FILE"
  echo "    Unseal keys + root token written to $INIT_FILE. Move them to a password manager!"
fi
[[ -f $INIT_FILE ]] || { echo "Vault is initialised but $INIT_FILE is missing; unseal manually."; exit 1; }

# `vault status` exits 2 while sealed, so don't let pipefail abort here
if [[ $( (kubectl -n "$NS" exec "$POD" -- vault status -format=json || true) | jq -r .sealed) == "true" ]]; then
  echo "==> Unsealing"
  for i in 0 1 2; do
    kubectl -n "$NS" exec "$POD" -- vault operator unseal "$(jq -r ".unseal_keys_b64[$i]" "$INIT_FILE")" >/dev/null
  done
fi
ROOT_TOKEN=$(jq -r .root_token "$INIT_FILE")

echo "==> KV v2 engine at secret/"
v secrets list -format=json | jq -e '."secret/"' >/dev/null || v secrets enable -path=secret kv-v2

echo "==> Kubernetes auth"
v auth list -format=json | jq -e '."kubernetes/"' >/dev/null || v auth enable kubernetes
kubectl -n "$NS" exec "$POD" -- sh -c \
  "VAULT_TOKEN=$ROOT_TOKEN vault write auth/kubernetes/config kubernetes_host=https://\$KUBERNETES_PORT_443_TCP_ADDR:443" >/dev/null

echo "==> Policy + role for External Secrets Operator"
v policy write external-secrets - <<'HCL'
path "secret/data/*"     { capabilities = ["read"] }
path "secret/metadata/*" { capabilities = ["read", "list"] }
HCL
v write auth/kubernetes/role/external-secrets \
  bound_service_account_names="$ESO_SA" \
  bound_service_account_namespaces="$ESO_NS" \
  policies=external-secrets ttl=1h >/dev/null

seed() { # path key=value...
  local path=$1; shift
  if v kv get "secret/$path" >/dev/null 2>&1; then
    echo "    secret/$path exists, keeping it"
  else
    v kv put "secret/$path" "$@" >/dev/null
    echo "    secret/$path created"
  fi
}

echo "==> Seeding secrets"
for env in "${ENVS[@]}"; do
  seed "shopverse/$env" \
    jwt-secret="$(rand 32)" \
    internal-token="$(rand 32)" \
    admin-email="admin@shopverse.local" \
    admin-password="$(rand 12)" \
    mongo-username=shopverse \
    mongo-password="$(rand 24)"
done
seed platform/grafana admin-user=admin admin-password="$(rand 16)"

cat <<MSG

Done. Useful commands:
  ShopVerse admin password (dev): kubectl -n $NS exec $POD -- env VAULT_TOKEN=\$(jq -r .root_token $INIT_FILE) vault kv get -field=admin-password secret/shopverse/dev
  Grafana admin password:         kubectl -n monitoring get secret grafana-admin -o jsonpath='{.data.admin-password}' | base64 -d
  Force ESO to re-sync now:       kubectl annotate externalsecret -A --all force-sync=\$(date +%s) --overwrite
MSG
