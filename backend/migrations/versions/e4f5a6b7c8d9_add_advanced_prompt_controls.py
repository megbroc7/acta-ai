"""add target_reader, call_to_action, preferred_terms to prompt_templates

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-02-13

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "e4f5a6b7c8d9"
down_revision = "d3e4f5a6b7c8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("prompt_templates", sa.Column("target_reader", sa.Text(), nullable=True))
    op.add_column("prompt_templates", sa.Column("call_to_action", sa.Text(), nullable=True))
    op.add_column("prompt_templates", sa.Column("preferred_terms", postgresql.JSON(), nullable=True))


def downgrade():
    op.drop_column("prompt_templates", "preferred_terms")
    op.drop_column("prompt_templates", "call_to_action")
    op.drop_column("prompt_templates", "target_reader")
