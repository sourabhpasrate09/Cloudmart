# CloudMart — 311-product DevOps-ready marketplace

CloudMart is a 311-product e-commerce learning project with a static frontend, FastAPI backend and MySQL database. Product images are stored locally using the existing `product-###.jpg` filenames.

## Catalog
- Products: 311
- Product pages: 311
- Categories: Shoes, Smartphones, Clothing, Computers, Home & Kitchen, Furniture, Sports & Bicycles, Books & Stationery, Beauty & Personal Care, Bags & Accessories, Watches.
- Automotive and Toys & Games are not part of the catalog.
- `frontend/product-data.js`, `catalog/catalog.json`, and `database/CloudMart_311_AMAZON_SCREENSHOT.sql` use the same product IDs 1–311.

## Local development
1. Import `database/install_311.sql` into MySQL. This creates the required schema and loads the canonical 311-product catalog.
2. Copy `backend/.env.example` to `backend/.env` and set credentials.
3. From `backend/`, run `uvicorn app.main:app --reload --port 8000`.
4. Serve `frontend/` at `http://localhost:5500`.
5. The backend startup routine synchronizes product IDs 1–311 and adds missing compatibility columns to older CloudMart schemas.

## Checkout and orders
Checkout supports demo COD, UPI and card flows. Orders are stored in MySQL when the API is available and use browser storage as an offline preview fallback.

## DevOps / deployment
- `docker/` — backend/frontend container definitions and Nginx reverse proxy.
- `docker-compose.yml` — local multi-container environment.
- `k8s/` — Kubernetes manifests + Kustomize; use RDS or another managed MySQL service for production.
- `terraform/aws/` — AWS baseline with VPC, subnets, NAT, ALB, ECS Fargate, ECR and private RDS MySQL.
- `.github/workflows/ci.yml` — Python, JavaScript, Terraform and Docker validation/build workflow.
- `Jenkinsfile` — Jenkins CI/CD pipeline.

## Canonical files
- `frontend/product-data.js` — browser catalog used for offline/static rendering.
- `catalog/catalog.json` — backend catalog seed/synchronization source.
- `database/CloudMart_311_AMAZON_SCREENSHOT.sql` — canonical MySQL product catalog.
- `database/CloudMart_311_AMAZON_SCREENSHOT.csv` — CSV export of the catalog.
- `database/install_311.sql` — single MySQL installation script.

## Validation
Use `python scripts/validate_catalog.py` to verify 311 products, 311 detail pages and all referenced product images.

## AWS cost note
Terraform resources such as NAT Gateway, RDS and ECS are billable AWS services. Review the plan before applying and destroy the stack when finished learning.
