#!/usr/bin/env python
import asyncio
import sys
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.core.security import get_password_hash

async def create_admin_user(email: str, password: str, full_name: str = 'Admin User'):
    """Create an admin user if it doesn't exist."""
    print(f'Checking if admin user {email} exists...')
    
    async with AsyncSessionLocal() as db:
        # Check if user already exists
        stmt = select(User).where(User.email == email)
        result = await db.execute(stmt)
        existing_user = result.scalars().first()
        
        if existing_user:
            print(f'User {email} already exists.')
            return
        
        # Create new admin user
        hashed_password = get_password_hash(password)
        new_user = User(
            email=email,
            hashed_password=hashed_password,
            full_name=full_name,
            is_active=True
        )
        
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        
        print(f'Admin user {email} created successfully.')

if __name__ == '__main__':
    # Default admin credentials
    admin_email = 'admin@example.com'
    admin_password = 'adminpassword'
    admin_name = 'Admin User'
    
    # Run the async function
    asyncio.run(create_admin_user(admin_email, admin_password, admin_name)) 