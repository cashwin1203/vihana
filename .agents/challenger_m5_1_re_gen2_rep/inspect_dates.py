import sqlite3

conn = sqlite3.connect('prisma/dev.db')
cursor = conn.cursor()

tables = ['Volunteer', 'Session', 'VolunteerAttendance', 'Center', 'City', 'Organization']

for table in tables:
    cursor.execute(f"PRAGMA table_info({table})")
    cols = [col[1] for col in cursor.fetchall()]
    cursor.execute(f"SELECT * FROM {table}")
    rows = cursor.fetchall()
    print(f"=== Table {table} ({len(rows)} rows) ===")
    for row in rows:
        for idx, val in enumerate(row):
            col_name = cols[idx]
            if 'Date' in col_name or 'At' in col_name or 'time' in col_name.lower():
                if isinstance(val, (int, float)):
                    print(f"  [BAD STAMP] Row ID {row[0]} | {table}.{col_name} = {val} ({type(val)})")

conn.close()
