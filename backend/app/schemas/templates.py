import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ExperienceQAItem(BaseModel):
    question: str
    answer: str = ""


class ExperienceInterviewResponse(BaseModel):
    questions: list[str]


class TemplateCreate(BaseModel):
    name: str = Field(min_length=1)
    description: str | None = None
    system_prompt: str = ""
    topic_generation_prompt: str = ""
    content_generation_prompt: str = ""
    default_word_count: int = 1500
    default_tone: str = "informative"
    content_type: str | None = None
    writing_style: str | None = None
    industry: str | None = None
    audience_level: str | None = None
    special_requirements: str | None = None
    target_reader: str | None = None
    call_to_action: str | None = None
    preferred_terms: list[str] | None = None
    image_source: str | None = None
    image_style_guidance: str | None = None
    experience_notes: str | None = None
    experience_qa: list[ExperienceQAItem] | None = None
    placeholders: dict = {}
    variables: list = []
    is_default: bool = False
    # Voice & Humanization
    perspective: str | None = None
    brand_voice_description: str | None = None
    phrases_to_avoid: list[str] | None = None
    personality_level: int = 5
    use_anecdotes: bool = False
    use_rhetorical_questions: bool = False
    use_humor: bool = False
    use_contractions: bool = True
    # SEO
    seo_focus_keyword: str | None = None
    seo_keywords: list[str] | None = None
    seo_keyword_density: str | None = None
    seo_meta_description_style: str | None = None
    seo_internal_linking_instructions: str | None = None
    # Categories & Tags
    default_categories: list[str] | None = None
    default_tags: list[str] | None = None


class TemplateUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    system_prompt: str | None = None
    topic_generation_prompt: str | None = None
    content_generation_prompt: str | None = None
    default_word_count: int | None = None
    default_tone: str | None = None
    content_type: str | None = None
    writing_style: str | None = None
    industry: str | None = None
    audience_level: str | None = None
    special_requirements: str | None = None
    target_reader: str | None = None
    call_to_action: str | None = None
    preferred_terms: list[str] | None = None
    image_source: str | None = None
    image_style_guidance: str | None = None
    experience_notes: str | None = None
    experience_qa: list[ExperienceQAItem] | None = None
    placeholders: dict | None = None
    variables: list | None = None
    # Voice & Humanization
    perspective: str | None = None
    brand_voice_description: str | None = None
    phrases_to_avoid: list[str] | None = None
    personality_level: int | None = None
    use_anecdotes: bool | None = None
    use_rhetorical_questions: bool | None = None
    use_humor: bool | None = None
    use_contractions: bool | None = None
    # SEO
    seo_focus_keyword: str | None = None
    seo_keywords: list[str] | None = None
    seo_keyword_density: str | None = None
    seo_meta_description_style: str | None = None
    seo_internal_linking_instructions: str | None = None
    # Categories & Tags
    default_categories: list[str] | None = None
    default_tags: list[str] | None = None


class TemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    system_prompt: str
    topic_generation_prompt: str
    content_generation_prompt: str
    default_word_count: int
    default_tone: str
    content_type: str | None
    writing_style: str | None
    industry: str | None
    audience_level: str | None
    special_requirements: str | None
    target_reader: str | None
    call_to_action: str | None
    preferred_terms: list[str] | None
    image_source: str | None
    image_style_guidance: str | None
    experience_notes: str | None
    experience_qa: list[ExperienceQAItem] | None
    placeholders: dict
    variables: list
    is_default: bool
    # Voice & Humanization
    perspective: str | None
    brand_voice_description: str | None
    phrases_to_avoid: list[str] | None
    personality_level: int | None
    use_anecdotes: bool | None
    use_rhetorical_questions: bool | None
    use_humor: bool | None
    use_contractions: bool | None
    # SEO
    seo_focus_keyword: str | None
    seo_keywords: list[str] | None
    seo_keyword_density: str | None
    seo_meta_description_style: str | None
    seo_internal_linking_instructions: str | None
    # Categories & Tags
    default_categories: list[str] | None
    default_tags: list[str] | None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}


class KeywordSuggestionRequest(BaseModel):
    industry: str | None = None
    topic: str | None = None
    niche: str | None = None
    existing_keywords: list[str] = []


class KeywordSuggestionResponse(BaseModel):
    keywords: list[str]
    focus_keyword_suggestion: str | None = None


# --- Test endpoint schemas ---


class TestTopicRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=500)
    replacements: dict[str, str] = Field(default_factory=dict)
    content_type: str | None = None


class TestTopicResponse(BaseModel):
    titles: list[str]
    title_system_prompt_used: str
    topic_prompt_used: str


class InterviewRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)


class InterviewResponse(BaseModel):
    questions: list[str]


class TestContentRequest(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    word_count: int | None = Field(None, ge=100, le=10000)
    tone: str | None = Field(None, max_length=50)
    replacements: dict[str, str] = Field(default_factory=dict)
    experience_answers: list[str] = Field(default_factory=list)


class TestContentResponse(BaseModel):
    content_markdown: str
    content_html: str
    excerpt: str
    featured_image_url: str | None = None
    meta_title: str | None = None
    meta_description: str | None = None
    image_alt_text: str | None = None
    system_prompt_used: str
    content_prompt_used: str
    outline_used: str
