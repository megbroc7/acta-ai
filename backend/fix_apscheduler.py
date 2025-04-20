#!/usr/bin/env python3
"""
Solution script for APScheduler compatibility issues
"""

import os
import sys
from pathlib import Path

def print_scheduler_fix_instructions():
    print("===== APScheduler Compatibility Fix Instructions =====")
    print("\nThe error 'BaseScheduler.remove_job() got an unexpected keyword argument 'ignore_if_not_exists''")
    print("indicates a version compatibility issue with APScheduler.")
    
    print("\nTo fix this, you need to:")
    
    print("\n1. Check your APScheduler version:")
    print("   $ pip show apscheduler")
    
    print("\n2. Update the scheduler.py file to handle incompatible arguments.")
    print("   The issue is in your scheduler_service.py file when removing jobs.")
    
    code_fix = """
    # Original problematic code (likely in app/services/scheduler_service.py)
    def remove_job(self, job_id):
        try:
            self.scheduler.remove_job(job_id, ignore_if_not_exists=True)  # This causes the error
        except Exception as e:
            print(f"Error removing scheduled job: {str(e)}")
    
    # Fixed version that's compatible with all APScheduler versions
    def remove_job(self, job_id):
        try:
            # Check if job exists first
            if self.scheduler.get_job(job_id):
                self.scheduler.remove_job(job_id)
            # If job doesn't exist, it's already gone - no need to remove
        except Exception as e:
            print(f"Error removing scheduled job: {str(e)}")
    """
    
    print("\nProposed fix:")
    print(code_fix)
    
    print("\n3. Apply this fix to all locations where scheduler.remove_job is called.")

def find_and_print_scheduler_service():
    """Find the scheduler service file and print its content"""
    try:
        # Try to find the scheduler service file
        backend_dir = Path(os.getcwd())
        potential_paths = [
            backend_dir / "app" / "services" / "scheduler_service.py",
            backend_dir / "app" / "services" / "scheduler.py",
            backend_dir / "app" / "scheduler.py",
        ]
        
        found_file = None
        for path in potential_paths:
            if path.exists():
                found_file = path
                break
        
        if found_file:
            print(f"\nFound scheduler file: {found_file}")
            print("\nRelevant content:")
            content = found_file.read_text()
            
            # Look for the remove_job method
            import re
            pattern = r"def\s+remove_job.*?(?=def|\Z)"
            matches = re.findall(pattern, content, re.DOTALL)
            
            if matches:
                for match in matches:
                    print("\n" + match.strip())
            else:
                print("Could not find remove_job method in the file.")
                # Print lines containing remove_job
                for i, line in enumerate(content.splitlines()):
                    if "remove_job" in line:
                        print(f"Line {i+1}: {line}")
                        
            return found_file
        else:
            print("\nCould not find scheduler service file.")
            return None
    except Exception as e:
        print(f"\nError finding scheduler file: {str(e)}")
        return None

def fix_scheduler_service(file_path):
    """Update the scheduler service to fix the ignore_if_not_exists issue"""
    if file_path and file_path.exists():
        try:
            content = file_path.read_text()
            
            # Check if code contains the problematic parameter
            if "ignore_if_not_exists=True" in content:
                import re
                # Replace the remove_job method
                pattern = r"def\s+remove_job.*?try:.*?self\.scheduler\.remove_job\([^)]*ignore_if_not_exists=True[^)]*\).*?(?=def|\Z)"
                
                replacement = """def remove_job(self, job_id):
        try:
            # Check if job exists first
            if self.scheduler.get_job(job_id):
                self.scheduler.remove_job(job_id)
            # If job doesn't exist, it's already gone - no need to remove
        except Exception as e:
            print(f"Error removing scheduled job: {str(e)}")
            
    """
                
                new_content = re.sub(pattern, replacement, content, flags=re.DOTALL)
                
                # If the pattern didn't match, try a simpler approach
                if new_content == content:
                    new_content = content.replace(
                        "self.scheduler.remove_job(job_id, ignore_if_not_exists=True)",
                        "# Check if job exists first\n            if self.scheduler.get_job(job_id):\n                self.scheduler.remove_job(job_id)"
                    )
                
                # If content was changed, write it back
                if new_content != content:
                    file_path.write_text(new_content)
                    print(f"\nUpdated {file_path} to fix the ignore_if_not_exists issue.")
                    return True
                else:
                    print(f"\nCouldn't automatically fix {file_path}. Please modify it manually.")
                    return False
            else:
                print(f"\nThe file {file_path} doesn't contain 'ignore_if_not_exists=True'. No changes needed.")
                return False
        except Exception as e:
            print(f"\nError fixing scheduler file: {str(e)}")
            return False
    else:
        print(f"\nFile {file_path} doesn't exist. Can't fix scheduler service.")
        return False

def main():
    print_scheduler_fix_instructions()
    
    scheduler_file = find_and_print_scheduler_service()
    
    if scheduler_file:
        choice = input("\nDo you want to fix the scheduler service automatically? (y/n): ")
        if choice.lower() == 'y':
            success = fix_scheduler_service(scheduler_file)
            if success:
                print("\nAPScheduler compatibility issue fixed. The next step is to:")
                print("1. Restart your backend server")
                print("2. Test the deactivate feature again")
            else:
                print("\nCouldn't automatically fix the APScheduler compatibility issue.")
                print("Please follow the instructions above to fix it manually.")
        else:
            print("\nNo changes made. You'll need to implement the fix manually.")
    else:
        print("\nPlease locate your scheduler service file and fix the remove_job method manually")
        print("using the instructions provided above.")

if __name__ == "__main__":
    main() 