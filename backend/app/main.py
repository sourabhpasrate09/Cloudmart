from contextlib import asynccontextmanager
import hashlib
import json
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from .database import conn
from .catalog_sync import ensure_schema_and_catalog


def _cors_origins():
    raw = os.getenv("CORS_ORIGINS", "http://localhost:5500,http://127.0.0.1:5500")
    return [x.strip() for x in raw.split(",") if x.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_schema_and_catalog()
    yield


app = FastAPI(title="CloudMart API", version="4.1", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled(request: Request, exc: Exception):
    detail = str(exc) if os.getenv("DEBUG_ERRORS", "false").lower() == "true" else "Internal server error"
    return JSONResponse(status_code=500, content={"detail": detail})


def many(sql, args=()):
    with conn() as c:
        with c.cursor() as x:
            x.execute(sql, args)
            return x.fetchall()


def one(sql, args=()):
    with conn() as c:
        with c.cursor() as x:
            x.execute(sql, args)
            return x.fetchone()


SELECT = """id,name,description,brand,category,price,
        original_price AS originalPrice,discount_percent AS discountPercent,
        rating,review_count AS reviewCount,stock,emoji,
        image_path AS image,source_screenshot AS source,specs_json"""


def normalize_product(p):
    p = dict(p)
    raw = p.pop("specs_json", None)
    try:
        p["specs"] = json.loads(raw or "{}")
    except Exception:
        p["specs"] = {}
    return p


# ---------------------------------------------------------------------------
# Customer authentication helpers
# ---------------------------------------------------------------------------
PBKDF2_ITERATIONS = 200_000
SESSION_DAYS = 30


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"{salt.hex()}${digest.hex()}"


def _verify_password(password: str, encoded: str) -> bool:
    try:
        salt_hex, digest_hex = encoded.split("$", 1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(digest_hex)
        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
        return secrets.compare_digest(actual, expected)
    except Exception:
        return False


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _current_user(request: Request):
    header = request.headers.get("Authorization", "")
    if not header.lower().startswith("bearer "):
        return None
    token = header[7:].strip()
    if not token:
        return None
    row = one(
        """SELECT u.id,u.full_name,u.email,u.phone,u.created_at
           FROM user_sessions s
           JOIN users u ON u.id=s.user_id
           WHERE s.token_hash=%s AND s.expires_at>UTC_TIMESTAMP()""",
        (_token_hash(token),),
    )
    return row


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=150)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=6, max_length=128)
    phone: Optional[str] = Field(default="", max_length=50)


class LoginRequest(BaseModel):
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=6, max_length=128)


class Item(BaseModel):
    product_id: int
    name: str
    price: float
    quantity: int = Field(ge=1)


class Order(BaseModel):
    customer_name: str
    email: Optional[str] = None
    phone: str
    address: str
    notes: Optional[str] = ""
    items: List[Item]
    total_amount: float
    payment_method: str = Field(default="COD", pattern="^(COD|UPI|CARD)$")
    payment_reference: Optional[str] = None


@app.get("/")
def root():
    return {"service": "CloudMart API", "status": "ok", "catalog": 311}


@app.get("/api/health")
def health():
    try:
        row = one("SELECT COUNT(*) AS n FROM products")
        return {"status": "healthy", "database": "connected", "catalog": int(row["n"])}
    except Exception as e:
        raise HTTPException(503, f"Database unavailable: {e}")


@app.get("/api/categories")
def categories():
    return [x["category"] for x in many("SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category<>'' ORDER BY category")]


@app.get("/api/products")
def products(search: str = "", category: str = "", categories: str = "", limit: int = 1000, offset: int = 0):
    w, args = [], []
    if search:
        w.append("(name LIKE %s OR brand LIKE %s OR category LIKE %s)")
        q = "%" + search + "%"
        args += [q, q, q]
    if category:
        w.append("category=%s")
        args.append(category)
    if categories:
        cs = [x.strip() for x in categories.split(",") if x.strip()]
        if cs:
            w.append("category IN (" + ",".join(["%s"] * len(cs)) + ")")
            args += cs
    wh = (" WHERE " + " AND ".join(w)) if w else ""
    total = int(one("SELECT COUNT(*) AS n FROM products" + wh, args)["n"])
    lim = min(max(int(limit), 1), 1000)
    off = max(int(offset), 0)
    rows = many("SELECT " + SELECT + " FROM products" + wh + " ORDER BY id LIMIT %s OFFSET %s", args + [lim, off])
    return {"items": [normalize_product(r) for r in rows], "total": total}


@app.get("/api/products/{pid}")
def product(pid: int):
    p = one("SELECT " + SELECT + " FROM products WHERE id=%s", (pid,))
    if not p:
        raise HTTPException(404, "Product not found")
    return normalize_product(p)


@app.get("/api/search/suggestions")
def suggestions(q: str = ""):
    if not q.strip():
        return []
    x = "%" + q.strip() + "%"
    return [r["name"] for r in many("SELECT DISTINCT name FROM products WHERE name LIKE %s OR brand LIKE %s OR category LIKE %s ORDER BY name LIMIT 8", (x, x, x))]


