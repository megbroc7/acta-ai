#!/usr/bin/env python3
"""
Database Management Utility

This script consolidates various database check and cleanup utilities
into a single command-line tool.

Usage:
    python db_management.py [command]

Commands:
    check_db               - Check database tables and blog schedules
    check_users            - List all users in the database
    check_prompt_templates - Check prompt templates and their relationships with schedules
    check_prompt_template  - Check a specific prompt template
    check_blog_posts       - Check blog posts
    check_latest_post      - Check the latest blog post
    check_execution_history - Check execution history records
    check_schedule_data    - Check schedule data
    check_scheduler_logs   - Check scheduler logs
    check_schedules        - Check all schedules
    cleanup_duplicates     - Clean up duplicate prompt templates
    cleanup_templates      - Clean up templates
    help                   - Show this help message
"""

import asyncio
import sys
import sqlite3
from sqlalchemy import select, delete, func, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Try to import from app modules, but don't fail if they're not available
try:
    from app.core.config import settings
    from app.models.user import User
    from app.models.prompt_template import PromptTemplate
    from app.core.database import get_session
    CONFIG_AVAILABLE = True
except ImportError:
    CONFIG_AVAILABLE = False
    print("Warning: App modules not available. Using hardcoded database URL.")
    settings = type('obj', (object,), {
        'DATABASE_URL': 'postgresql+asyncpg://postgres:password@localhost:5432/actaai'
    })

# Database connection helpers
def get_engine():
    return create_async_engine(settings.DATABASE_URL, echo=False)

def get_session_maker():
    engine = get_engine()
    return sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Original script functions
async def check_db():
    """Original check_db.py functionality"""
    print("Checking SQLite database (legacy)...")
    try:
        conn = sqlite3.connect("app.db")
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type=\"table\"")
        tables = cursor.fetchall()
        print("Tables:", tables)
        cursor = conn.execute("SELECT * FROM blog_schedules")
        rows = cursor.fetchall()
        print("Data:", rows)
    except Exception as e:
        print(f"Error accessing SQLite database: {e}")
        print("Trying PostgreSQL instead...")
        await check_schedules()

async def check_users():
    """Original check_users.py functionality"""
    print("Checking users...")
    if CONFIG_AVAILABLE:
        async with get_session() as session:
            users = await session.execute('SELECT * FROM users')
            return users.fetchall()
    else:
        engine = get_engine()
        async with AsyncSession(engine) as session:
            result = await session.execute(text('SELECT * FROM users'))
            users = result.all()
            print(f"Users in database: {users}")

async def check_prompt_templates():
    """Original check_prompt_templates.py functionality"""
    print("Checking prompt templates and schedule relationships...")
    
    engine = get_engine()
    
    async with AsyncSession(engine) as session:
        try:
            # Check all prompt templates
            result = await session.execute(text('SELECT id, name, user_id, system_prompt FROM prompt_templates'))
            templates = result.all()
            
            print(f"\nFound {len(templates)} prompt templates:")
            for template in templates:
                print(f"  ID: {template[0]}, Name: {template[1]}, User ID: {template[2]}")
                print(f"  System Prompt: {template[3][:100]}..." if template[3] and len(template[3]) > 100 else f"  System Prompt: {template[3]}")
                print()
            
            # Check schedule for ID 7 or whatever ID we're dealing with
            result = await session.execute(text('SELECT id, name, user_id, site_id, prompt_template_id FROM blog_schedules WHERE id=7'))
            schedule = result.first()
            
            if schedule:
                print(f"\nSchedule ID 7 details:")
                print(f"  Name: {schedule[1]}")
                print(f"  User ID: {schedule[2]}")
                print(f"  Site ID: {schedule[3]}")
                print(f"  Prompt Template ID: {schedule[4]}")
                
                # Check if prompt template exists
                if schedule[4]:
                    template_result = await session.execute(
                        text(f'SELECT id, name FROM prompt_templates WHERE id={schedule[4]}')
                    )
                    template = template_result.first()
                    
                    if template:
                        print(f"  Associated Template: {template[1]} (ID: {template[0]})")
                    else:
                        print(f"  ERROR: Prompt template with ID {schedule[4]} does not exist!")
                else:
                    print("  ERROR: No prompt template ID is set for this schedule!")
            else:
                print("\nSchedule with ID 7 not found.")
                
            # List all schedules
            result = await session.execute(text('SELECT id, name, prompt_template_id FROM blog_schedules'))
            schedules = result.all()
            
            print(f"\nAll schedules:")
            for schedule in schedules:
                print(f"  ID: {schedule[0]}, Name: {schedule[1]}, Prompt Template ID: {schedule[2]}")
                
        except Exception as e:
            print(f'Error: {str(e)}')
            sys.exit(1)

