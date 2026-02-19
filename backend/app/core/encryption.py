from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


class EncryptionError(Exception):
    """Raised when encryption/decryption cannot be performed safely."""


@lru_cache(maxsize=1)
def _get_fernet() -> Fernet:
    key = (settings.ENCRYPTION_KEY or "").strip()
    if not key:
        raise EncryptionError("ENCRYPTION_KEY is required for secure token storage")
    try:
        return Fernet(key.encode("utf-8"))
    except Exception as exc:  # pragma: no cover - defensive
        raise EncryptionError("ENCRYPTION_KEY is invalid") from exc


def encrypt_secret(plaintext: str) -> str:
    try:
        token = _get_fernet().encrypt(plaintext.encode("utf-8"))
    except EncryptionError:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        raise EncryptionError("Failed to encrypt secret") from exc
    return token.decode("utf-8")


def decrypt_secret(ciphertext: str) -> str:
    try:
        plaintext = _get_fernet().decrypt(ciphertext.encode("utf-8"))
    except EncryptionError:
        raise
    except InvalidToken as exc:
        raise EncryptionError("Stored token could not be decrypted") from exc
    except Exception as exc:  # pragma: no cover - defensive
        raise EncryptionError("Failed to decrypt secret") from exc
    return plaintext.decode("utf-8")
