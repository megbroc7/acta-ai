"""drop plaintext wordpress columns

Revision ID: s8t9u0v1w2x3
Revises: r7s8t9u0v1w2
Create Date: 2026-02-20 20:05:00.000000
"""
from typing import Sequence, Union

import os

from alembic import op
from cryptography.fernet import Fernet
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "s8t9u0v1w2x3"
down_revision: Union[str, None] = "r7s8t9u0v1w2"
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
            "ENCRYPTION_KEY is required to restore plaintext WordPress columns during downgrade"
        )
    try:
        return Fernet(key.encode("utf-8"))
    except Exception as exc:
        raise RuntimeError("ENCRYPTION_KEY is invalid") from exc


def _decrypt(fernet: Fernet, value: str | None) -> str | None:
    if value is None:
        return None
    return fernet.decrypt(value.encode("utf-8")).decode("utf-8")


def upgrade() -> None:
    op.drop_column("sites", "app_password")
    op.drop_column("sites", "username")


def downgrade() -> None:
    op.add_column("sites", sa.Column("username", sa.String(length=255), nullable=True))
    op.add_column("sites", sa.Column("app_password", sa.String(length=255), nullable=True))

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
