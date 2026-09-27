import json
from pathlib import Path
from .database import conn

CATALOG_PATH = Path(__file__).resolve().parents[2] / "catalog" / "catalog.json"

PRODUCT_COLUMNS = {
    "id": "INT PRIMARY KEY",
    "name": "VARCHAR(500) NOT NULL",
    "description": "TEXT",
    "price": "DECIMAL(12,2) NOT NULL",
    "emoji": "VARCHAR(16)",
    "stock": "INT DEFAULT 20",
    "brand": "VARCHAR(150)",
    "original_price": "DECIMAL(12,2)",
    "discount_percent": "DECIMAL(6,2)",
    "rating": "DECIMAL(3,2)",
    "review_count": "INT DEFAULT 0",
    "category": "VARCHAR(100)",
    "image_path": "VARCHAR(255)",
    "source_screenshot": "VARCHAR(500)",
    "specs_json": "JSON",
}

ORDER_COLUMNS = {
    "user_id": "INT NULL",
    "customer_name": "VARCHAR(150) NOT NULL",
    "email": "VARCHAR(255)",
    "phone": "VARCHAR(50) NOT NULL",
    "items": "JSON NOT NULL",
    "total_amount": "DECIMAL(12,2) NOT NULL",
    "status": "VARCHAR(30) DEFAULT 'PLACED'",
    "address": "TEXT",
    "notes": "TEXT",
    "payment_method": "VARCHAR(30) DEFAULT 'COD'",
    "payment_status": "VARCHAR(30) DEFAULT 'PENDING'",
    "payment_reference": "VARCHAR(100)",
}


def _columns(cursor, table: str) -> set[str]:
    cursor.execute(f"SHOW COLUMNS FROM `{table}`")
    return {r.get("Field", r.get("field")) for r in cursor.fetchall()}


def _ensure_table(cursor, table: str, ddl: str) -> None:
    cursor.execute(ddl)


def ensure_schema_and_catalog() -> int:
    catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    if len(catalog) != 311 or [int(x["id"]) for x in catalog] != list(range(1, 312)):
        raise RuntimeError("catalog.json must contain product IDs 1-311 exactly")

    with conn() as c:
        with c.cursor() as x:
            _ensure_table(x, "users", """CREATE TABLE IF NOT EXISTS users (
              id INT AUTO_INCREMENT PRIMARY KEY,
              full_name VARCHAR(150) NOT NULL,
              email VARCHAR(255) NOT NULL UNIQUE,
              password_hash VARCHAR(255) NOT NULL,
              phone VARCHAR(50),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4""")
            _ensure_table(x, "user_sessions", """CREATE TABLE IF NOT EXISTS user_sessions (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NOT NULL,
              token_hash CHAR(64) NOT NULL UNIQUE,
              expires_at DATETIME NOT NULL,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              INDEX idx_user_sessions_user (user_id),
              CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) CHARACTER SET utf8mb4""")
            _ensure_table(x, "products", """CREATE TABLE IF NOT EXISTS products (
              id INT PRIMARY KEY,
              name VARCHAR(500) NOT NULL,
              description TEXT,
              price DECIMAL(12,2) NOT NULL,
              emoji VARCHAR(16), stock INT DEFAULT 20,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              brand VARCHAR(150), original_price DECIMAL(12,2),
              discount_percent DECIMAL(6,2), rating DECIMAL(3,2),
              review_count INT DEFAULT 0, category VARCHAR(100),
              image_path VARCHAR(255), source_screenshot VARCHAR(500),
              specs_json JSON
            ) CHARACTER SET utf8mb4""")
            _ensure_table(x, "orders", """CREATE TABLE IF NOT EXISTS orders (
              id INT AUTO_INCREMENT PRIMARY KEY,
              user_id INT NULL,
              customer_name VARCHAR(150) NOT NULL,
              email VARCHAR(255), phone VARCHAR(50) NOT NULL,
              items JSON NOT NULL, total_amount DECIMAL(12,2) NOT NULL,
              status VARCHAR(30) DEFAULT 'PLACED', address TEXT, notes TEXT,
              payment_method VARCHAR(30) DEFAULT 'COD',
              payment_status VARCHAR(30) DEFAULT 'PENDING',
              payment_reference VARCHAR(100),
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) CHARACTER SET utf8mb4""")

            pcols = _columns(x, "products")
            if "id" not in pcols:
                raise RuntimeError("Existing products table has no id column; recreate it with database/00_schema.sql")
            for name, ddl in PRODUCT_COLUMNS.items():
                if name == "id":
                    continue
                if name not in pcols:
                    x.execute(f"ALTER TABLE products ADD COLUMN `{name}` {ddl}")

            ocols = _columns(x, "orders")
            if "id" not in ocols:
                raise RuntimeError("Existing orders table has no id column; recreate it with database/00_schema.sql")
            for name, ddl in ORDER_COLUMNS.items():
                if name not in ocols:
                    x.execute(f"ALTER TABLE orders ADD COLUMN `{name}` {ddl}")

            # Add the FK only when the column was newly introduced and the table is otherwise compatible.
            if "user_id" in _columns(x, "orders"):
                try:
                    x.execute("ALTER TABLE orders ADD INDEX idx_orders_user_id (user_id)")
                except Exception:
                    pass

            upsert = """INSERT INTO products
              (id,name,description,price,emoji,stock,brand,original_price,discount_percent,rating,review_count,category,image_path,source_screenshot,specs_json)
              VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
              ON DUPLICATE KEY UPDATE
                name=VALUES(name), description=VALUES(description), price=VALUES(price), emoji=VALUES(emoji),
                stock=VALUES(stock), brand=VALUES(brand), original_price=VALUES(original_price),
                discount_percent=VALUES(discount_percent), rating=VALUES(rating), review_count=VALUES(review_count),
                category=VALUES(category), image_path=VALUES(image_path), source_screenshot=VALUES(source_screenshot),
                specs_json=VALUES(specs_json)"""
            rows = []
            for p in catalog:
                rows.append((
                    int(p["id"]), p["name"], p.get("description", ""), float(p["price"]), "🛍️",
                    int(p.get("stock", 20)), p.get("brand", ""), p.get("originalPrice"),
                    p.get("discountPercent", 0), p.get("rating", 0), p.get("reviewCount", 0),
                    p.get("category", ""), p.get("image", ""), p.get("source", ""),
                    json.dumps(p.get("specs", {}), ensure_ascii=False),
                ))
            x.executemany(upsert, rows)
            x.execute("DELETE FROM products WHERE id < 1 OR id > 311")
            x.execute("SELECT COUNT(*) AS n FROM products")
            count = int(x.fetchone()["n"])
            if count != 311:
                raise RuntimeError(f"Catalog synchronization failed; expected 311 products, found {count}")
            return count
