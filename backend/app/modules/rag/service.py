"""
RAG Service — Embedding, FAISS Vector Store, Gemini Q&A
=========================================================
Architecture:
  - Embedding model: Gemini text-embedding-004 (free tier, 768-dim)
  - Vector store: FAISS flat L2 index (local file, no infra needed)
  - LLM: Gemini 1.5 Flash (fast, free tier 15 RPM)
  - Index auto-rebuilds on post publish/update

SQLite giữ nguyên cho dữ liệu chính.
FAISS chỉ là file phụ để tìm kiếm ngữ nghĩa.
"""

import os
import json
import pickle
import logging
import re
from pathlib import Path
from typing import List, Optional, Tuple, Any

import numpy as np

logger = logging.getLogger(__name__)

# ── Paths ──────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
FAISS_INDEX_PATH = BASE_DIR / "faiss.index"
FAISS_METADATA_PATH = BASE_DIR / "faiss_metadata.pkl"
EMBEDDING_CACHE_PATH = BASE_DIR / "embedding_cache.pkl"

# ── Lazy-loaded FAISS index & Cache ────────────────────────────────────────
_faiss_index = None
_chunk_metadata: List[dict] = []
_embedding_cache: dict = {}


def _load_embedding_cache() -> dict:
    global _embedding_cache
    if _embedding_cache:
        return _embedding_cache
    if EMBEDDING_CACHE_PATH.exists():
        try:
            with open(EMBEDDING_CACHE_PATH, "rb") as f:
                _embedding_cache = pickle.load(f)
        except Exception:
            _embedding_cache = {}
    return _embedding_cache


def _save_embedding_cache():
    global _embedding_cache
    try:
        with open(EMBEDDING_CACHE_PATH, "wb") as f:
            pickle.dump(_embedding_cache, f)
    except Exception as e:
        logger.warning(f"Không thể lưu embedding cache: {e}")


def _get_gemini_client():
    """Lazy init google-generativeai client."""
    import google.generativeai as genai
    from app.core.config import settings
    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY chưa được cấu hình trong .env")
    genai.configure(api_key=settings.GEMINI_API_KEY)
    return genai


def strip_html(html: str) -> str:
    """Strip HTML tags và trả về plain text."""
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, "html.parser")
        return soup.get_text(separator=" ", strip=True)
    except Exception:
        return re.sub(r"<[^>]+>", " ", html)


def chunk_text(text: str, chunk_size: int = 400, overlap: int = 60) -> List[str]:
    """Chia text thành các chunk nhỏ có overlap."""
    words = text.split()
    if not words:
        return []
    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunks.append(" ".join(words[start:end]))
        if end == len(words):
            break
        start += chunk_size - overlap
    return chunks


EMBEDDING_MODEL = "models/gemini-embedding-001"
LLM_MODEL = "gemini-2.5-flash"


def embed_texts(texts: List[str]) -> np.ndarray:
    """Embed danh sách text bằng Gemini embedding model với cache và rate-limit handling."""
    import time
    import hashlib

    cache = _load_embedding_cache()
    genai = _get_gemini_client()
    import google.generativeai as genai_module

    embeddings_map = {}
    missing_indices = []
    missing_texts = []

    for idx, t in enumerate(texts):
        key = hashlib.sha256(t.strip().encode("utf-8")).hexdigest()
        if key in cache:
            embeddings_map[idx] = cache[key]
        else:
            missing_indices.append(idx)
            missing_texts.append((key, t))

    if missing_texts:
        batch_size = 5
        for i in range(0, len(missing_texts), batch_size):
            batch_slice = missing_texts[i:i + batch_size]
            batch_content = [item[1] for item in batch_slice]
            
            max_retries = 5
            last_err = None
            for attempt in range(max_retries):
                try:
                    result = genai_module.embed_content(
                        model=EMBEDDING_MODEL,
                        content=batch_content,
                        task_type="retrieval_document"
                    )
                    embs = result["embedding"]
                    if isinstance(embs[0], float):
                        embs = [embs]
                    
                    for sub_idx, emb in enumerate(embs):
                        orig_idx = missing_indices[i + sub_idx]
                        k = batch_slice[sub_idx][0]
                        cache[k] = emb
                        embeddings_map[orig_idx] = emb
                    
                    _save_embedding_cache()
                    break
                except Exception as e:
                    last_err = e
                    # Nếu gặp quota 429 hoặc rate limit, chờ 15s - 25s
                    wait_time = 15 + (attempt * 5)
                    logger.warning(f"RAG embed batch {i//batch_size} lần {attempt+1} lỗi: {e}. Đợi {wait_time}s...")
                    time.sleep(wait_time)
            else:
                raise last_err

            # Giãn cách 1.5s giữa các batch
            time.sleep(1.5)

    all_embeddings = [embeddings_map[i] for i in range(len(texts))]
    return np.array(all_embeddings, dtype=np.float32)