async def check_prompt_template():
    """Original check_prompt_template.py functionality"""
    print("Checking specific prompt template...")
    # Implement based on original script
    print("This functionality is similar to check_prompt_templates")
    await check_prompt_templates()

async def check_blog_posts():
    """Original check_blog_posts.py functionality"""
    print("Checking blog posts...")
    
    engine = get_engine()
    
    async with AsyncSession(engine) as session:
        try:
            result = await session.execute(text('SELECT COUNT(*) FROM blog_posts'))
            count = result.scalar()
            print(f"Found {count} blog posts in the database")
            
            result = await session.execute(text('SELECT id, title, site_id, status, created_at FROM blog_posts ORDER BY created_at DESC LIMIT 5'))
            posts = result.all()
            
            print("\nMost recent posts:")
            for post in posts:
                print(f"  ID: {post[0]}, Title: {post[1]}, Site ID: {post[2]}, Status: {post[3]}, Created: {post[4]}")
        except Exception as e:
            print(f"Error: {str(e)}")

async def check_latest_post():
    """Original check_latest_post.py functionality"""
    print("Checking latest post...")
    
    engine = get_engine()
    
    async with AsyncSession(engine) as session:
        try:
            result = await session.execute(text('SELECT id, title, site_id, status, created_at FROM blog_posts ORDER BY created_at DESC LIMIT 1'))
            post = result.first()
            
            if post:
                print(f"Latest post:")
                print(f"  ID: {post[0]}")
                print(f"  Title: {post[1]}")
                print(f"  Site ID: {post[2]}")
                print(f"  Status: {post[3]}")
                print(f"  Created: {post[4]}")
            else:
                print("No posts found in the database")
        except Exception as e:
            print(f"Error: {str(e)}")

async def check_execution_history():
    """Original check_execution_history.py functionality"""
    print("Checking execution history...")
    
    engine = get_engine()
    
    async with AsyncSession(engine) as session:
        try:
            result = await session.execute(text('SELECT COUNT(*) FROM execution_history'))
            count = result.scalar()
            print(f'Execution history table exists and has {count} records')
            
            # Get all records
            result = await session.execute(text('SELECT * FROM execution_history ORDER BY id DESC LIMIT 10'))
            records = result.all()
            
            # Print records
            print("\nMost recent execution records:")
            for record in records:
                print(f'ID: {record[0]}, Schedule ID: {record[1]}, User ID: {record[2]}, Type: {record[3]}, Time: {record[4]}, Success: {record[5]}')
        except Exception as e:
            print(f'Error: {str(e)}')

async def check_schedule_data():
    """Original check_schedule_data.py functionality"""
    print("Checking schedule data...")
    
    engine = get_engine()
    
    async with AsyncSession(engine) as session:
        try:
            result = await session.execute(text('SELECT id, name, user_id, site_id, prompt_template_id, frequency, active FROM blog_schedules'))
            schedules = result.all()
            
            print(f"Found {len(schedules)} schedules:")
            for schedule in schedules:
                print(f"  ID: {schedule[0]}, Name: {schedule[1]}")
                print(f"  User ID: {schedule[2]}, Site ID: {schedule[3]}, Template ID: {schedule[4]}")
                print(f"  Frequency: {schedule[5]}, Active: {schedule[6]}")
                print()
        except Exception as e:
            print(f"Error: {str(e)}")

async def check_scheduler_logs():
    """Original check_scheduler_logs.py functionality"""
    print("Checking scheduler logs...")
    
    engine = get_engine()
    
    async with AsyncSession(engine) as session:
        try:
            # Check if the table exists
            try:
                result = await session.execute(text('SELECT COUNT(*) FROM scheduler_logs'))
                count = result.scalar()
                print(f"Found {count} scheduler log entries")
                
                result = await session.execute(text('SELECT * FROM scheduler_logs ORDER BY timestamp DESC LIMIT 10'))
                logs = result.all()
                
                print("\nMost recent scheduler logs:")
                for log in logs:
                    print(f"  ID: {log[0]}, Message: {log[1]}, Timestamp: {log[2]}")
            except Exception:
                print("Scheduler logs table does not exist")
        except Exception as e:
            print(f"Error: {str(e)}")

