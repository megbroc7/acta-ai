from sqlalchemy import create_engine, text
from app.core.config import settings

def update_prompt_templates():
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        # Update all records with NULL variables to have empty list
        result = conn.execute(text("UPDATE prompt_templates SET variables = '[]' WHERE variables IS NULL"))
        conn.commit()
        print(f"Updated {result.rowcount} records.")
        
        # Verify no NULLs remain
        result = conn.execute(text("SELECT COUNT(*) FROM prompt_templates WHERE variables IS NULL"))
        null_count = result.scalar()
        
        if null_count == 0:
            print("Success: No NULL values remain in the variables column.")
        else:
            print(f"Warning: Still found {null_count} records with NULL variables.")

if __name__ == "__main__":
    update_prompt_templates() 