import os
import io
from datetime import timedelta
from minio import Minio
from minio.error import S3Error

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "clubpal")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "clubpalpassword")
MINIO_PUBLIC_URL = os.getenv("MINIO_PUBLIC_URL", "http://localhost:9000/storage")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

BUCKET_EVENTS = "clubpal-events"

client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=MINIO_SECURE,
)


def ensure_buckets():
    """Ensure required storage buckets exist."""
    try:
        if not client.bucket_exists(BUCKET_EVENTS):
            client.make_bucket(BUCKET_EVENTS)
    except S3Error as e:
        print(f"Warning: Could not create bucket {BUCKET_EVENTS}: {e}")


def _public_url(internal_url: str) -> str:
    """Replace internal MinIO host with the public nginx-proxied URL."""
    return internal_url.replace(f"http://{MINIO_ENDPOINT}", MINIO_PUBLIC_URL)


def presigned_upload_url(bucket: str, object_name: str, content_type: str,
                         expires_minutes: int = 15) -> str:
    """Generate a pre-signed PUT URL for direct client-side upload."""
    url = client.presigned_put_object(
        bucket,
        object_name,
        expires=timedelta(minutes=expires_minutes),
    )
    return _public_url(url)


def public_object_url(bucket: str, object_name: str) -> str:
    """Return the permanent public URL for a publicly readable object."""
    return f"{MINIO_PUBLIC_URL}/{bucket}/{object_name}"


def delete_object(bucket: str, object_name: str):
    """Delete an object from storage. Silently ignores missing objects."""
    try:
        client.remove_object(bucket, object_name)
    except S3Error:
        pass
