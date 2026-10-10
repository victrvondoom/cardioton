# Remote Kubernetes deployment (Supabase PostgreSQL)

This overlay deploys the existing frontend, FastAPI API, and independent Track 7 receiver to a Kubernetes cluster. PostgreSQL stays managed by Supabase. The overlay deliberately excludes the local kind PostgreSQL StatefulSet and the kind-specific network policy. It does not create or modify Supabase schema; the API's existing startup schema bootstrap is used.

## Configure

1. Build and publish `backend/` as the API image and `frontend/` as the web image to a registry available to your cluster. Use immutable version tags. Replace `ghcr.io/your-org/clinicase-api:SET_ME` in `api.yaml` and `receiver.yaml`, and `ghcr.io/your-org/clinicase-web:SET_ME` in `frontend.yaml` with your published image references.
2. Edit `configmap.yaml`: set `CORS_ORIGINS` to the exact public HTTPS origin used by the ingress/load balancer. Configure ingress and TLS using your cluster's ingress controller or cloud load balancer.
3. Confirm the Supabase database is a **staging project**, supports outbound access from the cluster, and the selected database user is permitted to run the application's startup DDL. Prefer a restricted application role over a project-owner credential. Use a TLS-required connection string (`sslmode=require`).
4. Create the secret interactively on a trusted operator machine. PowerShell example (prompts without echoing the URL; does not put it in history or argv):

   ```powershell
   $secureUrl = Read-Host 'Staging Supabase PostgreSQL URL (include sslmode=require)' -AsSecureString
   $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUrl)
   try { $dbUrl = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
   $jwt = Read-Host 'New random JWT secret' -AsSecureString
   $jwtPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($jwt)
   try { $jwtValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($jwtPtr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($jwtPtr) }
   $token = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   $demo = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   kubectl -n clinicase create secret generic clinicase-secrets --from-literal=DATABASE_URL=$dbUrl --from-literal=JWT_SECRET=$jwtValue --from-literal=INTEROP_RECEIVER_TOKEN=$token --from-literal=DEMO_USER_PASSWORD=$demo
   Remove-Variable dbUrl,jwtValue,secureUrl,jwt,ptr,jwtPtr,token,demo
   ```

   Kubernetes Secrets need encryption at rest and tightly scoped RBAC in the target cluster. For production, use the cluster's approved external secret manager (for example External Secrets Operator) rather than placing the URL in a manifest, command history, or CI log. Rotate the database password that was disclosed in chat before deployment.

## Render and deploy

```powershell
kubectl apply -k k8s/remote
kubectl -n clinicase get pods,svc
```

Expose the frontend Service through your ingress or cloud load balancer, terminate TLS there, and set `CORS_ORIGINS` to that origin. The namespace has default-deny policy: the API can reach public TCP 5432 (Supabase pooler), public TCP 443, the in-cluster receiver and frontend health endpoint. Confirm your CNI enforces Kubernetes NetworkPolicy. Database DNS/IP allow-listing should be applied at the Supabase/network layer where supported.

## Operational constraints

- `k8s/cluster.py` is only for local kind; this overlay does not invoke it.
- The API deployment has two replicas but SSE remains in-process with `REDIS_URL` empty. Live streams are not shared across replicas; use a supported Redis deployment and configure `REDIS_URL` before relying on multi-replica SSE.
- The receiver stores receipts in `emptyDir`; recreation loses System B receipt history. Use persistent storage before treating those receipts as durable evidence.
- This overlay supplies no ingress controller, TLS certificate, image registry, secret manager, backup policy, or cloud provisioning. A manifest apply is not proof the cluster is live or production-ready.
- Local kind manifests are unchanged and continue to use generated local secrets and bundled PostgreSQL.