@app.get("/api/deals")
def deals(category: str = "", limit: int = 1000):
    args = []
    w = " WHERE discount_percent IS NOT NULL AND discount_percent>0"
    if category:
        w += " AND category=%s"
        args.append(category)
    rows = many("SELECT " + SELECT + " FROM products" + w + " ORDER BY discount_percent DESC,id LIMIT %s", args + [min(max(int(limit), 1), 1000)])
    return {"items": [normalize_product(r) for r in rows]}


# ---------------------------------------------------------------------------
# Customer auth API
# ---------------------------------------------------------------------------
@app.post("/api/auth/register")
def register(payload: RegisterRequest):
    email = payload.email.strip().lower()
    full_name = payload.full_name.strip()
    if not full_name or len(full_name) < 2:
        raise HTTPException(400, "Full name is required")
    if "@" not in email:
        raise HTTPException(400, "Enter a valid email address")
    existing = one("SELECT id FROM users WHERE email=%s", (email,))
    if existing:
        raise HTTPException(409, "An account with this email already exists")
    with conn() as c:
        with c.cursor() as x:
            x.execute(
                "INSERT INTO users(full_name,email,password_hash,phone) VALUES(%s,%s,%s,%s)",
                (full_name, email, _hash_password(payload.password), payload.phone.strip()),
            )
            user_id = x.lastrowid
    user = one("SELECT id,full_name,email,phone,created_at FROM users WHERE id=%s", (user_id,))
    token = secrets.token_urlsafe(32)
    with conn() as c:
        with c.cursor() as x:
            x.execute(
                "INSERT INTO user_sessions(user_id,token_hash,expires_at) VALUES(%s,%s,%s)",
                (user_id, _token_hash(token), datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)),
            )
    return {"message": "Account created", "token": token, "user": user}


@app.post("/api/auth/login")
def login(payload: LoginRequest):
    email = payload.email.strip().lower()
    user = one("SELECT id,full_name,email,phone,created_at,password_hash FROM users WHERE email=%s", (email,))
    if not user or not _verify_password(payload.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    token = secrets.token_urlsafe(32)
    with conn() as c:
        with c.cursor() as x:
            x.execute(
                "INSERT INTO user_sessions(user_id,token_hash,expires_at) VALUES(%s,%s,%s)",
                (user["id"], _token_hash(token), datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)),
            )
    user = dict(user)
    user.pop("password_hash", None)
    return {"message": "Login successful", "token": token, "user": user}


@app.get("/api/auth/me")
def me(request: Request):
    user = _current_user(request)
    if not user:
        raise HTTPException(401, "Not authenticated")
    return {"user": user}


@app.post("/api/auth/logout")
def logout(request: Request):
    header = request.headers.get("Authorization", "")
    token = header[7:].strip() if header.lower().startswith("bearer ") else ""
    if token:
        with conn() as c:
            with c.cursor() as x:
                x.execute("DELETE FROM user_sessions WHERE token_hash=%s", (_token_hash(token),))
    return {"message": "Logged out"}


@app.post("/api/orders")
def create(o: Order, request: Request):
    if not o.items:
        raise HTTPException(400, "Cart is empty")
    user = _current_user(request)
    payment_status = "PAID" if o.payment_method in ("UPI", "CARD") else "PENDING"
    try:
        with conn() as c:
            with c.cursor() as x:
                x.execute(
                    """INSERT INTO orders(user_id,customer_name,email,phone,items,total_amount,status,address,notes,payment_method,payment_status,payment_reference)
                       VALUES(%s,%s,%s,%s,%s,%s,'PLACED',%s,%s,%s,%s,%s)""",
                    (
                        user["id"] if user else None,
                        o.customer_name,
                        o.email,
                        o.phone,
                        json.dumps([i.model_dump() for i in o.items], ensure_ascii=False),
                        o.total_amount,
                        o.address,
                        o.notes,
                        o.payment_method,
                        payment_status,
                        o.payment_reference,
                    ),
                )
                oid = x.lastrowid
    except Exception as e:
        raise HTTPException(503, f"Could not write order: {e}")
    return {"message": "Order placed successfully", "order_id": oid, "payment_status": payment_status}


@app.get("/api/orders")
def orders(request: Request):
    user = _current_user(request)
    if user:
        rows = many(
            "SELECT id,customer_name,email,phone,items,total_amount,status,address,notes,payment_method,payment_status,payment_reference,created_at FROM orders WHERE user_id=%s ORDER BY id DESC LIMIT 100",
            (user["id"],),
        )
    else:
        rows = many(
            "SELECT id,customer_name,email,phone,items,total_amount,status,address,notes,payment_method,payment_status,payment_reference,created_at FROM orders ORDER BY id DESC LIMIT 100"
        )
    out = []
    for row in rows:
        item_data = row.get("items") or "[]"
        try:
            item_data = json.loads(item_data)
        except Exception:
            item_data = []
        row = dict(row)
        row["items"] = item_data
        out.append(row)
    return {"items": out}
