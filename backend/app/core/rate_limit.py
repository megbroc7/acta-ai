from collections import defaultdict, deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request, status

from app.core.config import settings


def get_rate_limit_key(request: Request) -> str:
    """Resolve request key for auth rate limiting."""
    if settings.RATE_LIMIT_TRUST_PROXY_HEADERS:
        x_forwarded_for = request.headers.get("X-Forwarded-For")
        if x_forwarded_for:
            # X-Forwarded-For can contain multiple comma-separated hops.
            first_ip = x_forwarded_for.split(",")[0].strip()
            if first_ip:
                return first_ip

    if request.client and request.client.host:
        return request.client.host

    return "unknown"


def _parse_rate_limit(limit: str) -> tuple[int, int]:
    """
    Parse strings like `5/minute` into (count, window_seconds).
    """
    try:
        count_text, period = limit.strip().split("/", 1)
        count = int(count_text)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"Invalid rate limit format: {limit!r}") from exc

    windows = {
        "second": 1,
        "minute": 60,
        "hour": 3600,
        "day": 86400,
    }
    if period not in windows:
        raise ValueError(f"Unsupported rate limit period: {period!r}")
    if count <= 0:
        raise ValueError("Rate limit count must be positive")

    return count, windows[period]


class InMemoryRateLimiter:
    """
    Fixed-window limiter keyed by endpoint bucket + client identity.
    """

    def __init__(self) -> None:
        self._hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, *, key: str, bucket: str, limit: str) -> tuple[bool, int]:
        max_requests, window_seconds = _parse_rate_limit(limit)
        now = monotonic()
        bucket_key = (bucket, key)

        with self._lock:
            hit_times = self._hits[bucket_key]
            cutoff = now - window_seconds
            while hit_times and hit_times[0] <= cutoff:
                hit_times.popleft()

            if len(hit_times) >= max_requests:
                retry_after = max(1, int(hit_times[0] + window_seconds - now))
                return False, retry_after

            hit_times.append(now)
            return True, 0


limiter = InMemoryRateLimiter()


def enforce_rate_limit(request: Request, *, bucket: str, limit: str) -> None:
    key = get_rate_limit_key(request)
    allowed, retry_after = limiter.check(key=key, bucket=bucket, limit=limit)
    if allowed:
        return

    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail="Too many requests. Please try again later.",
        headers={"Retry-After": str(retry_after)},
    )
