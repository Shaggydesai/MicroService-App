#!/usr/bin/env bash
# Prints a one-line fingerprint of what a saved Terraform plan would do: every resource address
# with its actions (create/update/delete), sorted, then hashed. The Terraform workflow compares the
# fingerprint of the approved preview with the plan it is about to apply.
#   scripts/tf-plan-changes.sh tfplan   ->   3:9f2c…  (number of changing resources : sha256)
set -euo pipefail
changes=$(terraform show -json "$1" |
  jq -c '[.resource_changes[]? | select(.change.actions != ["no-op"]) | {address, actions: .change.actions}] | sort_by(.address)')
count=$(jq 'length' <<<"$changes")
printf '%s:%s\n' "$count" "$(printf '%s' "$changes" | sha256sum | cut -c1-16)"
