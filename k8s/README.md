# CloudMart Kubernetes deployment

For local learning, install an Ingress controller (for example NGINX Ingress), create the secret from `secret.example.yaml`, replace the Docker image names in `backend.yaml` and `frontend.yaml`, then apply `kustomization.yaml`.

The MySQL manifest is suitable for a development/demo cluster. For production, use a managed MySQL service such as Amazon RDS and point `DB_HOST` at it.
