from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from app.models.prompt_template import PromptTemplate

def test_prompt_templates():
    engine = create_engine(settings.DATABASE_URL)
    session_factory = sessionmaker(bind=engine)
    
    with session_factory() as session:
        # Get count of prompt templates
        result = session.execute(select(PromptTemplate))
        templates = result.scalars().all()
        print(f"Found {len(templates)} templates")
        
        # Check variables field
        for template in templates:
            print(f"ID: {template.id}, Name: {template.name}, Variables: {template.variables}")
            
            # Verify variables is not NULL
            if template.variables is None:
                print(f"WARNING: Template {template.id} has NULL variables!")
            else:
                print(f"Template {template.id} has valid variables: {template.variables}")

if __name__ == "__main__":
    test_prompt_templates() 