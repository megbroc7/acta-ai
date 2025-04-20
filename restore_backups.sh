#!/bin/bash
# Script to restore backups if the migration fails

echo "Restoring backup files..."

# Restore backend files
cp backups/blog_schedule.py.bak backend/app/models/blog_schedule.py
cp backups/schedules.py.bak backend/app/api/schedules.py

# Restore frontend files
cp backups/ScheduleForm.js.bak frontend/src/pages/schedules/ScheduleForm.js
cp backups/SchedulesList.js.bak frontend/src/pages/schedules/SchedulesList.js

echo "Backups restored! Restart your servers to apply the original files." 