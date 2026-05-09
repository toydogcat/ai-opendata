const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const JSON_PATH = path.join(__dirname, 'TMP', 'export1778326398.json');
const DB_PATH = path.join(__dirname, 'opendata.db');

console.log('Reading JSON file...');
const rawData = fs.readFileSync(JSON_PATH, 'utf-8');
const datasets = JSON.parse(rawData);
console.log(`Successfully loaded ${datasets.length} datasets from JSON.`);

// Delete existing DB if present
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('Removed existing opendata.db');
}

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  console.log('Creating database tables...');

  // Create main datasets table
  db.run(`
    CREATE TABLE datasets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      識別碼 INTEGER UNIQUE,
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
  `);

  // Create FTS5 virtual table for lightning fast text search
  db.run(`
    CREATE VIRTUAL TABLE datasets_fts USING fts5(
      dataset_id UNINDEXED,
      名稱,
      描述,
      主要欄位,
      提供機關,
      服務分類
    )
  `);

  // Create standard B-tree indexes for fast filtering
  db.run(`CREATE INDEX idx_datasets_format ON datasets(檔案格式)`);
  db.run(`CREATE INDEX idx_datasets_category ON datasets(服務分類)`);
  db.run(`CREATE INDEX idx_datasets_agency ON datasets(提供機關)`);

  console.log('Inserting records within transaction...');

  const insertDataset = db.prepare(`
    INSERT INTO datasets (
      識別碼, 名稱, 提供屬性, 服務分類, 品質檢測, 檔案格式, 下載網址, 編碼格式, 
      上架方式, 描述, 主要欄位, 提供機關, 更新頻率, 授權方式, 相關網址, 計費方式, 
      聯絡人姓名, 聯絡人電話, 上架日期, 更新時間, 備註, 資料量
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertFts = db.prepare(`
    INSERT INTO datasets_fts (dataset_id, 名稱, 描述, 主要欄位, 提供機關, 服務分類)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.run('BEGIN TRANSACTION');

  for (let i = 0; i < datasets.length; i++) {
    const item = datasets[i];
    const 識別碼 = item['資料集識別碼'] || null;
    const 名稱 = item['資料集名稱'] || '';
    const 提供屬性 = item['資料提供屬性'] || '';
    const 服務分類 = item['服務分類'] || '';
    const 品質檢測 = item['品質檢測'] || '';
    const 檔案格式 = item['檔案格式'] || '';
    const 下載網址 = item['資料下載網址'] || '';
    const 編碼格式 = item['編碼格式'] || '';
    const 上架方式 = item['資資料集上架方式'] || '';
    const 描述 = item['資料集描述'] || '';
    const 主要欄位 = item['主要欄位說明'] || '';
    const 提供機關 = item['提供機關'] || '';
    const 更新頻率 = item['更新頻率'] || '';
    const 授權方式 = item['授權方式'] || '';
    const 相關網址 = item['相關網址'] || '';
    const 計費方式 = item['計費方式'] || '';
    const 聯絡人姓名 = item['提供機關聯絡人姓名'] || '';
    const 聯絡人電話 = item['提供機關聯絡人電話'] || '';
    const 上架日期 = item['上架日期'] || '';
    const 更新時間 = item['詮釋資料更新時間'] || '';
    const 備註 = item['備註'] || '';
    const 資料量 = item['資料量'] || '';

    insertDataset.run(
      識別碼, 名稱, 提供屬性, 服務分類, 品質檢測, 檔案格式, 下載網址, 編碼格式,
      上架方式, 描述, 主要欄位, 提供機關, 更新頻率, 授權方式, 相關網址, 計費方式,
      聯絡人姓名, 聯絡人電話, 上架日期, 更新時間, 備註, 資料量,
      function(err) {
        if (err) {
          console.error(`Error inserting dataset ${識別碼}:`, err.message);
          return;
        }
        const lastId = this.lastID;
        insertFts.run(lastId, 名稱, 描述, 主要欄位, 提供機關, 服務分類, (ftsErr) => {
          if (ftsErr) {
            console.error(`Error inserting FTS for dataset ${識別碼}:`, ftsErr.message);
          }
        });
      }
    );
  }

  insertDataset.finalize();
  insertFts.finalize();

  db.run('COMMIT', (err) => {
    if (err) {
      console.error('Error committing transaction:', err.message);
    } else {
      console.log('All records inserted and transaction committed successfully.');
      
      // Print database size and counts
      db.get('SELECT count(*) as count FROM datasets', (err, row) => {
        console.log(`Total rows in datasets: ${row ? row.count : 'error'}`);
        db.get('SELECT count(*) as count FROM datasets_fts', (err, ftsRow) => {
          console.log(`Total rows in FTS index: ${ftsRow ? ftsRow.count : 'error'}`);
          db.close(() => {
            console.log('Database initialization complete!');
          });
        });
      });
    }
  });
});
