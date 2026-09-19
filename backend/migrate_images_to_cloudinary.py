#!/usr/bin/env python3
"""
migrate_images_to_cloudinary.py
────────────────────────────────────────────────────────────
Migrate ảnh từ Render local storage → Cloudinary CDN
và cập nhật URL trong Supabase database.

Chạy: python migrate_images_to_cloudinary.py

Yêu cầu: pip install cloudinary psycopg2-binary requests python-dotenv
"""

import os
import sys
import time
import requests
import cloudinary
import cloudinary.api
import cloudinary.uploader
import psycopg2
from dotenv import load_dotenv

# ─── Load env ────────────────────────────────────────────────
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# ─── Config ──────────────────────────────────────────────────
RENDER_BASE_URL = "https://hungph-blog-backend.onrender.com"  # URL production backend
DATABASE_URL = os.getenv("DATABASE_URL", "")
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")

# ─── Validate config ─────────────────────────────────────────
def validate():
    missing = []
    if not DATABASE_URL:
        missing.append("DATABASE_URL")
    if not CLOUDINARY_CLOUD_NAME:
        missing.append("CLOUDINARY_CLOUD_NAME")
    if not CLOUDINARY_API_KEY:
        missing.append("CLOUDINARY_API_KEY")
    if not CLOUDINARY_API_SECRET:
        missing.append("CLOUDINARY_API_SECRET")
    if missing:
        print("Missing env vars:")
        for m in missing:
            print(f"   - {m}")
        sys.exit(1)

# ─── Setup Cloudinary ────────────────────────────────────────
def setup_cloudinary():
    cloudinary.config(
        cloud_name=CLOUDINARY_CLOUD_NAME,
        api_key=CLOUDINARY_API_KEY,
        api_secret=CLOUDINARY_API_SECRET,
        secure=True,
    )
    result = cloudinary.api.ping()
    if result.get("status") != "ok":
        print("Cloudinary connection failed")
        sys.exit(1)
    print(f"Cloudinary connected: {CLOUDINARY_CLOUD_NAME}")

# ─── Get DB connection ────────────────────────────────────────
def get_db_conn():
    db_url = DATABASE_URL
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    db_url = db_url.replace("postgres://", "postgresql://")
    return psycopg2.connect(db_url)

# ─── Upload image to Cloudinary ──────────────────────────────
def upload_to_cloudinary(image_url: str, public_id_prefix: str):
    if image_url.startswith("/uploads/"):
        full_url = f"{RENDER_BASE_URL}{image_url}"
    elif image_url.startswith("http") and "onrender.com" in image_url and "/uploads/" in image_url:
        full_url = image_url
    else:
        # Already on external CDN or unknown — skip
        return None

    filename = image_url.split("/")[-1].rsplit(".", 1)[0]
    public_id = f"hungph_blog/{public_id_prefix}/{filename}"

    print(f"   Downloading: {full_url}")
    try:
        resp = requests.get(full_url, timeout=30)
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"   Failed to download: {e}")
        return None

    print(f"   Uploading to Cloudinary as: {public_id}")
    try:
        result = cloudinary.uploader.upload(
            resp.content,
            public_id=public_id,
            resource_type="image",
            overwrite=True,
            invalidate=True,
        )
        new_url = result["secure_url"]
        print(f"   OK: {new_url}")
        return new_url
    except Exception as e:
        print(f"   Cloudinary upload failed: {e}")
        return None

# ─── Migrate Posts ────────────────────────────────────────────
def migrate_posts(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT id, title, cover_image FROM posts
        WHERE cover_image IS NOT NULL
          AND (cover_image LIKE '/uploads/%' OR cover_image LIKE '%onrender.com/uploads/%')
        ORDER BY created_at DESC;
    """)
    posts = cur.fetchall()
    print(f"\nFound {len(posts)} posts with images to migrate")

    migrated = 0
    failed = 0
    for post_id, title, cover_image in posts:
        print(f"\n  Post: {title[:60]}")
        new_url = upload_to_cloudinary(cover_image, "posts")
        if new_url:
            cur.execute("UPDATE posts SET cover_image = %s WHERE id = %s", (new_url, post_id))
            conn.commit()
            migrated += 1
        else:
            failed += 1
        time.sleep(0.3)

    print(f"\nPosts migrated: {migrated} | Failed: {failed}")
    cur.close()

# ─── Migrate Series ───────────────────────────────────────────
def migrate_series(conn):
    cur = conn.cursor()
    cur.execute("""
        SELECT id, title, cover_image FROM series
        WHERE cover_image IS NOT NULL
          AND (cover_image LIKE '/uploads/%' OR cover_image LIKE '%onrender.com/uploads/%')
        ORDER BY created_at DESC;
    """)
    series_list = cur.fetchall()
    print(f"\nFound {len(series_list)} series/courses with images to migrate")

    migrated = 0
    failed = 0
    for series_id, title, cover_image in series_list:
        print(f"\n  Series: {title[:60]}")
        new_url = upload_to_cloudinary(cover_image, "series")
        if new_url:
            cur.execute("UPDATE series SET cover_image = %s WHERE id = %s", (new_url, series_id))
            conn.commit()
            migrated += 1
        else:
            failed += 1
        time.sleep(0.3)

    print(f"\nSeries migrated: {migrated} | Failed: {failed}")
    cur.close()

# ─── Summary ─────────────────────────────────────────────────
def print_summary(conn):
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM posts WHERE cover_image LIKE '%cloudinary.com%'")
    posts_on_cdn = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM series WHERE cover_image LIKE '%cloudinary.com%'")
    series_on_cdn = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM posts WHERE cover_image LIKE '/uploads/%' OR cover_image LIKE '%onrender.com/uploads/%'")
    posts_remaining = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM series WHERE cover_image LIKE '/uploads/%' OR cover_image LIKE '%onrender.com/uploads/%'")
    series_remaining = cur.fetchone()[0]
    print(f"""
=== Migration Summary ===
Posts on Cloudinary:    {posts_on_cdn}
Series on Cloudinary:   {series_on_cdn}
Posts still on Render:  {posts_remaining}
Series still on Render: {series_remaining}
""")
    cur.close()

# ─── Main ─────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 50)
    print("  Image Migration: Render -> Cloudinary -> Supabase")
    print("=" * 50)

    validate()
    setup_cloudinary()

    print(f"\nConnecting to Supabase database...")
    try:
        conn = get_db_conn()
        print("Database connected")
    except Exception as e:
        print(f"Database connection failed: {e}")
        sys.exit(1)

    try:
        migrate_posts(conn)
        migrate_series(conn)
        print_summary(conn)
    finally:
        conn.close()
        print("Migration complete!")
