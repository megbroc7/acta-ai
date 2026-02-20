import base64
import uuid

import pytest
from cryptography.fernet import Fernet

from app.core import encryption as encryption_core
from app.core.config import settings
from app.models.site import Site
from app.services.publishing import _wp_auth_headers
from app.services.site_credentials import (
    WordPressCredentialError,
    display_wordpress_username,
    resolve_wordpress_credentials,
    set_wordpress_credentials,
)


@pytest.fixture
def _fresh_encryption_key(monkeypatch):
    monkeypatch.setattr(
        settings,
        "ENCRYPTION_KEY",
        Fernet.generate_key().decode("utf-8"),
        raising=False,
    )
    encryption_core._get_fernet.cache_clear()
    yield
    encryption_core._get_fernet.cache_clear()


def _wordpress_site(**overrides) -> Site:
    return Site(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        name="WP Site",
        url="https://example.com",
        api_url="https://example.com/wp-json",
        platform="wordpress",
        **overrides,
    )


def test_set_wordpress_credentials_encrypts_and_clears_plaintext(_fresh_encryption_key):
    site = _wordpress_site()

    set_wordpress_credentials(
        site,
        username="new-user",
        app_password="new-password",
    )

    assert site.wp_username_encrypted is not None
    assert site.wp_app_password_encrypted is not None
    assert site.wp_username_encrypted != "new-user"
    assert site.wp_app_password_encrypted != "new-password"

    username, app_password = resolve_wordpress_credentials(site)
    assert username == "new-user"
    assert app_password == "new-password"


def test_resolve_wordpress_credentials_requires_encrypted_values(_fresh_encryption_key):
    site = _wordpress_site(
        wp_username_encrypted=None,
        wp_app_password_encrypted=None,
    )

    with pytest.raises(
        WordPressCredentialError,
        match="WordPress credentials are missing",
    ):
        resolve_wordpress_credentials(site)


def test_display_wordpress_username_returns_none_if_ciphertext_invalid(_fresh_encryption_key):
    site = _wordpress_site(
        wp_username_encrypted="not-valid-ciphertext",
    )

    assert display_wordpress_username(site) is None


def test_publish_headers_use_decrypted_wordpress_credentials(_fresh_encryption_key):
    site = _wordpress_site()
    set_wordpress_credentials(
        site,
        username="publish-user",
        app_password="publish-password",
    )

    headers = _wp_auth_headers(site)
    encoded = headers["Authorization"].split(" ", 1)[1]
    decoded = base64.b64decode(encoded.encode("utf-8")).decode("utf-8")

    assert decoded == "publish-user:publish-password"
