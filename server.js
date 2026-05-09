const express = require('express');
const cors = require('cors');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'opendata.db');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to SQLite database
const db = new sqlite3.Database(DB_PATH, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
  } else {
    console.log('Connected to opendata.db successfully.');
  }
});

// Endpoint: Get high-level aggregated statistics
app.get('/api/stats', (req, res) => {
  const stats = {};
  
  db.get('SELECT count(*) as total FROM datasets', [], (err, totalRow) => {
    if (err) return res.status(500).json({ error: err.message });
    stats.total = totalRow ? totalRow.total : 0;

    // Top 10 File Formats
    db.all(`
      SELECT 檔案格式 as name, count(*) as count 
      FROM datasets 
      WHERE 檔案格式 != '' 
      GROUP BY 檔案格式 
      ORDER BY count DESC 
      LIMIT 10
    `, [], (err, formatRows) => {
      if (err) return res.status(500).json({ error: err.message });
      stats.formats = formatRows;

      // Top 10 Providing Agencies
      db.all(`
        SELECT 提供機關 as name, count(*) as count 
        FROM datasets 
        WHERE 提供機關 != '' 
        GROUP BY 提供機關 
        ORDER BY count DESC 
        LIMIT 10
      `, [], (err, agencyRows) => {
        if (err) return res.status(500).json({ error: err.message });
        stats.agencies = agencyRows;

        // Top 10 Categories
        db.all(`
          SELECT 服務分類 as name, count(*) as count 
          FROM datasets 
          WHERE 服務分類 != '' 
          GROUP BY 服務分類 
          ORDER BY count DESC 
          LIMIT 10
        `, [], (err, categoryRows) => {
          if (err) return res.status(500).json({ error: err.message });
          stats.categories = categoryRows;
          
          res.json(stats);
        });
      });
    });
  });
});

// Endpoint: Advanced Full-Text Search with filters and pagination
app.get('/api/search', (req, res) => {
  const q = req.query.q ? req.query.q.trim() : '';
  const format = req.query.format ? req.query.format.trim() : '';
  const category = req.query.category ? req.query.category.trim() : '';
  const agency = req.query.agency ? req.query.agency.trim() : '';
  
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;
  const offset = (page - 1) * limit;

  let whereClauses = [];
  let params = [];

  // FTS5 search
  if (q) {
    // Sanitize query for FTS5 (avoid syntax errors with special chars)
    const sanitizedQuery = q.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s]/g, ' ');
    if (sanitizedQuery.trim()) {
      whereClauses.push(`d.id IN (SELECT dataset_id FROM datasets_fts WHERE datasets_fts MATCH ?)`);
      params.push(sanitizedQuery.trim());
    }
  }

  if (format) {
    whereClauses.push(`d.檔案格式 LIKE ?`);
    params.push(`%${format}%`);
  }
  if (category) {
    whereClauses.push(`d.服務分類 = ?`);
    params.push(category);
  }
  if (agency) {
    whereClauses.push(`d.提供機關 = ?`);
    params.push(agency);
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  // Get total count of matching records for pagination
  const countSql = `SELECT count(*) as count FROM datasets d ${whereSql}`;
  
  db.get(countSql, params, (err, countRow) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: err.message });
    }
    const total = countRow ? countRow.count : 0;

    // Fetch paginated results
    const selectSql = `
      SELECT d.id, d.識別碼, d.名稱, d.描述, d.檔案格式, d.服務分類, d.提供機關, d.資料量 
      FROM datasets d 
      ${whereSql} 
      ORDER BY d.id ASC 
      LIMIT ? OFFSET ?
    `;
    const selectParams = [...params, limit, offset];

    db.all(selectSql, selectParams, (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
      }
      res.json({
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        results: rows
      });
    });
  });
});

// Endpoint: Get specific dataset details
app.get('/api/dataset/:id', (req, res) => {
  const id = req.params.id;
  db.get('SELECT * FROM datasets WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Dataset not found.' });
    res.json(row);
  });
});

