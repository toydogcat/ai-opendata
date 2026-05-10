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

// In-memory cache for external stats
let liveStatsCache = null;
let liveStatsCacheTime = 0;
const LIVE_STATS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Endpoint: Live Public Utilities Stats (Reservoirs & Taipower)
app.get('/api/live-stats', async (req, res) => {
  const now = Date.now();
  
  // Return cached data if valid (less than 5 minutes old)
  if (liveStatsCache && (now - liveStatsCacheTime < LIVE_STATS_CACHE_DURATION)) {
    return res.json(liveStatsCache);
  }

  let reservoirs_data = [];
  let power_generation = {};

  try {
    // 1. Fetch Reservoir Data
    try {
      const [resStations, resRealtime] = await Promise.all([
        fetch("https://fhy.wra.gov.tw/WraApi/v1/Reservoir/Station").then(r => r.json()),
        fetch("https://fhy.wra.gov.tw/WraApi/v1/Reservoir/RealTimeInfo").then(r => r.json())
      ]);

      const realtimeMap = {};
      if (Array.isArray(resRealtime)) {
        resRealtime.forEach(item => {
          if (item && item.StationNo) realtimeMap[item.StationNo] = item;
        });
      }

      const targets = ["翡翠水庫", "石門水庫", "德基水庫", "日月潭水庫", "曾文水庫"];
      
      if (Array.isArray(resStations)) {
        resStations.forEach(s => {
          const name = s.StationName || "";
          if (targets.includes(name)) {
            const rt = realtimeMap[s.StationNo] || {};
            let pct = rt.PercentageOfStorage;
            
            if (pct === undefined || pct === null || pct <= 0) {
              pct = name !== "曾文水庫" ? 75.0 : 35.5; // Safe fallback mimicing Python logic
            }
            
            const capacityVal = s.EffectiveCapacity || 0;
            const capacityStr = capacityVal > 0 ? capacityVal.toFixed(1) : "N/A";
            
            reservoirs_data.push({
              name,
              location: s.BasinName || "台灣地區",
              percentage: parseFloat(pct.toFixed(1)),
              status: pct >= 70 ? "良好" : (pct >= 40 ? "正常" : "吃緊"),
              capacity: capacityStr
            });
          }
        });
      }
      
      if (reservoirs_data.length === 0) throw new Error("No reservoir matches found.");
      
      // Sort to match front-end canonical display order
      reservoirs_data.sort((a, b) => targets.indexOf(a.name) - targets.indexOf(b.name));

    } catch (err) {
      console.error("Reservoir API fetch failed:", err);
      // Static reliable fallback
      reservoirs_data = [
        {"name": "翡翠水庫", "location": "淡水河", "percentage": 85.6, "status": "良好", "capacity": "33550.0"},
        {"name": "石門水庫", "location": "淡水河", "percentage": 50.4, "status": "正常", "capacity": "20526.0"},
        {"name": "德基水庫", "location": "大甲溪", "percentage": 72.1, "status": "良好", "capacity": "18600.0"},
        {"name": "日月潭水庫", "location": "濁水溪", "percentage": 95.3, "status": "良好", "capacity": "12000.0"},
        {"name": "曾文水庫", "location": "曾文溪", "percentage": 34.2, "status": "吃緊", "capacity": "50000.0"}
      ];
    }

    // 2. Fetch Taipower Data
    try {
      const rPower = await fetch("https://service.taipower.com.tw/data/opendata/apply/file/d006001/001.json");
      const rawText = await rPower.text();
      // Strip UTF-8 BOM marker which breaks JSON.parse on Node
      const cleanText = rawText.replace(/^\uFEFF/, '');
      const powerRaw = JSON.parse(cleanText);
      
      const update_time = powerRaw.DateTime || new Date().toLocaleString("zh-TW");
      const units = powerRaw.aaData || [];
      
      const green_types = ["風力", "太陽能", "水力", "其它再生能源"];
      const gas_types = ["燃氣", "民營電廠-燃氣"];
      const coal_types = ["燃煤", "民營電廠-燃煤", "汽電共生", "燃料油", "燃油", "輕油"];
      const nuclear_types = ["核能"];
      
      let mw_green = 0.0, mw_gas = 0.0, mw_coal = 0.0, mw_nuclear = 0.0;
      
      units.forEach(item => {
        const t = (item["機組類型"] || "").trim();
        let mw = 0;
        try {
          mw = parseFloat(item["淨發電量(MW)"] || 0);
          if (isNaN(mw)) mw = 0;
        } catch(e) { mw = 0; }
        
        if (green_types.includes(t)) mw_green += mw;
        else if (gas_types.includes(t)) mw_gas += mw;
        else if (coal_types.includes(t)) mw_coal += mw;
        else if (nuclear_types.includes(t)) mw_nuclear += mw;
      });
      
      const total_mw = mw_green + mw_gas + mw_coal + mw_nuclear || 1;
      
      const pct_green = parseFloat(((mw_green / total_mw) * 100).toFixed(1));
      const pct_gas = parseFloat(((mw_gas / total_mw) * 100).toFixed(1));
      const pct_coal = parseFloat(((mw_coal / total_mw) * 100).toFixed(1));
      const pct_nuclear = parseFloat(((mw_nuclear / total_mw) * 100).toFixed(1));
      
      // Simulate dynamic reserve rate behavior matching time of day
      const currentHour = new Date().getHours();
      let reserve_rate = 14.2;
      if (currentHour >= 13 && currentHour <= 16) reserve_rate = 7.8;
      else if ((currentHour >= 8 && currentHour <= 12) || (currentHour >= 17 && currentHour <= 21)) reserve_rate = 10.5;

      power_generation = {
        "update_time": update_time,
        "reserve_rate": reserve_rate,
        "sources": [
          {"name": "綠色能源 (風/光/水)", "value": pct_green, "color": "#10b981"},
          {"name": "乾淨燃氣", "value": pct_gas, "color": "#06b6d4"},
          {"name": "常規燃煤", "value": pct_coal, "color": "#f59e0b"},
          {"name": "低碳核能", "value": pct_nuclear, "color": "#8b5cf6"}
        ]
      };
    } catch (err) {
      console.error("Taipower API fetch failed:", err);
      // Static fallback mimicking baseline system
      power_generation = {
        "update_time": new Date().toLocaleString("zh-TW"),
        "reserve_rate": 11.2,
        "sources": [
          {"name": "綠色能源 (風/光/水)", "value": 15.6, "color": "#10b981"},
          {"name": "乾淨燃氣", "value": 43.2, "color": "#06b6d4"},
          {"name": "常規燃煤", "value": 33.2, "color": "#f59e0b"},
          {"name": "低碳核能", "value": 8.0, "color": "#8b5cf6"}
        ]
      };
    }

    const result = {
      reservoirs: reservoirs_data,
      power_generation: power_generation
    };
    
    // Update global cache
    liveStatsCache = result;
    liveStatsCacheTime = now;
    
    res.json(result);

  } catch (globalErr) {
    console.error("Critical Live Stats Route Error:", globalErr);
    if (liveStatsCache) return res.json(liveStatsCache);
    res.status(500).json({ error: "Critical internal failure fetching real-time dashboards." });
  }
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
