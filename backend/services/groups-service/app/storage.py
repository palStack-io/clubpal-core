import os
import re

STORAGE_ROOT = os.getenv("STORAGE_ROOT", "/data/storage")
STORAGE_PUBLIC_URL = os.getenv("STORAGE_PUBLIC_URL", "/storage")

BUCKET_EVENTS = "clubpal-events"

_SAFE_OBJECT_NAME = re.compile(r"^[A-Za-z0-9/_.-]+$")
_ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}


def _safe_path(bucket: str, object_name: str) -> str:
    """Reject path traversal and non-image extensions before touching disk."""
    if not _SAFE_OBJECT_NAME.match(object_name) or ".." in object_name.split("/"):
        raise ValueError(f"Unsafe object name: {object_name!r}")
    ext = object_name.rsplit(".", 1)[-1].lower() if "." in object_name else ""
    if ext not in _ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file extension: {ext!r}")
    return os.path.join(STORAGE_ROOT, bucket, object_name)


def ensure_buckets():
    """Ensure required storage directories exist."""
    os.makedirs(os.path.join(STORAGE_ROOT, BUCKET_EVENTS), exist_ok=True)


def public_object_url(bucket: str, object_name: str) -> str:
    """Return the permanent public URL for a stored object."""
    return f"{STORAGE_PUBLIC_URL}/{bucket}/{object_name}"


def upload_bytes(bucket: str, object_name: str, data: bytes,
                 content_type: str = "application/octet-stream") -> str:
    """Write raw bytes to local storage and return the public URL."""
    path = _safe_path(bucket, object_name)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return public_object_url(bucket, object_name)


def delete_object(bucket: str, object_name: str):
    """Delete an object from storage. Silently ignores missing/unsafe objects."""
    try:
        os.remove(_safe_path(bucket, object_name))
    except (FileNotFoundError, ValueError):
        pass
