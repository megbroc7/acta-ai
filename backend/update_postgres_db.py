
import asyncio
import asyncpg
import os

# Manually read the .env file
def load_env():
    env_vars = {}
    try:
        with open('.env', 'r') as file:
            for line in file:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                key, value = line.split('=', 1)
                env_vars[key] = value
        return env_vars
    except Exception as e:
        print(f"Error loading .env file: {e}")
        return {}

# Load environment variables
env_vars = load_env()

# Get the database URL from environment variables
DATABASE_URL = env_vars.get("DATABASE_URL") or os.getenv("DATABASE_URL")

priforask-proj-3ax9tt-d1QOZuVWWm81S4Vrm_XanYCQ3STh7ykWgjvRe_3lE9QvGCTI8qaHy5Jg0km7Jheb9l4T3BlbkFJW3pNEfGxNh6xOnQhimsvEQYwhtmkLB8y2r51eX6l2Xzp1Mhb_yamzx75vlTmuGQ0I_a1uuRV4Ant(f"Using database URL: {DATABASE_URL}")
raie
async def main():
    # Connect to the database
    conn = await asyncpg.connect(DATABASE_URL)
    
    try:
        # Check if the columns exist
        columns = await conn.fetch(
            """
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'prompt_templates'
            """
        )
        column_names = [col['column_name'] for col in columns]
        
        # Add each column if it doesn't exist
        if 'content_type' not in column_names:
            await conn.execute(
                "ALTER TABLE prompt_templates ADD COLUMN content_type VARCHAR DEFAULT 'blog_post'"
            )
            print("Added content_type column")
        
        if 'writing_style' not in column_names:
            await conn.execute(
                "ALTER TABLE prompt_templates ADD COLUMN writing_style VARCHAR DEFAULT 'standard'"
            )
            print("Added writing_style column")
        
        if 'industry' not in column_names:
            await conn.execute(
                "ALTER TABLE prompt_templates ADD COLUMN industry VARCHAR"
            )
            print("Added industry column")
        
        if 'audience_level' not in column_names:
            await conn.execute(
                "ALTER TABLE prompt_templates ADD COLUMN audience_level VARCHAR DEFAULT 'general'"
            )
            print("Added audience_level column")
        
        if 'special_requirements' not in column_names:
            await conn.execute(
                "ALTER TABLE prompt_templates ADD COLUMN special_requirements TEXT"
            )
            print("Added special_requirements column")
        
        print("Database update complete!")
    except Exception as e:
        print(f"Error updating database: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main()) 