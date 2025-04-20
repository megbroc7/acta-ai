import sqlite3
import json

# Connect to the database
conn = sqlite3.connect('app.db')
cursor = conn.cursor()

# Check if prompt_templates table exists
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='prompt_templates'")
if not cursor.fetchone():
    # Create the prompt_templates table if it doesn't exist
    cursor.execute('''
    CREATE TABLE prompt_templates (
        id INTEGER PRIMARY KEY,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        system_prompt TEXT NOT NULL,
        topic_generation_prompt TEXT NOT NULL,
        content_generation_prompt TEXT NOT NULL,
        default_word_count INTEGER DEFAULT 1500,
        default_tone TEXT DEFAULT 'informative',
        content_type TEXT DEFAULT 'blog_post',
        writing_style TEXT DEFAULT 'standard',
        industry TEXT,
        audience_level TEXT DEFAULT 'general',
        special_requirements TEXT,
        placeholders TEXT,
        variables TEXT DEFAULT '[]',
        is_default INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    ''')
    print("Created prompt_templates table")
else:
    # Check if the new columns exist
    cursor.execute("PRAGMA table_info(prompt_templates)")
    columns = [column[1] for column in cursor.fetchall()]
    
    # Add new columns if they don't exist
    if 'content_type' not in columns:
        cursor.execute("ALTER TABLE prompt_templates ADD COLUMN content_type TEXT DEFAULT 'blog_post'")
        print("Added content_type column")
    
    if 'writing_style' not in columns:
        cursor.execute("ALTER TABLE prompt_templates ADD COLUMN writing_style TEXT DEFAULT 'standard'")
        print("Added writing_style column")
    
    if 'industry' not in columns:
        cursor.execute("ALTER TABLE prompt_templates ADD COLUMN industry TEXT")
        print("Added industry column")
    
    if 'audience_level' not in columns:
        cursor.execute("ALTER TABLE prompt_templates ADD COLUMN audience_level TEXT DEFAULT 'general'")
        print("Added audience_level column")
    
    if 'special_requirements' not in columns:
        cursor.execute("ALTER TABLE prompt_templates ADD COLUMN special_requirements TEXT")
        print("Added special_requirements column")

# Check if there are any templates
cursor.execute("SELECT COUNT(*) FROM prompt_templates")
template_count = cursor.fetchone()[0]

# Create a default template if none exists
if template_count == 0:
    default_template = {
        "user_id": 1,
        "name": "Sample Blog Post Template",
        "description": "A complete template with guidance to help you create engaging blog posts using AI",
        "system_prompt": "You are a helpful blogging assistant who creates engaging, informative, and well-structured articles that are easy to read and understand. Your job is to make the blog post sound natural and conversational, as if written by a human expert who is passionate about the topic.",
        "topic_generation_prompt": """
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
        "content_generation_prompt": """
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
        "default_word_count": 800,
        "default_tone": "friendly",
        "content_type": "blog_post",
        "writing_style": "conversational",
        "industry": "general",
        "audience_level": "beginner",
        "special_requirements": "Focus on being helpful and practical with real-world examples.",
        "placeholders": json.dumps({
            "idea": "The general topic you want to write about (e.g., \"gardening tips\", \"beginner coding\", \"home organization\")",
            "topic": "The specific title or focus of your blog post (e.g., \"5 Easy Gardening Tips for Beginners\")",
            "word_count": "How long the article should be (800 is a good starting point)",
            "tone": "The writing style (friendly, professional, conversational, informative, etc.)",
            "audience": "Who you're writing for (e.g., \"beginners\", \"busy parents\", \"small business owners\")",
            "num_examples": "Number of examples to include (3-5 is usually good)"
        }),
        "variables": json.dumps([
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
        ]),
        "is_default": 1
    }
    
    cursor.execute('''
    INSERT INTO prompt_templates (
        user_id, name, description, system_prompt, topic_generation_prompt, content_generation_prompt,
        default_word_count, default_tone, content_type, writing_style, industry, audience_level,
        special_requirements, placeholders, variables, is_default
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        default_template["user_id"],
        default_template["name"],
        default_template["description"],
        default_template["system_prompt"],
        default_template["topic_generation_prompt"],
        default_template["content_generation_prompt"],
        default_template["default_word_count"],
        default_template["default_tone"],
        default_template["content_type"],
        default_template["writing_style"],
        default_template["industry"],
        default_template["audience_level"],
        default_template["special_requirements"],
        default_template["placeholders"],
        default_template["variables"],
        default_template["is_default"]
    ))
    print("Created default template")
else:
    # Update existing templates with default values for new columns
    cursor.execute('''
    UPDATE prompt_templates SET
        content_type = 'blog_post',
        writing_style = 'standard',
        audience_level = 'general'
    WHERE content_type IS NULL OR writing_style IS NULL OR audience_level IS NULL
    ''')
    print("Updated existing templates with default values")

# Commit changes and close connection
conn.commit()
conn.close()

print("Database update complete!") 