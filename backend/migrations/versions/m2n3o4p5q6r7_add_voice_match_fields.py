"""Add voice match fields to prompt_templates

Revision ID: m2n3o4p5q6r7
Revises: l1m2n3o4p5q6
Create Date: 2026-02-18 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "m2n3o4p5q6r7"
down_revision = "l1m2n3o4p5q6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("prompt_templates", sa.Column("writing_sample", sa.Text(), nullable=True))
    op.add_column(
        "prompt_templates",
        sa.Column("voice_match_active", sa.Boolean(), nullable=True, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("prompt_templates", "voice_match_active")
    op.drop_column("prompt_templates", "writing_sample")
