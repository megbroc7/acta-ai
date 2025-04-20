import pytest
from httpx import AsyncClient
from typing import Dict

@pytest.mark.asyncio
async def test_create_schedule(
    client: AsyncClient,
    auth_headers: Dict,
    test_wordpress_site: Dict,
    test_prompt_template: Dict
):
    """Test creating a schedule"""
    # Create a daily schedule
    schedule_data = {
        "name": "Test Daily Schedule",
        "site_id": test_wordpress_site["id"],
        "prompt_template_id": test_prompt_template["id"],
        "frequency": "daily",
        "time_of_day": "10:00",
        "topics": ["test topic"],
        "word_count": 1000,
        "post_status": "draft"
    }
    
    response = await client.post(
        "/api/schedules/",
        json=schedule_data,
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Daily Schedule"
    assert data["frequency"] == "daily"
    assert data["time_of_day"] == "10:00"

@pytest.mark.asyncio
async def test_one_daily_schedule_limitation(
    client: AsyncClient,
    auth_headers: Dict,
    test_wordpress_site: Dict,
    test_prompt_template: Dict
):
    """Test that a user can't create more than one daily schedule"""
    # Create first daily schedule
    first_schedule = {
        "name": "First Daily Schedule",
        "site_id": test_wordpress_site["id"],
        "prompt_template_id": test_prompt_template["id"],
        "frequency": "daily",
        "time_of_day": "10:00",
        "topics": ["first topic"],
        "word_count": 1000,
        "post_status": "draft"
    }
    
    response = await client.post(
        "/api/schedules/",
        json=first_schedule,
        headers=auth_headers
    )
    
    assert response.status_code == 200
    
    # Try to create a second daily schedule - should fail
    second_schedule = {
        "name": "Second Daily Schedule",
        "site_id": test_wordpress_site["id"],
        "prompt_template_id": test_prompt_template["id"],
        "frequency": "daily",
        "time_of_day": "14:00",
        "topics": ["second topic"],
        "word_count": 1500,
        "post_status": "draft"
    }
    
    response = await client.post(
        "/api/schedules/",
        json=second_schedule,
        headers=auth_headers
    )
    
    assert response.status_code == 400
    assert "You can only have one daily schedule active at a time" in response.text

@pytest.mark.asyncio
async def test_create_schedule_with_days_of_week(
    client: AsyncClient,
    auth_headers: Dict,
    test_wordpress_site: Dict,
    test_prompt_template: Dict
):
    """Test creating a schedule with days_of_week array"""
    # Create a weekly schedule with multiple days
    schedule_data = {
        "name": "Test Weekly Schedule with Multiple Days",
        "site_id": test_wordpress_site["id"],
        "prompt_template_id": test_prompt_template["id"],
        "frequency": "weekly",
        "days_of_week": [0, 2, 4],  # Monday, Wednesday, Friday
        "time_of_day": "10:00",
        "topics": ["test topic"],
        "word_count": 1000,
        "post_status": "draft"
    }
    
    response = await client.post(
        "/api/schedules/",
        json=schedule_data,
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Weekly Schedule with Multiple Days"
    assert data["frequency"] == "weekly"
    assert data["days_of_week"] == [0, 2, 4]

@pytest.mark.asyncio
async def test_weekly_schedule_backward_compatibility(
    client: AsyncClient,
    auth_headers: Dict,
    test_wordpress_site: Dict,
    test_prompt_template: Dict
):
    """Test that we can still create schedules with day_of_week for backward compatibility"""
    # Create a weekly schedule with day_of_week
    schedule_data = {
        "name": "Test Weekly Schedule with day_of_week",
        "site_id": test_wordpress_site["id"],
        "prompt_template_id": test_prompt_template["id"],
        "frequency": "weekly",
        "day_of_week": 1,  # Tuesday
        "time_of_day": "10:00",
        "topics": ["test topic"],
        "word_count": 1000,
        "post_status": "draft"
    }
    
    response = await client.post(
        "/api/schedules/",
        json=schedule_data,
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Weekly Schedule with day_of_week"
    assert data["frequency"] == "weekly"
    assert data["day_of_week"] == 1
    assert data["days_of_week"] == [1]  # Should be automatically converted to array

@pytest.mark.asyncio
async def test_weekly_schedule_same_day_limitation(
    client: AsyncClient,
    auth_headers: Dict,
    test_wordpress_site: Dict,
    test_prompt_template: Dict
):
    """Test that a user can't create more than one weekly schedule for the same day"""
    # Create first weekly schedule for Monday (day_of_week = 0)
    first_schedule = {
        "name": "Monday Schedule",
        "site_id": test_wordpress_site["id"],
        "prompt_template_id": test_prompt_template["id"],
        "frequency": "weekly",
        "days_of_week": [0],
        "time_of_day": "10:00",
        "topics": ["monday topic"],
        "word_count": 1000,
        "post_status": "draft"
    }
    
    response = await client.post(
        "/api/schedules/",
        json=first_schedule,
        headers=auth_headers
    )
    
    assert response.status_code == 200
    
    # Try to create a second weekly schedule for Monday - should fail
    second_schedule = {
        "name": "Another Monday Schedule",
        "site_id": test_wordpress_site["id"],
        "prompt_template_id": test_prompt_template["id"],
        "frequency": "weekly",
        "days_of_week": [0],
        "time_of_day": "14:00",
        "topics": ["another monday topic"],
        "word_count": 1500,
        "post_status": "draft"
    }
    
    response = await client.post(
        "/api/schedules/",
        json=second_schedule,
        headers=auth_headers
    )
    
    assert response.status_code == 400
    assert "You already have an active schedule for this day of the week" in response.text
    
    # But creating a schedule for Tuesday should work
    tuesday_schedule = {
        "name": "Tuesday Schedule",
        "site_id": test_wordpress_site["id"],
        "prompt_template_id": test_prompt_template["id"],
        "frequency": "weekly",
        "days_of_week": [1],
        "time_of_day": "10:00",
        "topics": ["tuesday topic"],
        "word_count": 1000,
        "post_status": "draft"
    }
    
    response = await client.post(
        "/api/schedules/",
        json=tuesday_schedule,
        headers=auth_headers
    )
    
    assert response.status_code == 200
    
    # Test with older day_of_week field
    another_day_schedule = {
        "name": "Saturday Schedule",
        "site_id": test_wordpress_site["id"],
        "prompt_template_id": test_prompt_template["id"],
        "frequency": "weekly",
        "day_of_week": 5,  # Saturday
        "time_of_day": "10:00",
        "topics": ["saturday topic"],
        "word_count": 1000,
        "post_status": "draft"
    }
    
    response = await client.post(
        "/api/schedules/",
        json=another_day_schedule,
        headers=auth_headers
    )
    
    assert response.status_code == 200

@pytest.mark.asyncio
async def test_update_schedule(
    client: AsyncClient,
    auth_headers: Dict,
    test_wordpress_site: Dict,
    test_prompt_template: Dict
):
    """Test updating a schedule"""
    # Create a daily schedule
    schedule_data = {
        "name": "Test Daily Schedule",
        "site_id": test_wordpress_site["id"],
        "prompt_template_id": test_prompt_template["id"],
        "frequency": "daily",
        "time_of_day": "10:00",
        "topics": ["test topic"],
        "word_count": 1000,
        "post_status": "draft"
    }
    
    response = await client.post(
        "/api/schedules/",
        json=schedule_data,
        headers=auth_headers
    )
    
    assert response.status_code == 200
    schedule_id = response.json()["id"]
    
    # Update the schedule - change the time and name
    updated_data = {
        "name": "Updated Daily Schedule",
        "site_id": test_wordpress_site["id"],
        "prompt_template_id": test_prompt_template["id"],
        "frequency": "daily",
        "time_of_day": "14:00",
        "topics": ["updated topic"],
        "word_count": 1200,
        "post_status": "draft"
    }
    
    response = await client.put(
        f"/api/schedules/{schedule_id}",
        json=updated_data,
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Daily Schedule"
    assert data["time_of_day"] == "14:00"
    assert data["word_count"] == 1200

@pytest.mark.asyncio
async def test_change_schedule_frequency(
    client: AsyncClient,
    auth_headers: Dict,
    test_wordpress_site: Dict,
    test_prompt_template: Dict
):
    """Test changing a schedule's frequency"""
    # Create a daily schedule
    schedule_data = {
        "name": "Test Daily Schedule",
        "site_id": test_wordpress_site["id"],
        "prompt_template_id": test_prompt_template["id"],
        "frequency": "daily",
        "time_of_day": "10:00",
        "topics": ["test topic"],
        "word_count": 1000,
        "post_status": "draft"
    }
    
    response = await client.post(
        "/api/schedules/",
        json=schedule_data,
        headers=auth_headers
    )
    
    assert response.status_code == 200
    schedule_id = response.json()["id"]
    
    # Change to weekly schedule with days_of_week
    updated_data = {
        "name": "Now Weekly Schedule",
        "site_id": test_wordpress_site["id"],
        "prompt_template_id": test_prompt_template["id"],
        "frequency": "weekly",
        "days_of_week": [2, 4],  # Wednesday and Friday
        "time_of_day": "10:00",
        "topics": ["test topic"],
        "word_count": 1000,
        "post_status": "draft"
    }
    
    response = await client.put(
        f"/api/schedules/{schedule_id}",
        json=updated_data,
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Now Weekly Schedule"
    assert data["frequency"] == "weekly"
    assert data["days_of_week"] == [2, 4]
    
    # Test changing back to daily
    daily_data = {
        "name": "Back to Daily Schedule",
        "site_id": test_wordpress_site["id"],
        "prompt_template_id": test_prompt_template["id"],
        "frequency": "daily",
        "time_of_day": "14:00",
        "topics": ["test topic"],
        "word_count": 1000,
        "post_status": "draft"
    }
    
    response = await client.put(
        f"/api/schedules/{schedule_id}",
        json=daily_data,
        headers=auth_headers
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Back to Daily Schedule"
    assert data["frequency"] == "daily"

@pytest.mark.asyncio
async def test_monthly_schedule_same_day_limitation(
    client: AsyncClient,
    auth_headers: Dict,
    test_wordpress_site: Dict,
    test_prompt_template: Dict
):
    """Test that a user can't create more than one monthly schedule for the same day"""
    # Create first monthly schedule for the 1st day of month
    first_schedule = {
        "name": "First Day Schedule",
        "site_id": test_wordpress_site["id"],
        "prompt_template_id": test_prompt_template["id"],
        "frequency": "monthly",
        "day_of_month": 1,
        "time_of_day": "10:00",
        "topics": ["first day topic"],
        "word_count": 1000,
        "post_status": "draft"
    }
    
    response = await client.post(
        "/api/schedules/",
        json=first_schedule,
        headers=auth_headers
    )
    
    assert response.status_code == 200
    
    # Try to create a second monthly schedule for the 1st day - should fail
    second_schedule = {
        "name": "Another First Day Schedule",
        "site_id": test_wordpress_site["id"],
        "prompt_template_id": test_prompt_template["id"],
        "frequency": "monthly",
        "day_of_month": 1,
        "time_of_day": "14:00",
        "topics": ["another first day topic"],
        "word_count": 1500,
        "post_status": "draft"
    }
    
    response = await client.post(
        "/api/schedules/",
        json=second_schedule,
        headers=auth_headers
    )
    
    assert response.status_code == 400
    assert "You already have a schedule for this day of the month" in response.text
    
    # But creating a schedule for the 15th day should work
    midmonth_schedule = {
        "name": "Mid-Month Schedule",
        "site_id": test_wordpress_site["id"],
        "prompt_template_id": test_prompt_template["id"],
        "frequency": "monthly",
        "day_of_month": 15,
        "time_of_day": "10:00",
        "topics": ["mid-month topic"],
        "word_count": 1000,
        "post_status": "draft"
    }
    
    response = await client.post(
        "/api/schedules/",
        json=midmonth_schedule,
        headers=auth_headers
    )
    
    assert response.status_code == 200 