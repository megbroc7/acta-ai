import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PromptTemplate(Base):
    __tablename__ = "prompt_templates"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Three-stage prompt pipeline
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    topic_generation_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    content_generation_prompt: Mapped[str] = mapped_column(Text, nullable=False)

    # Defaults
    default_word_count: Mapped[int] = mapped_column(Integer, default=1500)
    default_tone: Mapped[str] = mapped_column(String(50), default="informative")

    # Advanced content settings
    content_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    writing_style: Mapped[str | None] = mapped_column(String(50), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    audience_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    special_requirements: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_reader: Mapped[str | None] = mapped_column(Text, nullable=True)
    call_to_action: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferred_terms: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Featured Image
    image_source: Mapped[str | None] = mapped_column(String(20), nullable=True)  # "none", "dalle", "unsplash"
    image_style_guidance: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Experience (Reverse Interview)
    experience_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    experience_qa: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Voice Matching
    writing_sample: Mapped[str | None] = mapped_column(Text, nullable=True)
    voice_match_active: Mapped[bool | None] = mapped_column(Boolean, default=False)

    # Voice & Humanization
    perspective: Mapped[str | None] = mapped_column(String(20), nullable=True)
    brand_voice_description: Mapped[str | None] = mapped_column(Text, nullable=True)
    phrases_to_avoid: Mapped[list | None] = mapped_column(JSON, nullable=True)
    personality_level: Mapped[int | None] = mapped_column(Integer, default=5)
    use_anecdotes: Mapped[bool | None] = mapped_column(Boolean, default=False)
    use_rhetorical_questions: Mapped[bool | None] = mapped_column(Boolean, default=False)
    use_humor: Mapped[bool | None] = mapped_column(Boolean, default=False)
    use_contractions: Mapped[bool | None] = mapped_column(Boolean, default=True)

    # SEO
    seo_focus_keyword: Mapped[str | None] = mapped_column(String(255), nullable=True)
    seo_keywords: Mapped[list | None] = mapped_column(JSON, nullable=True)
    seo_keyword_density: Mapped[str | None] = mapped_column(String(20), nullable=True)
    seo_meta_description_style: Mapped[str | None] = mapped_column(String(50), nullable=True)
    seo_internal_linking_instructions: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Categories & Tags
    default_categories: Mapped[list | None] = mapped_column(JSON, nullable=True)
    default_tags: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Customization
    placeholders: Mapped[dict] = mapped_column(JSON, default=dict)
    variables: Mapped[list] = mapped_column(JSON, default=list)

    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
