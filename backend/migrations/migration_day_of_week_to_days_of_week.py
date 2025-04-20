"""
Migration script to convert day_of_week (integer) to days_of_week (array)

This migration:
1. Adds a new column days_of_week as JSON type
2. Converts and copies values from day_of_week to days_of_week as arrays
3. Has rollback capabilities in case of failure

Run this script directly with: python -m backend.migrations.migration_day_of_week_to_days_of_week
"""
import asyncio
import json
import os
import logging
import argparse
import sys
from sqlalchemy import create_engine, text, Column, JSON
from sqlalchemy.engine import Inspector
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('migration')

def parse_args():
    parser = argparse.ArgumentParser(description='Migrate day_of_week to days_of_week')
    parser.add_argument('--dry-run', action='store_true', help='Perform a dry run without making changes')
    parser.add_argument('--local', action='store_true', help='Use local SQLite database for development')
    return parser.parse_args()

def get_database_url(use_local=False):
    """Get the database URL based on environment or arguments"""
    if use_local:
        # Use local SQLite database for development
        return "sqlite:///./app.db"
    else:
        # Use PostgreSQL from environment or default
        return os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/actaai")

def create_backup(db_url):
    """Create a backup of the database before migration"""
    try:
        if 'sqlite' in db_url:
            import shutil
            
            db_path = db_url.replace('sqlite:///', '')
            backup_path = f"{db_path}.backup-{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            shutil.copy2(db_path, backup_path)
            logger.info(f"Created backup at {backup_path}")
            return True
        else:
            # For PostgreSQL, we'll log a message but not actually create a backup
            # In a production environment, you would use pg_dump here
            logger.warning("Automatic backup for PostgreSQL not implemented. Please ensure you have a database backup before proceeding.")
            return True
    except Exception as e:
        logger.error(f"Failed to create backup: {str(e)}")
        return False

def check_column_exists(engine, table_name, column_name, db_url):
    """Check if a column exists in a table"""
    try:
        with engine.connect() as conn:
            if 'sqlite' in db_url:
                result = conn.execute(text(f"PRAGMA table_info({table_name})"))
                columns = [row[1] for row in result.fetchall()]
                return column_name in columns
            else:
                # PostgreSQL query to check if column exists
                query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = :table_name AND column_name = :column_name
                """)
                result = conn.execute(query, {"table_name": table_name, "column_name": column_name})
                return result.rowcount > 0
        return False
    except Exception as e:
        logger.error(f"Error checking if column exists: {str(e)}")
        return False

def check_table_exists(engine, table_name, db_url):
    """Check if a table exists in the database"""
    try:
        with engine.connect() as conn:
            if 'sqlite' in db_url:
                result = conn.execute(text(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'"))
                return result.rowcount > 0
            else:
                # PostgreSQL query to check if table exists
                query = text("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name = :table_name
                """)
                result = conn.execute(query, {"table_name": table_name})
                return result.rowcount > 0
        return False
    except Exception as e:
        logger.error(f"Error checking if table exists: {str(e)}")
        return False

def add_days_of_week_column(engine, db_url, dry_run=False):
    """Add days_of_week JSON column to blog_schedules table"""
    try:
        if 'sqlite' in db_url:
            # SQLite doesn't support ALTER TABLE ADD COLUMN with JSON type
            # We'll use TEXT and handle JSON serialization/deserialization in code
            query = """
            ALTER TABLE blog_schedules 
            ADD COLUMN days_of_week TEXT;
            """
        else:
            # PostgreSQL supports JSON type
            query = """
            ALTER TABLE blog_schedules 
            ADD COLUMN days_of_week JSONB;
            """
        
        if dry_run:
            logger.info(f"Would execute: {query}")
            return True
        
        with engine.connect() as conn:
            conn.execute(text(query))
            conn.commit()
            logger.info("Added days_of_week column to blog_schedules table")
        return True
    except Exception as e:
        logger.error(f"Failed to add days_of_week column: {str(e)}")
        return False

def migrate_data(engine, db_url, dry_run=False):
    """Migrate data from day_of_week to days_of_week"""
    try:
        # Get all schedules with day_of_week set
        with engine.connect() as conn:
            result = conn.execute(text("SELECT id, day_of_week FROM blog_schedules WHERE day_of_week IS NOT NULL"))
            schedules = result.fetchall()
            
            if dry_run:
                logger.info(f"Would migrate {len(schedules)} schedules")
                return True
            
            # Update each schedule
            for schedule in schedules:
                schedule_id, day_of_week = schedule
                
                # Convert day_of_week to a JSON array with a single value
                days_of_week_json = json.dumps([day_of_week])
                
                # Update the record
                conn.execute(
                    text("UPDATE blog_schedules SET days_of_week = :days_of_week WHERE id = :id"),
                    {"days_of_week": days_of_week_json, "id": schedule_id}
                )
            
            conn.commit()
            logger.info(f"Migrated {len(schedules)} schedules from day_of_week to days_of_week")
        return True
    except Exception as e:
        logger.error(f"Failed to migrate data: {str(e)}")
        return False

def rollback_migration(engine, db_url):
    """Rollback the migration if something goes wrong"""
    try:
        with engine.connect() as conn:
            # Drop the column
            if 'sqlite' in db_url:
                # SQLite doesn't support DROP COLUMN directly
                logger.error("Rollback not supported for SQLite. Please restore from backup manually.")
                return False
            else:
                # PostgreSQL supports DROP COLUMN
                conn.execute(text("ALTER TABLE blog_schedules DROP COLUMN IF EXISTS days_of_week;"))
                conn.commit()
                logger.info("Rolled back migration by dropping days_of_week column")
            return True
    except Exception as e:
        logger.error(f"Failed to rollback migration: {str(e)}")
        return False

def main():
    args = parse_args()
    dry_run = args.dry_run
    use_local = args.local
    
    # Get database URL based on arguments
    db_url = get_database_url(use_local)
    
    logger.info(f"Starting migration from day_of_week to days_of_week using {db_url}")
    if dry_run:
        logger.info("DRY RUN MODE - No changes will be made")
    
    # Create engine
    engine = create_engine(db_url)
    
    # Check if the blog_schedules table exists
    if not check_table_exists(engine, 'blog_schedules', db_url):
        logger.error("Table 'blog_schedules' does not exist in the database")
        return 1
    
    # Create backup
    if not dry_run and not create_backup(db_url):
        logger.error("Failed to create backup, aborting migration")
        return 1
    
    # Check if days_of_week column already exists
    if check_column_exists(engine, 'blog_schedules', 'days_of_week', db_url):
        logger.info("days_of_week column already exists, skipping column creation")
    else:
        # Add days_of_week column
        if not add_days_of_week_column(engine, db_url, dry_run):
            logger.error("Failed to add days_of_week column, aborting migration")
            return 1
    
    # Migrate data
    if not migrate_data(engine, db_url, dry_run):
        logger.error("Failed to migrate data")
        if not dry_run:
            logger.info("Attempting to rollback migration")
            if not rollback_migration(engine, db_url):
                logger.error("Failed to rollback migration")
        return 1
    
    logger.info("Migration completed successfully")
    return 0

if __name__ == "__main__":
    sys.exit(main()) 