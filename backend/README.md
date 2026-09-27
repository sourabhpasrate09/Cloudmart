# CloudMart FastAPI backend

## Local Python + MySQL
1. Create the `cloudmart` database and run `database/00_schema.sql`, then `database/CloudMart_311_AMAZON_SCREENSHOT.sql`.
2. Copy `.env.example` to `.env` and set DB credentials.
3. From `backend/` with the venv active: `pip install -r requirements.txt`
4. Start: `uvicorn app.main:app --reload --port 8000`
5. Open Swagger: `http://localhost:8000/docs`

The backend also synchronizes the packaged 311-product catalog at startup. It adds missing schema columns such as `image_path` and the order payment fields, then upserts product IDs 1-311. Existing orders are preserved.

## API
- `GET /api/health`
- `GET /api/categories`
- `GET /api/products?limit=1000`
- `GET /api/products/{id}`
- `GET /api/search/suggestions?q=...`
- `GET /api/deals`
- `GET /api/orders`
- `POST /api/orders`
