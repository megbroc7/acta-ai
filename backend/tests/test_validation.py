"""
Simple test to validate the schedule limitations
"""
from app.api.schedules import ScheduleCreate

def test_frequency_validators():
    """Test that the frequency validators work as expected"""
    # Test valid daily frequency
    daily_schedule = ScheduleCreate(
        name="Daily Schedule",
        site_id=1,
        prompt_template_id=1,
        frequency="daily",
        time_of_day="10:00",
        topics=["test"],
    )
    assert daily_schedule.frequency == "daily"
    
    # Test valid weekly frequency with day_of_week
    weekly_schedule = ScheduleCreate(
        name="Weekly Schedule",
        site_id=1,
        prompt_template_id=1,
        frequency="weekly",
        day_of_week=1,
        time_of_day="10:00",
        topics=["test"],
    )
    assert weekly_schedule.frequency == "weekly"
    assert weekly_schedule.day_of_week == 1
    
    # Test valid monthly frequency with day_of_month
    monthly_schedule = ScheduleCreate(
        name="Monthly Schedule",
        site_id=1,
        prompt_template_id=1,
        frequency="monthly",
        day_of_month=15,
        time_of_day="10:00",
        topics=["test"],
    )
    assert monthly_schedule.frequency == "monthly"
    assert monthly_schedule.day_of_month == 15

def test_time_of_day_validator():
    """Test that the time_of_day validator works as expected"""
    # Test valid time
    schedule = ScheduleCreate(
        name="Test Schedule",
        site_id=1,
        prompt_template_id=1,
        frequency="daily",
        time_of_day="10:00",
        topics=["test"],
    )
    assert schedule.time_of_day == "10:00"

if __name__ == "__main__":
    # Run tests directly
    test_frequency_validators()
    test_time_of_day_validator()
    print("All validation tests passed!") 