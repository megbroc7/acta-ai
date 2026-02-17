"""add error_category and notifications

Revision ID: l1m2n3o4p5q6
Revises: k0l1m2n3o4p5
Create Date: 2026-02-17 20:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "l1m2n3o4p5q6"
down_revision = "k0l1m2n3o4p5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add error_category to execution_history
    op.add_column(
        "execution_history",
        sa.Column("error_category", sa.String(30), nullable=True),
    )

    # Create notifications table
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("action_url", sa.String(500), nullable=True),
        sa.Column("action_label", sa.String(50), nullable=True),
        sa.Column("is_read", sa.Boolean, default=False, nullable=False),
        sa.Column(
            "schedule_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("blog_schedules.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "execution_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("execution_history.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # Index for badge count query
    op.create_index(
        "ix_notifications_user_read",
        "notifications",
        ["user_id", "is_read"],
    )


def downgrade() -> None:
    op.drop_index("ix_notifications_user_read", table_name="notifications")
    op.drop_table("notifications")
    op.drop_column("execution_history", "error_category")
