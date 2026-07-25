import sqlite3

conn = sqlite3.connect('prisma/dev.db')
cursor = conn.cursor()
cursor.execute("SELECT * FROM Organization WHERE name = 'Format Test Org'")
row = cursor.fetchone()
print("Raw row inserted by Prisma:", row)
conn.close()
