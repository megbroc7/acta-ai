from app.core.encryption import EncryptionError, decrypt_secret, encrypt_secret
from app.models.site import Site


class WordPressCredentialError(Exception):
    """Raised when WordPress credentials cannot be safely stored or resolved."""


def _decrypt_value(ciphertext: str) -> str:
    try:
        return decrypt_secret(ciphertext)
    except EncryptionError as exc:
        raise WordPressCredentialError(str(exc)) from exc


def set_wordpress_credentials(site: Site, *, username: str, app_password: str) -> None:
    username_clean = (username or "").strip()
    app_password_clean = (app_password or "").strip()
    if not username_clean or not app_password_clean:
        raise WordPressCredentialError(
            "WordPress username and app password are required"
        )

    try:
        site.wp_username_encrypted = encrypt_secret(username_clean)
        site.wp_app_password_encrypted = encrypt_secret(app_password_clean)
    except EncryptionError as exc:
        raise WordPressCredentialError(str(exc)) from exc

    # Clear legacy plaintext storage fields.
    site.username = None
    site.app_password = None


def resolve_wordpress_username(site: Site) -> str | None:
    if site.wp_username_encrypted:
        return _decrypt_value(site.wp_username_encrypted)
    return site.username


def resolve_wordpress_app_password(site: Site) -> str | None:
    if site.wp_app_password_encrypted:
        return _decrypt_value(site.wp_app_password_encrypted)
    return site.app_password


def resolve_wordpress_credentials(site: Site) -> tuple[str, str]:
    username = (resolve_wordpress_username(site) or "").strip()
    app_password = (resolve_wordpress_app_password(site) or "").strip()
    if not username or not app_password:
        raise WordPressCredentialError(
            "WordPress credentials are missing. Reconnect the site credentials and try again."
        )
    return username, app_password


def display_wordpress_username(site: Site) -> str | None:
    """Best-effort username used for API responses; never raises."""
    try:
        return resolve_wordpress_username(site)
    except WordPressCredentialError:
        return site.username
