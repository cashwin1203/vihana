import sqlite3
import json

conn = sqlite3.connect('prisma/dev.db')
cursor = conn.cursor()

cursor.execute("PRAGMA table_info(Volunteer)")
columns = [col[1] for col in cursor.fetchall()]
print("Volunteer columns:", columns)

cursor.execute("SELECT * FROM Volunteer")
rows = cursor.fetchall()
print(f"Total rows in Volunteer: {len(rows)}")

for row in rows:
    row_dict = dict(zip(columns, row))
    print("--- ROW ---")
    for k, v in row_dict.items():
        print(f"  {k}: {repr(v)}")

conn.close()
