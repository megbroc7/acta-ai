"""Error classification for schedule execution failures.

Maps raw exception messages to user-friendly categories with actionable guidance.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class ErrorClassification:
    category: str
    user_title: str
    user_guidance: str
    is_transient: bool


# Category → guidance mapping
ERROR_GUIDANCE: dict[str, ErrorClassification] = {
    "api_rate_limit": ErrorClassification(
        category="api_rate_limit",
        user_title="OpenAI Rate Limited",
        user_guidance="Your requests hit OpenAI's rate limit. This usually resolves within a minute. Check your OpenAI usage dashboard if it persists.",
        is_transient=True,
    ),
    "api_auth": ErrorClassification(
        category="api_auth",
        user_title="OpenAI API Key Invalid",
        user_guidance="The OpenAI API key is invalid or has been revoked. Verify the key in your environment configuration.",
        is_transient=False,
    ),
    "api_quota": ErrorClassification(
        category="api_quota",
        user_title="OpenAI Quota Exceeded",
        user_guidance="Your OpenAI account has exceeded its spending limit. Add billing credits at platform.openai.com.",
        is_transient=False,
    ),
    "api_timeout": ErrorClassification(
        category="api_timeout",
        user_title="OpenAI Timeout",
        user_guidance="The request to OpenAI timed out. This is usually temporary — the next run should succeed.",
        is_transient=True,
    ),
    "publish_auth": ErrorClassification(
        category="publish_auth",
        user_title="Site Credentials Rejected",
        user_guidance="Your site rejected the login credentials. Update your username and app password in Sites.",
        is_transient=False,
    ),
    "publish_connection": ErrorClassification(
        category="publish_connection",
        user_title="Site Unreachable",
        user_guidance="Could not connect to your site. Verify the URL is correct and the site is online.",
        is_transient=True,
    ),
    "publish_timeout": ErrorClassification(
        category="publish_timeout",
        user_title="Publishing Timeout",
        user_guidance="Publishing timed out. The post was saved as a draft — you can publish it manually.",
        is_transient=True,
    ),
    "content_error": ErrorClassification(
        category="content_error",
        user_title="Content Generation Failed",
        user_guidance="An error occurred during content generation. Check the error log for details.",
        is_transient=True,
    ),
    "image_error": ErrorClassification(
        category="image_error",
        user_title="Image Generation Failed",
        user_guidance="Featured image generation failed. The article was created without an image — you can add one manually.",
        is_transient=True,
    ),
    "config_error": ErrorClassification(
        category="config_error",
        user_title="Configuration Missing",
        user_guidance="The schedule or template is missing required configuration. Edit the schedule to fix.",
        is_transient=False,
    ),
    "unknown": ErrorClassification(
        category="unknown",
        user_title="Unexpected Error",
        user_guidance="An unexpected error occurred. Check the error log for details.",
        is_transient=True,
    ),
}

# Substring patterns → category (checked in order, first match wins)
_PATTERNS: list[tuple[str, str]] = [
    # OpenAI rate limits
    ("rate limit", "api_rate_limit"),
    ("rate_limit", "api_rate_limit"),
    ("429", "api_rate_limit"),
    # OpenAI auth
    ("invalid api key", "api_auth"),
    ("incorrect api key", "api_auth"),
    ("authentication", "api_auth"),
    ("api key", "api_auth"),
    # OpenAI quota
    ("quota", "api_quota"),
    ("billing", "api_quota"),
    ("insufficient_quota", "api_quota"),
    ("exceeded your current quota", "api_quota"),
    # Publishing auth (before generic timeout/auth patterns)
    ("publishing failed", "publish_auth"),
    ("rest_forbidden", "publish_auth"),
    # Content errors (before generic timeout patterns)
    ("content generation failed", "content_error"),
    ("generation failed", "content_error"),
    # Image errors
    ("image generation", "image_error"),
    ("dall-e", "image_error"),
    ("unsplash", "image_error"),
    # Config errors
    ("template not found", "config_error"),
    ("no topics configured", "config_error"),
    ("configuration", "config_error"),
    ("experience notes", "config_error"),
    # Publishing connection
    ("connection refused", "publish_connection"),
    ("connectionerror", "publish_connection"),
    ("name or service not known", "publish_connection"),
    ("could not connect", "publish_connection"),
    ("site unreachable", "publish_connection"),
    ("site is not active", "publish_connection"),
    # Publishing timeout
    ("publishing timeout", "publish_timeout"),
    # Publishing auth (generic patterns)
    ("401", "publish_auth"),
    ("403", "publish_auth"),
    ("unauthorized", "publish_auth"),
    ("forbidden", "publish_auth"),
    ("credentials", "publish_auth"),
    # OpenAI timeout (generic — after more specific matches)
    ("timeout", "api_timeout"),
    ("timed out", "api_timeout"),
    ("read timeout", "api_timeout"),
]


def classify_error(error_message: str) -> str:
    """Classify a raw error message into a category string.

    Returns the category key (e.g. 'api_rate_limit', 'publish_auth').
    Falls back to 'unknown' if no pattern matches.
    """
    if not error_message:
        return "unknown"

    lower = error_message.lower()
    for pattern, category in _PATTERNS:
        if pattern in lower:
            return category

    return "unknown"


def get_guidance(category: str) -> ErrorClassification:
    """Get the full ErrorClassification for a category.

    Returns the 'unknown' classification if the category is not recognized.
    """
    return ERROR_GUIDANCE.get(category, ERROR_GUIDANCE["unknown"])
