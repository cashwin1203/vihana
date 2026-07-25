import sqlite3
from datetime import datetime, timezone

conn = sqlite3.connect('prisma/dev.db')
cursor = conn.cursor()

tables = ['Volunteer', 'Session', 'VolunteerAttendance', 'StudentAttendance', 'Center', 'City', 'Organization', 'AuditLog']

for table in tables:
    cursor.execute(f"PRAGMA table_info({table})")
    cols = [col[1] for col in cursor.fetchall()]
    cursor.execute(f"SELECT * FROM {table}")
    rows = cursor.fetchall()
    for row in rows:
        row_id = row[0]
        updates = []
        params = []
        for idx, val in enumerate(row):
            col_name = cols[idx]
            if 'Date' in col_name or 'At' in col_name or 'time' in col_name.lower():
                if isinstance(val, (int, float)):
                    dt = datetime.fromtimestamp(val / 1000.0, tz=timezone.utc)
                    iso_str = dt.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
                    updates.append(f"{col_name} = ?")
                    params.append(iso_str)
                elif isinstance(val, str) and not val.endswith('Z') and 'T' not in val:
                    # Fix space format to T...Z
                    try:
                        dt = datetime.strptime(val, '%Y-%m-%d %H:%M:%S.%f')
                        iso_str = dt.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'
                        updates.append(f"{col_name} = ?")
                        params.append(iso_str)
                    except Exception:
                        pass
        if updates:
            params.append(row_id)
            sql = f"UPDATE {table} SET {', '.join(updates)} WHERE id = ?"
            cursor.execute(sql, params)

conn.commit()
print("Converted all SQLite dates to strict ISO 8601 YYYY-MM-DDTHH:MM:SS.SSSZ format.")
conn.close()
