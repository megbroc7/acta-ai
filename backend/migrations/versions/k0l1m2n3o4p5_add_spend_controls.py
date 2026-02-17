"""Add spend controls: cost columns on execution_history + app_settings table.

Revision ID: k0l1m2n3o4p5
Revises: j9k0l1m2n3o4
Create Date: 2026-02-17
"""

from alembic import op
import sqlalchemy as sa


revision = "k0l1m2n3o4p5"
down_revision = "j9k0l1m2n3o4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Cost tracking columns on execution_history
    op.add_column("execution_history", sa.Column("prompt_tokens", sa.Integer(), nullable=True))
    op.add_column("execution_history", sa.Column("completion_tokens", sa.Integer(), nullable=True))
    op.add_column("execution_history", sa.Column("total_tokens", sa.Integer(), nullable=True))
    op.add_column("execution_history", sa.Column("estimated_cost_usd", sa.Float(), nullable=True))
    op.add_column("execution_history", sa.Column("image_cost_usd", sa.Float(), nullable=True))

    # Global app settings table (single-row config)
    op.create_table(
        "app_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("maintenance_mode", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("maintenance_message", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_by", sa.UUID(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    )

    # Seed the single config row
    op.execute("INSERT INTO app_settings (id, maintenance_mode) VALUES (1, false)")


def downgrade() -> None:
    op.drop_table("app_settings")
    op.drop_column("execution_history", "image_cost_usd")
    op.drop_column("execution_history", "estimated_cost_usd")
    op.drop_column("execution_history", "total_tokens")
    op.drop_column("execution_history", "completion_tokens")
    op.drop_column("execution_history", "prompt_tokens")
