#!/usr/bin/env python
"""
Script to clean formatting issues in existing blog post titles.

This script will:
1. Connect to the database
2. Find all blog posts
3. Clean their titles by removing quotes and normalizing spacing
4. Update the database records
"""

import asyncio
import sys
import os
import re
from pathlib import Path

# Add the parent directory to the path so we can import from app
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update

from app.core.database import engine, async_session_factory
from app.models.blog_schedule import BlogPost

async def clean_post_titles():
    """Clean the titles of all blog posts in the database."""
    session = async_session_factory()
    
    try:
        print("Starting title cleanup process...")
        
        # Get all blog posts
        result = await session.execute(select(BlogPost))
        posts = result.scalars().all()
        
        cleaned_count = 0
        for post in posts:
            original_title = post.title
            
            # Clean the title
            clean_title = original_title.strip('"\'')
            # Remove Markdown heading symbols (# followed by space) from the beginning of titles
            clean_title = re.sub(r'^#+\s+', '', clean_title)
            clean_title = re.sub(r'\s+', ' ', clean_title)
            
            # Update if different
            if clean_title != original_title:
                post.title = clean_title
                cleaned_count += 1
                print(f"Cleaned title: '{original_title}' → '{clean_title}'")
        
        # Commit changes if any posts were updated
        if cleaned_count > 0:
            await session.commit()
            print(f"Successfully cleaned {cleaned_count} post titles.")
        else:
            print("No posts needed title cleaning.")
            
    except Exception as e:
        print(f"Error occurred: {str(e)}")
        await session.rollback()
    finally:
        await session.close()
        print("Cleanup process completed.")

if __name__ == "__main__":
    asyncio.run(clean_post_titles()) 