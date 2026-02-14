"""add_experience_qa_to_templates

Revision ID: d3e4f5a6b7c8
Revises: b7c8d9e0f1a2
Create Date: 2026-02-13 18:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

# revision identifiers, used by Alembic.
revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, None] = "b7c8d9e0f1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "prompt_templates",
        sa.Column("experience_qa", JSON, nullable=True),
    )


def downgrade() -> None:
    op.drop_column("prompt_templates", "experience_qa")