// Endpoint: AI conversational chat query
app.post('/api/chat', (req, res) => {
  const message = req.body.message ? req.body.message.trim() : '';
  if (!message) {
    return res.status(400).json({ reply: '您好！有什麼我可以幫您的嗎？請告訴我您想尋找哪方面的政府公開資料。' });
  }

  // 1. Keyword extraction logic to map query to FTS matching terms
  let searchTerm = message.replace(/[^a-zA-Z0-9\u4e00-\u9fa5\s]/g, ' ').trim();
  
  // Custom semantic mappings for common Taiwan open-data queries
  let topicExplanation = '公開資料';
  if (message.includes('天氣') || message.includes('雨') || message.includes('氣象') || message.includes('颱風')) {
    searchTerm = '天氣 OR 雨量 OR 氣象';
    topicExplanation = '天氣與氣象';
  } else if (message.includes('交通') || message.includes('捷運') || message.includes('公車') || message.includes('停車') || message.includes('道路')) {
    searchTerm = '交通 OR 捷運 OR 公車 OR 停車場';
    topicExplanation = '交通與運輸';
  } else if (message.includes('稅') || message.includes('財政') || message.includes('發票') || message.includes('預算')) {
    searchTerm = '稅 OR 財政 OR 發票 OR 採購';
    topicExplanation = '政府財政與稅務';
  } else if (message.includes('農業') || message.includes('魚') || message.includes('農') || message.includes('花')) {
    searchTerm = '農業 OR 漁業 OR 產銷 OR 農產品';
    topicExplanation = '農業與產銷';
  } else if (message.includes('人口') || message.includes('戶籍') || message.includes('出生') || message.includes('統計')) {
    searchTerm = '人口 OR 統計 OR 指標';
    topicExplanation = '人口結構與社會統計';
  } else if (message.includes('醫療') || message.includes('醫院') || message.includes('健康') || message.includes('健保')) {
    searchTerm = '醫療 OR 健保 OR 傳染病 OR 醫院';
    topicExplanation = '公共衛生與醫療健康';
  }

  // 2. FTS match for top 4 recommendations
  const ftsSql = `
    SELECT d.id, d.名稱, d.描述, d.檔案格式, d.提供機關 
    FROM datasets d
    JOIN datasets_fts ts ON ts.dataset_id = d.id
    WHERE datasets_fts MATCH ?
    LIMIT 4
  `;

  db.all(ftsSql, [searchTerm], (err, rows) => {
    if (err || !rows || rows.length === 0) {
      // Fallback search using simpler LIKE if MATCH has zero results or errors out
      db.all(`
        SELECT id, 名稱, 描述, 檔案格式, 提供機關 
        FROM datasets 
        WHERE 名稱 LIKE ? OR 描述 LIKE ? 
        LIMIT 4
      `, [`%${message}%`, `%${message}%`], (err2, fallbackRows) => {
        if (err2 || !fallbackRows || fallbackRows.length === 0) {
          return res.json({
            reply: `我理解您想找尋關於「${message}」的資料。在目前的 53,000 個資料集中，沒有直接匹配的內容。建議您可以嘗試使用更簡短的關鍵字（如：人口、天氣、交通、發票等）來進行搜尋，或是透過上方的篩選器進行探索。`,
            datasets: []
          });
        }
        respondWithDatasets(fallbackRows, message, topicExplanation, res);
      });
      return;
    }
    respondWithDatasets(rows, message, topicExplanation, res);
  });
});

function respondWithDatasets(datasets, originalQuery, topic, res) {
  const greeting = `哈囉！我是您的 AI 資料探勘小助手。

根據您詢問的「**${originalQuery}**」，我為您在 53,000 個資料集中，精選了最合適的 **${topic}** 相關資料集：`;
  
  const closing = `\n您可以點擊下方推薦的卡片直接查看詳細欄位、聯絡方式或下載檔案！還有其他想找的資料嗎？`;

  res.json({
    reply: greeting + closing,
    datasets: datasets.map(d => ({
      id: d.id,
      name: d.名稱,
      description: d.描述.length > 80 ? d.描述.substring(0, 80) + '...' : d.描述,
      format: d.檔案格式,
      agency: d.提供機關
    }))
  });
}

// Fallback: Redirect all non-API requests to index.html
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
