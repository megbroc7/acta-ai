import os
import sys
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, DateTime, Boolean, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

# Create the database engine
engine = create_engine('sqlite:///app.db')
Base = declarative_base()

# Define the models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Site(Base):
    __tablename__ = "sites"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    url = Column(String)
    username = Column(String)
    password = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="sites")

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
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    user = relationship("User", backref="prompt_templates")

class BlogSchedule(Base):
    __tablename__ = "blog_schedules"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    site_id = Column(Integer, ForeignKey("sites.id"))
    prompt_template_id = Column(Integer, ForeignKey("prompt_templates.id"))
    name = Column(String)
    frequency = Column(String)  # daily, weekly, monthly, custom
    time_of_day = Column(String)  # HH:MM format
    day_of_week = Column(Integer)  # 0-6 (Monday-Sunday)
    days_of_week = Column(String)  # JSON array of days (0-6)
    day_of_month = Column(Integer)  # 1-31
    custom_cron = Column(String)  # For custom schedules
    topics = Column(String)  # JSON array of topic ideas
    status = Column(String, default="active")  # active, paused
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    user = relationship("User", backref="blog_schedules")
    site = relationship("Site", backref="blog_schedules")
    prompt_template = relationship("PromptTemplate", backref="blog_schedules")

class BlogPost(Base):
    __tablename__ = "blog_posts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    schedule_id = Column(Integer, ForeignKey("blog_schedules.id"))
    site_id = Column(Integer, ForeignKey("sites.id"))
    title = Column(String)
    content = Column(Text)
    excerpt = Column(Text)
    status = Column(String)  # draft, published
    wp_post_id = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    published_at = Column(DateTime)
    
    user = relationship("User", backref="blog_posts")
    schedule = relationship("BlogSchedule", backref="blog_posts")
    site = relationship("Site", backref="blog_posts")

class ExecutionHistory(Base):
    __tablename__ = "execution_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    schedule_id = Column(Integer, ForeignKey("blog_schedules.id"))
    post_id = Column(Integer, ForeignKey("blog_posts.id"), nullable=True)
    execution_type = Column(String)  # scheduled, manual
    execution_time = Column(DateTime, default=datetime.utcnow)
    success = Column(Boolean, default=True)
    error_message = Column(Text, nullable=True)
    
    user = relationship("User", backref="execution_history")
    schedule = relationship("BlogSchedule", backref="execution_history")
    post = relationship("BlogPost", backref="execution_history")

# Create the tables
Base.metadata.create_all(engine)

print("Database tables created successfully!")

# Create a session
Session = sessionmaker(bind=engine)
session = Session()

# Create a default user if none exists
if not session.query(User).first():
    default_user = User(
        email="admin@example.com",
        hashed_password="$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",  # "password"
        is_active=True
    )
    session.add(default_user)
    session.commit()
    print("Default user created!")

# Create default prompt templates if none exist
if not session.query(PromptTemplate).first():
    default_template = PromptTemplate(
        user_id=1,
        name="Sample Blog Post Template",
        description="A complete template with guidance to help you create engaging blog posts using AI",
        system_prompt="You are a helpful blogging assistant who creates engaging, informative, and well-structured articles that are easy to read and understand. Your job is to make the blog post sound natural and conversational, as if written by a human expert who is passionate about the topic.",
        topic_generation_prompt="""
        # Topic Generation Prompt
        # (This prompt helps the AI create a relevant title for your blog post)
        
        Please generate an interesting and engaging blog post title about {idea}.
        
        Make the title:
        - Clear and easy to understand
        - Appealing to readers interested in this topic
        - Between 40-60 characters long
        - Something that would make people want to click and read
        - Include a key benefit or solution if possible
        
        Examples of good titles:
        - "5 Easy Ways to Start Gardening in Small Spaces"
        - "How to Train Your Dog: A Beginner's Guide"
        - "Understanding Cryptocurrency: Simple Explanations"
        
        Return only the title without any additional text.
        """,
        content_generation_prompt="""
        # Content Generation Prompt
        # (This prompt tells the AI how to structure and write your blog post)
        
        Write a {word_count}-word blog post about {topic} for {audience}.
        
        The tone should be {tone} and the article should include at least {num_examples} practical examples or tips.
        
        ## Structure the post as follows:
        
        ### INTRODUCTION (10-15% of total length):
        - Start with an engaging hook to capture reader interest
        - Explain why this topic matters to the reader
        - Briefly outline what the reader will learn
        
        ### MAIN CONTENT (70-80% of total length, 3-5 sections):
        - Use clear H2 headings for each main section
        - Include H3 subheadings for subsections if needed
        - Provide practical examples and actionable tips
        - Include real-world applications of the information
        - Use bullet points or numbered lists for easy scanning
        
        ### CONCLUSION (5-10% of total length):
        - Summarize the key points
        - Include a motivational final thought
        - Add a question or call-to-action to engage readers
        
        ## Formatting requirements:
        - Use Markdown formatting throughout
        - Use ## for H2 headings and ### for H3 headings
        - Use **bold text** for important points
        - Use *italic text* for emphasis
        - Use bullet lists and numbered lists where appropriate
        
        The content should be helpful, practical, and easy to understand, even for someone new to this topic. Avoid jargon when possible, or explain technical terms when they're necessary.
        
        ## TIP: To get the best results:
        - Be specific about your topic
        - For "Beginner" topics, focus on fundamentals and avoid complex concepts
        - For "Advanced" topics, include more technical details and expert techniques
        """,
        default_word_count=800,
        default_tone="friendly",
        content_type="blog_post",
        writing_style="conversational",
        industry="general",
        audience_level="beginner",
        special_requirements="Focus on being helpful and practical with real-world examples.",
        placeholders={
            "idea": "The general topic you want to write about (e.g., \"gardening tips\", \"beginner coding\", \"home organization\")",
            "topic": "The specific title or focus of your blog post (e.g., \"5 Easy Gardening Tips for Beginners\")",
            "word_count": "How long the article should be (800 is a good starting point)",
            "tone": "The writing style (friendly, professional, conversational, informative, etc.)",
            "audience": "Who you're writing for (e.g., \"beginners\", \"busy parents\", \"small business owners\")",
            "num_examples": "Number of examples to include (3-5 is usually good)"
        },
        variables=[
            {
                "name": "Blog Idea",
                "key": "idea",
                "type": "text",
                "description": "The general topic you want to write about",
                "default_value": "gardening tips"
            },
            {
                "name": "Blog Topic",
                "key": "topic",
                "type": "text",
                "description": "The specific title or focus of your blog post",
                "default_value": "5 Easy Gardening Tips for Beginners"
            },
            {
                "name": "Target Audience",
                "key": "audience",
                "type": "text",
                "description": "Who you're writing for",
                "default_value": "beginners"
            },
            {
                "name": "Word Count",
                "key": "word_count",
                "type": "number",
                "description": "How long the article should be",
                "default_value": "800"
            },
            {
                "name": "Writing Tone",
                "key": "tone",
                "type": "select",
                "description": "The style and voice of the writing",
                "default_value": "friendly",
                "options": ["friendly", "professional", "conversational", "informative", "authoritative"]
            },
            {
                "name": "Number of Examples",
                "key": "num_examples",
                "type": "number",
                "description": "How many examples or tips to include",
                "default_value": "3"
            }
        ],
        is_default=True
    )
    session.add(default_template)
    session.commit()
    print("Default prompt template created!")

print("Database initialization complete!")
