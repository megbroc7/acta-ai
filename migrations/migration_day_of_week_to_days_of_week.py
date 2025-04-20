def check_table_exists(engine, table_name, db_url):
    """Check if a table exists in the database"""
    try:
        with engine.connect() as conn:
            if 'sqlite' in db_url:
                # Simpler approach for SQLite
                result = conn.execute(text(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'"))
                tables = result.fetchall()
                return len(tables) > 0
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

def check_column_exists(engine, table_name, column_name, db_url):
    """Check if a column exists in a table"""
    try:
        with engine.connect() as conn:
            if 'sqlite' in db_url:
                # Simpler approach for SQLite
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
    
    # Debug: List all tables in the database
    try:
        with engine.connect() as conn:
            if 'sqlite' in db_url:
                result = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table'"))
                tables = [row[0] for row in result.fetchall()]
                logger.info(f"Tables in database: {tables}")
            else:
                result = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
                tables = [row[0] for row in result.fetchall()]
                logger.info(f"Tables in database: {tables}")
    except Exception as e:
        logger.error(f"Error listing tables: {str(e)}")
    
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