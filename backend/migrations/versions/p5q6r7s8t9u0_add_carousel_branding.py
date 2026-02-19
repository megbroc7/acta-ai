"""Add carousel_branding to prompt_templates

Revision ID: p5q6r7s8t9u0
Revises: 796f1623951b
Create Date: 2026-02-19
"""

from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision: str = "p5q6r7s8t9u0"
down_revision: Union[str, None] = "796f1623951b"
branch_labels: Union[str, None] = None
depends_on: Union[str, None] = None


def upgrade() -> None:
    op.add_column(
        "prompt_templates",
        sa.Column("carousel_branding", JSON, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("prompt_templates", "carousel_branding")
