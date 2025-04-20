import logging
import sys

# Set up logging to a file
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("scheduler_debug.log"),
        logging.StreamHandler(sys.stdout)
    ]
)

# Patch the scheduler service to add more logging
def patch_scheduler():
    try:
        # Import the scheduler service
        from app.services.scheduler import SchedulerService
        
        # Store the original _generate_and_post method
        original_generate_and_post = SchedulerService._generate_and_post
        
        # Create a wrapper function with detailed logging
        async def debug_generate_and_post(self, db, schedule_id):
            logging.debug(f"Starting _generate_and_post for schedule {schedule_id}")
            try:
                # Call the original method
                result = await original_generate_and_post(self, db, schedule_id)
                logging.debug(f"Successfully completed _generate_and_post for schedule {schedule_id}")
                return result
            except Exception as e:
                # Log any exceptions
                logging.error(f"Error in _generate_and_post for schedule {schedule_id}: {str(e)}")
                logging.exception(e)
                raise
        
        # Replace the original method with our debug version
        SchedulerService._generate_and_post = debug_generate_and_post
        
        # Also patch the run_now method
        original_run_now = SchedulerService.run_now
        
        async def debug_run_now(self, db, schedule_id):
            logging.debug(f"Starting run_now for schedule {schedule_id}")
            try:
                # Call the original method
                result = await original_run_now(self, db, schedule_id)
                logging.debug(f"Successfully completed run_now for schedule {schedule_id}")
                return result
            except Exception as e:
                # Log any exceptions
                logging.error(f"Error in run_now for schedule {schedule_id}: {str(e)}")
                logging.exception(e)
                raise
        
        # Replace the original method with our debug version
        SchedulerService.run_now = debug_run_now
        
        logging.info("Successfully patched the scheduler service with debug logging")
        return True
    except Exception as e:
        logging.error(f"Failed to patch scheduler service: {str(e)}")
        logging.exception(e)
        return False

if __name__ == "__main__":
    result = patch_scheduler()
    print(f"Patch {'successful' if result else 'failed'}")
    print("Debug logging will now be written to scheduler_debug.log")
    print("Restart the application for changes to take effect") 