# Optional: bare-metal / on-prem load balancing (MetalLB)

The lab runs on GKE, where Google provides `LoadBalancer` Services, so MetalLB is **not deployed**.
The root app (`gitops/argocd/root-app.yaml`) only reads `gitops/argocd/`, so nothing in this folder syncs.
It's kept, validated by CI, so the same platform runs on a bare-metal or home-lab cluster.

| File | Purpose |
|---|---|
| `argocd/metallb.yaml` | Argo CD Application: MetalLB chart 0.16.1 (sync wave -29) |
| `argocd/metallb-config.yaml` | Argo CD Application: the address pool below (sync wave -28) |
| `values/metallb.yaml` | Chart values (requests, ServiceMonitor for Prometheus) |
| `manifests/address-pool.yaml` | `IPAddressPool` + `L2Advertisement` |

## Enable on a bare-metal cluster

1. Edit `manifests/address-pool.yaml`: a free range on your node network that DHCP doesn't hand out.
2. Move both Applications into the synced folder:
   `git mv gitops/optional/bare-metal/argocd/*.yaml gitops/argocd/platform/`
3. In `gitops/platform/values/ingress-nginx.yaml`, replace `loadBalancerIP: 8.234.83.188` with
   ```yaml
   annotations:
     metallb.universe.tf/loadBalancerIPs: <one IP from your pool>
   ```
4. In `gitops/platform/manifests/vault/vault.yaml`, swap `unsealConfig.google` for
   `unsealConfig.kubernetes` (the comment there shows it) and drop the `iam.gke.io` annotation in `rbac.yaml`.
5. Change the `*.8-234-83-188.sslip.io` hostnames to names that resolve to that IP, and use
   `shopverse-ca-issuer` if Let's Encrypt can't reach the cluster from the internet.
6. Commit and merge to `main`; Argo CD does the rest.
