"""encrypt wordpress credentials

Revision ID: r7s8t9u0v1w2
Revises: q6r7s8t9u0v1
Create Date: 2026-02-20 19:05:00.000000
"""
from typing import Sequence, Union

import os

from alembic import op
from cryptography.fernet import Fernet
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "r7s8t9u0v1w2"
down_revision: Union[str, None] = "q6r7s8t9u0v1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


sites_table = sa.table(
    "sites",
    sa.column("id", sa.UUID()),
    sa.column("username", sa.String(length=255)),
    sa.column("app_password", sa.String(length=255)),
    sa.column("wp_username_encrypted", sa.String(length=5000)),
    sa.column("wp_app_password_encrypted", sa.String(length=5000)),
)


def _load_fernet() -> Fernet:
    key = (os.getenv("ENCRYPTION_KEY") or "").strip()
    if not key:
        raise RuntimeError(
            "ENCRYPTION_KEY is required to migrate WordPress credentials to encrypted storage"
        )
    try:
        return Fernet(key.encode("utf-8"))
    except Exception as exc:
        raise RuntimeError("ENCRYPTION_KEY is invalid") from exc


def _encrypt(fernet: Fernet, value: str | None) -> str | None:
    if value is None:
        return None
    return fernet.encrypt(value.encode("utf-8")).decode("utf-8")


def _decrypt(fernet: Fernet, value: str | None) -> str | None:
    if value is None:
        return None
    return fernet.decrypt(value.encode("utf-8")).decode("utf-8")


def upgrade() -> None:
    op.add_column("sites", sa.Column("wp_username_encrypted", sa.String(length=5000), nullable=True))
    op.add_column("sites", sa.Column("wp_app_password_encrypted", sa.String(length=5000), nullable=True))

    connection = op.get_bind()
    rows = connection.execute(
        sa.select(
            sites_table.c.id,
            sites_table.c.username,
            sites_table.c.app_password,
        ).where(
            sa.or_(
                sites_table.c.username.is_not(None),
                sites_table.c.app_password.is_not(None),
            )
        )
    ).mappings()

    fernet = _load_fernet()
    for row in rows:
        connection.execute(
            sa.update(sites_table)
            .where(sites_table.c.id == row["id"])
            .values(
                wp_username_encrypted=_encrypt(fernet, row["username"]),
                wp_app_password_encrypted=_encrypt(fernet, row["app_password"]),
                username=None,
                app_password=None,
            )
        )


def downgrade() -> None:
    connection = op.get_bind()
    rows = connection.execute(
        sa.select(
            sites_table.c.id,
            sites_table.c.wp_username_encrypted,
            sites_table.c.wp_app_password_encrypted,
        ).where(
            sa.or_(
                sites_table.c.wp_username_encrypted.is_not(None),
                sites_table.c.wp_app_password_encrypted.is_not(None),
            )
        )
    ).mappings()

    fernet = _load_fernet()
    for row in rows:
        connection.execute(
            sa.update(sites_table)
            .where(sites_table.c.id == row["id"])
            .values(
                username=_decrypt(fernet, row["wp_username_encrypted"]),
                app_password=_decrypt(fernet, row["wp_app_password_encrypted"]),
            )
        )

    op.drop_column("sites", "wp_app_password_encrypted")
    op.drop_column("sites", "wp_username_encrypted")
