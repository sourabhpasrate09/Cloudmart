# Terraform — AWS ECS + RDS

This is a production-oriented learning baseline for CloudMart: VPC, public/private subnets, NAT, ALB, ECS Fargate, ECR and private RDS MySQL.

1. Build and push the backend/frontend images to ECR (the outputs provide repository URLs).
2. Copy `terraform.tfvars.example` to `terraform.tfvars` and set `db_password`, `backend_image`, and `frontend_image`.
3. Run `terraform init`, `terraform validate`, `terraform plan`, then `terraform apply`.

Cost warning: NAT Gateway, RDS and ECS are billable AWS resources. Destroy the stack when finished learning.
