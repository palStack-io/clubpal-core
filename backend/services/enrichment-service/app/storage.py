import os
import re
import httpx
from typing import Optional

STORAGE_ROOT = os.getenv("STORAGE_ROOT", "/data/storage")
STORAGE_PUBLIC_URL = os.getenv("STORAGE_PUBLIC_URL", "/storage")

BUCKET_CACHE = "clubpal-cache"

_SAFE_OBJECT_NAME = re.compile(r"^[A-Za-z0-9/_.-]+$")
_ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}


def _safe_path(object_name: str) -> str:
    """Reject path traversal and non-image extensions before touching disk."""
    if not _SAFE_OBJECT_NAME.match(object_name) or ".." in object_name.split("/"):
        raise ValueError(f"Unsafe object name: {object_name!r}")
    ext = object_name.rsplit(".", 1)[-1].lower() if "." in object_name else ""
    if ext not in _ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file extension: {ext!r}")
    return os.path.join(STORAGE_ROOT, BUCKET_CACHE, object_name)


def ensure_buckets():
    os.makedirs(os.path.join(STORAGE_ROOT, BUCKET_CACHE), exist_ok=True)


def public_object_url(object_name: str) -> str:
    return f"{STORAGE_PUBLIC_URL}/{BUCKET_CACHE}/{object_name}"


async def fetch_and_cache_image(url: str, object_key: str,
                                 content_type: str = "image/jpeg") -> Optional[str]:
    """Download image from external URL and store it locally. Returns public URL."""
    try:
        path = _safe_path(object_key)
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as http:
            resp = await http.get(url)
            if resp.status_code != 200:
                return None
            data = resp.content

        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
        return public_object_url(object_key)
    except Exception as e:
        print(f"Warning: Failed to cache image {url} → {object_key}: {e}")
        return None


def delete_object(object_key: str):
    try:
        os.remove(_safe_path(object_key))
    except (FileNotFoundError, ValueError):
        pass
