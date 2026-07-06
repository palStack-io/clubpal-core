import os
import io
import httpx
from typing import Optional
from minio import Minio
from minio.error import S3Error

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "clubpal")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "clubpalpassword")
MINIO_PUBLIC_URL = os.getenv("MINIO_PUBLIC_URL", "/storage")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"
MINIO_REGION = os.getenv("MINIO_REGION", "garage")

BUCKET_CACHE = "clubpal-cache"

client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=MINIO_SECURE,
    region=MINIO_REGION,
)


import json as _json

_PUBLIC_READ_POLICY = _json.dumps({
    "Version": "2012-10-17",
    "Statement": [{
        "Effect": "Allow",
        "Principal": {"AWS": ["*"]},
        "Action": ["s3:GetObject"],
        "Resource": [f"arn:aws:s3:::{BUCKET_CACHE}/*"],
    }]
})


def ensure_buckets():
    try:
        if not client.bucket_exists(BUCKET_CACHE):
            client.make_bucket(BUCKET_CACHE)
        client.set_bucket_policy(BUCKET_CACHE, _PUBLIC_READ_POLICY)
    except S3Error as e:
        print(f"Warning: Could not create bucket {BUCKET_CACHE}: {e}")


def public_object_url(object_name: str) -> str:
    return f"{MINIO_PUBLIC_URL}/{BUCKET_CACHE}/{object_name}"


async def fetch_and_cache_image(url: str, object_key: str,
                                 content_type: str = "image/jpeg") -> Optional[str]:
    """Download image from external URL and store in MinIO. Returns public URL."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as http:
            resp = await http.get(url)
            if resp.status_code != 200:
                return None
            data = resp.content
            ct = resp.headers.get("content-type", content_type).split(";")[0]

        client.put_object(
            BUCKET_CACHE,
            object_key,
            io.BytesIO(data),
            length=len(data),
            content_type=ct,
        )
        return public_object_url(object_key)
    except Exception as e:
        print(f"Warning: Failed to cache image {url} → {object_key}: {e}")
        return None


def delete_object(object_key: str):
    try:
        client.remove_object(BUCKET_CACHE, object_key)
    except S3Error:
        pass
