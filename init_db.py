import json
import sqlite3
import os

JSON_PATH = 'TMP/export1778326398.json'
DB_PATH = 'opendata.db'

print("Reading JSON file...")
with open(JSON_PATH, 'r', encoding='utf-8') as f:
    datasets = json.load(f)
print(f"Loaded {len(datasets)} datasets.")

if os.path.exists(DB_PATH):
    try:
        os.remove(DB_PATH)
        print("Removed existing opendata.db")
    except Exception as e:
        print("Could not remove existing opendata.db, it may be locked:", e)

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# Create tables
cursor.execute('''
    CREATE TABLE IF NOT EXISTS datasets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      識別碼 INTEGER,
      名稱 TEXT,
      提供屬性 TEXT,
      服務分類 TEXT,
      品質檢測 TEXT,
      檔案格式 TEXT,
      下載網址 TEXT,
      編碼格式 TEXT,
      上架方式 TEXT,
      描述 TEXT,
      主要欄位 TEXT,
      提供機關 TEXT,
      更新頻率 TEXT,
      授權方式 TEXT,
      相關網址 TEXT,
      計費方式 TEXT,
      聯絡人姓名 TEXT,
      聯絡人電話 TEXT,
      上架日期 TEXT,
      更新時間 TEXT,
      備註 TEXT,
      資料量 TEXT
    )
''')

cursor.execute('''
    CREATE VIRTUAL TABLE IF NOT EXISTS datasets_fts USING fts5(
      dataset_id UNINDEXED,
      名稱,
      描述,
      主要欄位,
      提供機關,
      服務分類
    )
''')

cursor.execute('CREATE INDEX IF NOT EXISTS idx_datasets_format ON datasets(檔案格式)')
cursor.execute('CREATE INDEX IF NOT EXISTS idx_datasets_category ON datasets(服務分類)')
cursor.execute('CREATE INDEX IF NOT EXISTS idx_datasets_agency ON datasets(提供機關)')

# Insert datasets
print("Inserting datasets...")
dataset_records = []
for item in datasets:
    record = (
        item.get('資料集識別碼'),
        item.get('資料集名稱', ''),
        item.get('資料提供屬性', ''),
        item.get('服務分類', ''),
        item.get('品質檢測', ''),
        item.get('檔案格式', ''),
        item.get('資料下載網址', ''),
        item.get('編碼格式', ''),
        item.get('資資料集上架方式', ''),
        item.get('資料集描述', ''),
        item.get('主要欄位說明', ''),
        item.get('提供機關', ''),
        item.get('更新頻率', ''),
        item.get('授權方式', ''),
        item.get('相關網址', ''),
        item.get('計費方式', ''),
        item.get('提供機關聯絡人姓名', ''),
        item.get('提供機關聯絡人電話', ''),
        item.get('上架日期', ''),
        item.get('詮釋資料更新時間', ''),
        item.get('備註', ''),
        item.get('資料量', '')
    )
    dataset_records.append(record)

# Insert in bulk using executemany inside a transaction
cursor.executemany('''
    INSERT INTO datasets (
      識別碼, 名稱, 提供屬性, 服務分類, 品質檢測, 檔案格式, 下載網址, 編碼格式, 
      上架方式, 描述, 主要欄位, 提供機關, 更新頻率, 授權方式, 相關網址, 計費方式, 
      聯絡人姓名, 聯絡人電話, 上架日期, 更新時間, 備註, 資料量
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
''', dataset_records)

# Get inserted row IDs to populate FTS
cursor.execute("SELECT id, 名稱, 描述, 主要欄位, 提供機關, 服務分類 FROM datasets")
rows = cursor.fetchall()

fts_records = []
for r in rows:
    fts_records.append((r[0], r[1], r[2], r[3], r[4], r[5]))

cursor.executemany('''
    INSERT INTO datasets_fts (dataset_id, 名稱, 描述, 主要欄位, 提供機關, 服務分類)
    VALUES (?, ?, ?, ?, ?, ?)
''', fts_records)

conn.commit()
print("Committed successfully!")

cursor.execute("SELECT count(*) FROM datasets")
print("Total rows in datasets:", cursor.fetchone()[0])
cursor.execute("SELECT count(*) FROM datasets_fts")
print("Total rows in FTS index:", cursor.fetchone()[0])

conn.close()
print("Database initialization complete!")
