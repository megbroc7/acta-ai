"""
Scheduler utility functions that provide compatibility and safety across different APScheduler versions
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import logging

logger = logging.getLogger(__name__)

def safe_remove_job(scheduler: AsyncIOScheduler, job_id: str) -> bool:
    """
    Safely remove a job from the scheduler, handling the absence of 'ignore_if_not_exists' parameter
    in older APScheduler versions.
    
    Args:
        scheduler: The APScheduler instance
        job_id: The ID of the job to remove (can be a prefix)
        
    Returns:
        bool: True if successful or if job doesn't exist, False if error
    """
    try:
        # If job_id ends with underscore, it's a prefix - find matching jobs
        if job_id.endswith("_"):
            # Get all job IDs
            all_jobs = scheduler.get_jobs()
            
            # Find jobs matching the prefix
            matching_jobs = [job for job in all_jobs if job.id.startswith(job_id)]
            
            # Remove all matching jobs
            for job in matching_jobs:
                try:
                    scheduler.remove_job(job.id)
                    logger.info(f"Removed scheduled job: {job.id}")
                except Exception as e:
                    logger.warning(f"Error removing job {job.id}: {str(e)}")
            
            return True
        
        # For specific job_id (not a prefix)
        # First check if the job exists
        job = scheduler.get_job(job_id)
        if job:
            # Job exists, remove it
            scheduler.remove_job(job_id)
            logger.info(f"Removed scheduled job: {job_id}")
            return True
        else:
            # Job doesn't exist, nothing to do
            logger.info(f"Job {job_id} not found, nothing to remove")
            return True
            
    except Exception as e:
        logger.error(f"Error in safe_remove_job for {job_id}: {str(e)}")
        return False 