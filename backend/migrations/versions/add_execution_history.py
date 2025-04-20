"""Add execution history table

Revision ID: add_execution_history
Revises: 12f0c86bbad8
Create Date: 2023-10-10 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_execution_history'
down_revision = '12f0c86bbad8'  # Previous migration ID
branch_labels = None
depends_on = None


def upgrade():
    # Create execution_history table
    op.create_table(
        'execution_history',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('schedule_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('execution_type', sa.String(), nullable=False),
        sa.Column('execution_time', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('success', sa.Boolean(), default=False, nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('post_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['schedule_id'], ['blog_schedules.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['post_id'], ['blog_posts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_execution_history_id'), 'execution_history', ['id'], unique=False)
    op.create_index(op.f('ix_execution_history_schedule_id'), 'execution_history', ['schedule_id'], unique=False)
    op.create_index(op.f('ix_execution_history_user_id'), 'execution_history', ['user_id'], unique=False)


def downgrade():
    # Drop execution_history table
    op.drop_index(op.f('ix_execution_history_user_id'), table_name='execution_history')
    op.drop_index(op.f('ix_execution_history_schedule_id'), table_name='execution_history')
    op.drop_index(op.f('ix_execution_history_id'), table_name='execution_history')
    op.drop_table('execution_history') 