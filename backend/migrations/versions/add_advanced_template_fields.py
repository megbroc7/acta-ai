"""add_advanced_template_fields

Revision ID: bb20a4c84516
Revises: add_execution_history
Create Date: 2024-03-22 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'bb20a4c84516'
down_revision = 'add_execution_history'
branch_labels = None
depends_on = None


def upgrade():
    # Add advanced template fields
    op.add_column('prompt_templates', sa.Column('content_type', sa.String(), nullable=True, server_default='blog_post'))
    op.add_column('prompt_templates', sa.Column('writing_style', sa.String(), nullable=True, server_default='standard'))
    op.add_column('prompt_templates', sa.Column('industry', sa.String(), nullable=True))
    op.add_column('prompt_templates', sa.Column('audience_level', sa.String(), nullable=True, server_default='general'))
    op.add_column('prompt_templates', sa.Column('special_requirements', sa.Text(), nullable=True))


def downgrade():
    # Remove advanced template fields
    op.drop_column('prompt_templates', 'content_type')
    op.drop_column('prompt_templates', 'writing_style')
    op.drop_column('prompt_templates', 'industry')
    op.drop_column('prompt_templates', 'audience_level')
    op.drop_column('prompt_templates', 'special_requirements') 