def embed_query(query: str) -> np.ndarray:
    """Embed một câu query bằng Gemini."""
    import google.generativeai as genai_module
    _get_gemini_client()

    result = genai_module.embed_content(
        model=EMBEDDING_MODEL,
        content=query,
        task_type="retrieval_query"
    )
    embedding = result["embedding"]
    return np.array([embedding], dtype=np.float32)


# ── Index Building ─────────────────────────────────────────────────────────

def build_index_from_posts(posts_data: List[dict]) -> Tuple[int, int]:
    """
    Nhận danh sách post dicts, tạo FAISS index.

    posts_data: [{"id", "title", "slug", "summary", "content_html", "content_markdown"}]
    Returns: (num_posts, num_chunks)
    """
    import faiss

    all_chunks = []
    all_metadata = []

    for post in posts_data:
        # Lấy nội dung text: ưu tiên markdown, fallback sang HTML stripped
        raw_content = post.get("content_markdown") or strip_html(post.get("content_html", ""))
        title = post.get("title", "")
        summary = post.get("summary", "")

        # Prepend title + summary cho context đầy đủ
        full_text = f"{title}. {summary}. {raw_content}".strip()

        if not full_text or len(full_text) < 50:
            continue

        chunks = chunk_text(full_text, chunk_size=400, overlap=60)

        for idx, chunk in enumerate(chunks):
            all_chunks.append(chunk)
            all_metadata.append({
                "post_id": post["id"],
                "title": post["title"],
                "slug": post["slug"],
                "summary": post.get("summary", ""),
                "chunk_index": idx,
                "snippet": chunk[:250],  # preview
            })

    if not all_chunks:
        logger.warning("RAG: Không có chunks nào để index.")
        return 0, 0

    logger.info(f"RAG: Đang embed {len(all_chunks)} chunks từ {len(posts_data)} bài viết...")

    # Embed all chunks
    embeddings = embed_texts(all_chunks)

    # Build FAISS Flat L2 index
    dim = embeddings.shape[1]  # 768 for text-embedding-004
    index = faiss.IndexFlatIP(dim)  # Inner product (cosine với normalized vectors)

    # Normalize for cosine similarity
    faiss.normalize_L2(embeddings)
    index.add(embeddings)

    # Save index and metadata
    faiss.write_index(index, str(FAISS_INDEX_PATH))
    with open(FAISS_METADATA_PATH, "wb") as f:
        pickle.dump(all_metadata, f)

    # Reset in-memory cache
    global _faiss_index, _chunk_metadata
    _faiss_index = index
    _chunk_metadata = all_metadata

    logger.info(f"RAG: Index xây dựng xong — {len(posts_data)} bài, {len(all_chunks)} chunks, dim={dim}")
    return len(posts_data), len(all_chunks)


def load_index() -> bool:
    """Load FAISS index từ disk vào memory."""
    global _faiss_index, _chunk_metadata
    import faiss

    if not FAISS_INDEX_PATH.exists() or not FAISS_METADATA_PATH.exists():
        return False

    try:
        _faiss_index = faiss.read_index(str(FAISS_INDEX_PATH))
        with open(FAISS_METADATA_PATH, "rb") as f:
            _chunk_metadata = pickle.load(f)
        logger.info(f"RAG: Loaded FAISS index — {_faiss_index.ntotal} vectors, {len(_chunk_metadata)} chunks")
        return True
    except Exception as e:
        logger.error(f"RAG: Lỗi load index: {e}")
        return False