async def check_schedules():
    """Original check_schedules.py functionality"""
    print("Checking schedules...")
    
    engine = get_engine()
    
    async with AsyncSession(engine) as session:
        try:
            result = await session.execute(text('SELECT id, name, user_id, site_id, prompt_template_id, frequency, active FROM blog_schedules'))
            schedules = result.all()
            
            print(f"Found {len(schedules)} schedules:")
            for schedule in schedules:
                print(f"  ID: {schedule[0]}, Name: {schedule[1]}")
                print(f"  User ID: {schedule[2]}, Site ID: {schedule[3]}, Template ID: {schedule[4]}")
                print(f"  Frequency: {schedule[5]}, Active: {schedule[6]}")
                
                # Check related template if exists
                if schedule[4]:
                    try:
                        template_result = await session.execute(text(f'SELECT name FROM prompt_templates WHERE id = {schedule[4]}'))
                        template = template_result.first()
                        if template:
                            print(f"  Template: {template[0]}")
                        else:
                            print(f"  WARNING: Template ID {schedule[4]} not found!")
                    except Exception:
                        print(f"  ERROR: Could not query template with ID {schedule[4]}")
                print()
        except Exception as e:
            print(f"Error: {str(e)}")

async def cleanup_duplicates():
    """Original cleanup_duplicates.py functionality"""
    print("Starting duplicate template cleanup...")
    
    if not CONFIG_AVAILABLE:
        print("Error: App modules required for this function. Cannot proceed.")
        return
    
    # Create async engine
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
    )
    
    # Create async session
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    # Track progress
    templates_to_delete = []
    
    async with async_session() as session:
        # Get all template names with duplicates (count > 1)
        query = select(
            PromptTemplate.name, 
            func.count(PromptTemplate.id).label('count')
        ).group_by(PromptTemplate.name).having(
            func.count(PromptTemplate.id) > 1
        )
        
        result = await session.execute(query)
        duplicate_names = result.all()
        
        if not duplicate_names:
            print("No duplicate templates found. All good!")
            return
        
        print(f"Found {len(duplicate_names)} template names with duplicates.")
        
        # For each duplicated name, keep only the most recently updated one
        for name_row in duplicate_names:
            template_name = name_row[0]
            count = name_row[1]
            
            print(f"Processing '{template_name}' with {count} duplicates...")
            
            # Get all templates with this name
            query = select(PromptTemplate).filter(
                PromptTemplate.name == template_name
            ).order_by(
                # Order by updated_at or created_at (most recent first)
                PromptTemplate.updated_at.desc().nulls_last(), 
                PromptTemplate.created_at.desc()
            )
            
            result = await session.execute(query)
            templates = result.scalars().all()
            
            # Keep the first one (most recently updated), delete the rest
            to_delete = templates[1:]
            templates_to_delete.extend(to_delete)
        
        # Delete the duplicates
        for template in templates_to_delete:
            await session.delete(template)
        
        # Commit the changes
        await session.commit()
        
        print(f"Successfully removed {len(templates_to_delete)} duplicate templates.")

async def cleanup_templates():
    """Original cleanup_templates.py functionality"""
    print("Cleaning up templates...")
    
    engine = get_engine()
    
    async with AsyncSession(engine) as session:
        try:
            # Find templates not associated with any schedule
            result = await session.execute(text('''
                SELECT pt.id, pt.name 
                FROM prompt_templates pt
                LEFT JOIN blog_schedules bs ON pt.id = bs.prompt_template_id
                WHERE bs.id IS NULL
            '''))
            orphaned_templates = result.all()
            
            if not orphaned_templates:
                print("No orphaned templates found.")
                return
            
            print(f"Found {len(orphaned_templates)} templates not associated with any schedule:")
            for template in orphaned_templates:
                print(f"  ID: {template[0]}, Name: {template[1]}")
            
            # Ask for confirmation before deleting
            print("\nWould you like to delete these orphaned templates? (y/n)")
            response = input().strip().lower()
            
            if response == 'y':
                for template in orphaned_templates:
                    await session.execute(text(f"DELETE FROM prompt_templates WHERE id = {template[0]}"))
                
                await session.commit()
                print(f"Successfully deleted {len(orphaned_templates)} orphaned templates.")
            else:
                print("Operation cancelled. No templates were deleted.")
        except Exception as e:
            print(f"Error: {str(e)}")

def show_help():
    """Show help message"""
    print(__doc__)

# Command mapping
COMMANDS = {
    'check_db': check_db,
    'check_users': check_users,
    'check_prompt_templates': check_prompt_templates,
    'check_prompt_template': check_prompt_template,
    'check_blog_posts': check_blog_posts,
    'check_latest_post': check_latest_post,
    'check_execution_history': check_execution_history,
    'check_schedule_data': check_schedule_data,
    'check_scheduler_logs': check_scheduler_logs,
    'check_schedules': check_schedules,
    'cleanup_duplicates': cleanup_duplicates,
    'cleanup_templates': cleanup_templates,
    'help': show_help,
}

async def main():
    """Main entry point"""
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        print("Please specify a valid command:")
        for cmd in COMMANDS:
            print(f"  {cmd}")
        print("\nFor more information, use 'help' command")
        return
    
    command = sys.argv[1]
    await COMMANDS[command]()

if __name__ == "__main__":
    asyncio.run(main()) 