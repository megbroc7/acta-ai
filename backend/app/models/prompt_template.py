from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from ..core.database import Base

class PromptTemplate(Base):
    __tablename__ = "prompt_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    
    # Core prompts
    system_prompt = Column(Text, nullable=False)
    topic_generation_prompt = Column(Text, nullable=False)
    content_generation_prompt = Column(Text, nullable=False)
    
    # Default settings
    default_word_count = Column(Integer, default=1500)
    default_tone = Column(String, default="informative")
    
    # Advanced content settings
    content_type = Column(String, default="blog_post")  # blog_post, article, tutorial, etc.
    writing_style = Column(String, default="standard")  # standard, casual, formal, academic, etc.
    industry = Column(String)  # finance, health, technology, etc.
    audience_level = Column(String, default="general")  # beginner, intermediate, advanced, general
    special_requirements = Column(Text)  # Any special requirements or instructions
    
    # Customizable placeholders that can be used in prompts
    placeholders = Column(JSON)  # {"placeholder_name": "default_value"}
    
    # Variables for the template form
    variables = Column(JSON, default=lambda: [], server_default='[]')
    
    # Metadata
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    user = relationship("User", backref="prompt_templates") 