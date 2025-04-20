import sqlite3; conn = sqlite3.connect("app.db"); conn.execute("INSERT INTO blog_schedules (id, day_of_week) VALUES (1, 1), (2, 3), (3, 5)"); conn.commit(); print("Test data added")
