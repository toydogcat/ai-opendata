import sqlite3
import json
import os

# Paths
DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'opendata.db')
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'public', 'data')
os.makedirs(DATA_DIR, exist_ok=True)

def main():
    print(f"Connecting to database: {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print(f"Error: Database {DB_PATH} not found. Please make sure init_db has run.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Fetch High Level Stats
    print("Exporting high level stats...")
    cursor.execute("SELECT count(*) FROM datasets")
    total = cursor.fetchone()[0]

    # Formats
    cursor.execute("""
        SELECT 檔案格式, count(*) 
        FROM datasets 
        WHERE 檔案格式 != '' 
        GROUP BY 檔案格式 
        ORDER BY count(*) DESC 
        LIMIT 10
    """)
    formats = [{"name": row[0], "count": row[1]} for row in cursor.fetchall()]

    # Agencies
    cursor.execute("""
        SELECT 提供機關, count(*) 
        FROM datasets 
        WHERE 提供機關 != '' 
        GROUP BY 提供機關 
        ORDER BY count(*) DESC 
        LIMIT 10
    """)
    agencies = [{"name": row[0], "count": row[1]} for row in cursor.fetchall()]

    # Categories
    cursor.execute("""
        SELECT 服務分類, count(*) 
        FROM datasets 
        WHERE 服務分類 != '' 
        GROUP BY 服務分類 
        ORDER BY count(*) DESC 
        LIMIT 10
    """)
    categories = [{"name": row[0], "count": row[1]} for row in cursor.fetchall()]

    stats = {
        "total": total,
        "formats": formats,
        "agencies": agencies,
        "categories": categories
    }

    with open(os.path.join(DATA_DIR, 'stats.json'), 'w', encoding='utf-8') as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    print("Exported public/data/stats.json successfully!")

    # 2. Fetch 12 Featured Datasets
    print("Exporting 12 featured datasets...")
    cursor.execute("""
        SELECT id, 識別碼, 名稱, 描述, 檔案格式, 服務分類, 提供機關, 資料量, 更新頻率, 下載網址, 主要欄位, 提供屬性, 編碼格式, 品質檢測, 上架日期, 更新時間, 聯絡人姓名, 聯絡人電話
        FROM datasets
        WHERE 描述 != '' AND 名稱 != '' AND 檔案格式 IN ('CSV', 'JSON', 'XML')
        ORDER BY RANDOM()
        LIMIT 24
    """)
    rows = cursor.fetchall()
    
    featured = []
    for r in rows:
        featured.append({
            "id": r[0],
            "識別碼": r[1],
            "名稱": r[2],
            "描述": r[3],
            "檔案格式": r[4],
            "服務分類": r[5],
            "提供機關": r[6],
            "資料量": r[7],
            "更新頻率": r[8],
            "下載網址": r[9],
            "主要欄位": r[10],
            "提供屬性": r[11],
            "編碼格式": r[12],
            "品質檢測": r[13],
            "上架日期": r[14],
            "更新時間": r[15],
            "聯絡人姓名": r[16],
            "聯絡人電話": r[17]
        })

    with open(os.path.join(DATA_DIR, 'featured_datasets.json'), 'w', encoding='utf-8') as f:
        json.dump(featured, f, ensure_ascii=False, indent=2)
    print("Exported public/data/featured_datasets.json successfully!")

    conn.close()

if __name__ == '__main__':
    main()