def search_similar(query: str, top_k: int = 5) -> List[dict]:
    """Tìm kiếm các chunks tương đồng nhất với query."""
    global _faiss_index, _chunk_metadata
    import faiss

    # Load index nếu chưa có
    if _faiss_index is None:
        if not load_index():
            return []

    # Embed query
    q_vec = embed_query(query)
    faiss.normalize_L2(q_vec)

    # Search
    scores, indices = _faiss_index.search(q_vec, min(top_k * 2, _faiss_index.ntotal))

    results = []
    seen_posts = set()

    for score, idx in zip(scores[0], indices[0]):
        if idx < 0 or idx >= len(_chunk_metadata):
            continue
        meta = _chunk_metadata[idx]
        # Deduplicate: chỉ lấy chunk đại diện nhất của mỗi bài
        post_slug = meta["slug"]
        if post_slug in seen_posts:
            continue
        seen_posts.add(post_slug)

        results.append({
            **meta,
            "similarity_score": float(score),
        })
        if len(results) >= top_k:
            break

    return results


# ── Answer Generation ──────────────────────────────────────────────────────

def generate_answer(query: str, context_chunks: List[dict]) -> str:
    """
    Gọi Gemini Flash để trả lời câu hỏi dựa trên context từ blog.
    """
    if not context_chunks:
        return "Xin lỗi, tôi không tìm thấy thông tin liên quan trong blog. Hãy thử đặt câu hỏi khác!"

    import google.generativeai as genai_module
    _get_gemini_client()

    context = "\n\n---\n\n".join([
        f"Bài viết: {c['title']}\n{c['snippet']}"
        for c in context_chunks
    ])

    prompt = f"""Bạn là trợ lý AI của blog kỹ thuật HungPH.Blog — chuyên về kiến trúc phần mềm, backend hiệu năng cao và AI/ML.

Dưới đây là các đoạn trích từ các bài viết trên blog liên quan đến câu hỏi của người dùng:

{context}

---

Câu hỏi: {query}

Hãy trả lời dựa vào nội dung blog ở trên. Trả lời bằng tiếng Việt, súc tích nhưng đầy đủ thông tin. Nếu câu hỏi không liên quan đến nội dung blog, hãy nói "Tôi chỉ có thể trả lời các câu hỏi liên quan đến nội dung trong blog này."

Phong cách trả lời: chuyên nghiệp, kỹ thuật nhưng dễ hiểu."""

    model = genai_module.GenerativeModel(LLM_MODEL)
    response = model.generate_content(
        prompt,
        generation_config=genai_module.GenerationConfig(
            temperature=0.3,
            max_output_tokens=800,
        )
    )

    return response.text


# ── Single-post re-index (tự động khi publish) ────────────────────────────

def update_post_in_index(post: dict):
    """
    Cập nhật hoặc thêm 1 bài viết vào FAISS index hiện có.
    Được gọi tự động khi bài viết publish/update.
    Nếu index chưa có thì bỏ qua (sẽ được rebuild lần sau).
    """
    global _faiss_index, _chunk_metadata

    if not FAISS_INDEX_PATH.exists():
        # Index chưa được build lần đầu → bỏ qua, admin sẽ build sau
        logger.info(f"RAG: Index chưa tồn tại, skip auto-update cho post '{post.get('title')}'")
        return

    try:
        import faiss

        if _faiss_index is None:
            load_index()

        # Remove existing chunks for this post
        post_slug = post.get("slug", "")
        _chunk_metadata = [m for m in _chunk_metadata if m["slug"] != post_slug]

        # Re-chunk and re-embed the post
        raw_content = post.get("content_markdown") or strip_html(post.get("content_html", ""))
        full_text = f"{post.get('title', '')}. {post.get('summary', '')}. {raw_content}".strip()

        if not full_text or len(full_text) < 50:
            return

        chunks = chunk_text(full_text, chunk_size=400, overlap=60)
        new_embeddings = embed_texts(chunks)
        faiss.normalize_L2(new_embeddings)

        for idx, chunk in enumerate(chunks):
            _chunk_metadata.append({
                "post_id": post["id"],
                "title": post["title"],
                "slug": post_slug,
                "summary": post.get("summary", ""),
                "chunk_index": idx,
                "snippet": chunk[:250],
            })

        _faiss_index.add(new_embeddings)

        # Persist updated index
        faiss.write_index(_faiss_index, str(FAISS_INDEX_PATH))
        with open(FAISS_METADATA_PATH, "wb") as f:
            pickle.dump(_chunk_metadata, f)

        logger.info(f"RAG: Auto-updated index cho post '{post.get('title')}' — {len(chunks)} chunks thêm vào")

    except Exception as e:
        logger.error(f"RAG: Lỗi khi auto-update index: {e}")
        # Non-critical — không crash main flow
