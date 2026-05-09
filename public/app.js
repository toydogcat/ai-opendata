// Global Application State
const state = {
  currentPage: 1,
  limit: 12,
  activeSection: 'dashboard', // 'dashboard' or 'topics'
  activeTopic: 'env', // 'env', 'aging', 'tour'
  charts: {
    format: null,
    category: null,
    envAqi: null,
    envWeather: null,
    agingRank: null,
    agingTrend: null,
    tourismSeason: null
  }
};

// DOM Elements
const els = {
  statTotal: document.getElementById('stat-total-datasets'),
  filterFormat: document.getElementById('filter-format'),
  filterCategory: document.getElementById('filter-category'),
  filterAgency: document.getElementById('filter-agency'),
  searchInput: document.getElementById('search-input'),
  searchBtn: document.getElementById('search-btn'),
  clearSearchBtn: document.getElementById('clear-search-btn'),
  datasetsContainer: document.getElementById('datasets-container'),
  resultsTotalNum: document.getElementById('results-total-num'),
  pagination: document.getElementById('pagination'),
  loadingSpinner: document.getElementById('loading-spinner'),
  
  // Section Navigation Buttons
  navDashboard: document.getElementById('nav-dashboard'),
  navTopicsBtn: document.getElementById('nav-topics-btn'),
  
  // Main Sections
  dashboardSec: document.getElementById('dashboard-section'),
  searchSec: document.getElementById('search-section'),
  topicsSec: document.getElementById('topics-section'),
  
  // Topic Panels and Sub-buttons
  btnTopicEnv: document.getElementById('btn-topic-env'),
  btnTopicAging: document.getElementById('btn-topic-aging'),
  btnTopicTour: document.getElementById('btn-topic-tour'),
  panelEnv: document.getElementById('topic-env-panel'),
  panelAging: document.getElementById('topic-aging-panel'),
  panelTour: document.getElementById('topic-tour-panel'),
  
  // Chat Drawer
  chatDrawer: document.getElementById('chat-drawer'),
  chatToggleBtn: document.getElementById('chat-toggle-btn'),
  heroChatBtn: document.getElementById('hero-chat-btn'),
  chatCloseBtn: document.getElementById('chat-close-btn'),
  chatMessages: document.getElementById('chat-messages'),
  chatInput: document.getElementById('chat-input'),
  chatSendBtn: document.getElementById('chat-send-btn'),
  
  // Modal Details
  modalBackdrop: document.getElementById('modal-backdrop'),
  modalCard: document.getElementById('modal-card'),
  modalCloseBtn: document.getElementById('modal-close-btn'),
  modalTitle: document.getElementById('modal-title'),
  modalFormat: document.getElementById('modal-format'),
  modalCategory: document.getElementById('modal-category'),
  modalAgency: document.getElementById('modal-agency'),
  modalFrequency: document.getElementById('modal-frequency'),
  modalDesc: document.getElementById('modal-desc'),
  modalFields: document.getElementById('modal-fields'),
  modalProp: document.getElementById('modal-prop'),
  modalEncoding: document.getElementById('modal-encoding'),
  modalQuality: document.getElementById('modal-quality'),
  modalDate: document.getElementById('modal-date'),
  modalUpdate: document.getElementById('modal-update'),
  modalContact: document.getElementById('modal-contact'),
  modalDownloadBtn: document.getElementById('modal-download-btn')
};

// Initialize the Application
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  performSearch(1);
  setupEventListeners();
  
  // Prefetch first topic right away in background
  loadTopicEnv();
});

// Event Listeners Configuration
function setupEventListeners() {
  // Navigation tabs
  els.navDashboard.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('dashboard');
  });

  els.navTopicsBtn.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('topics');
  });

  document.getElementById('nav-search-btn').addEventListener('click', (e) => {
    e.preventDefault();
    showSection('dashboard');
    setTimeout(scrollToSearch, 150);
  });
  
  // Topic sub-tabs toggling
  els.btnTopicEnv.addEventListener('click', () => showTopic('env'));
  els.btnTopicAging.addEventListener('click', () => showTopic('aging'));
  els.btnTopicTour.addEventListener('click', () => showTopic('tour'));

  // Search actions
  els.searchBtn.addEventListener('click', () => performSearch(1));
  els.searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') performSearch(1);
  });
  
  els.searchInput.addEventListener('input', () => {
    if (els.searchInput.value.trim().length > 0) {
      els.clearSearchBtn.classList.add('visible');
    } else {
      els.clearSearchBtn.classList.remove('visible');
    }
  });

  els.clearSearchBtn.addEventListener('click', () => {
    els.searchInput.value = '';
    els.clearSearchBtn.classList.remove('visible');
    performSearch(1);
  });

  // Filter actions
  els.filterFormat.addEventListener('change', () => performSearch(1));
  els.filterCategory.addEventListener('change', () => performSearch(1));
  els.filterAgency.addEventListener('change', () => performSearch(1));

  // Chat Drawer Actions
  const toggleChat = () => els.chatDrawer.classList.toggle('open');
  els.chatToggleBtn.addEventListener('click', toggleChat);
  els.heroChatBtn.addEventListener('click', toggleChat);
  els.chatCloseBtn.addEventListener('click', () => els.chatDrawer.classList.remove('open'));
  
  els.chatSendBtn.addEventListener('click', sendChatMessage);
  els.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });

  // Modal Actions
  els.modalCloseBtn.addEventListener('click', closeModal);
  els.modalBackdrop.addEventListener('click', (e) => {
    if (e.target === els.modalBackdrop) closeModal();
  });
}

// Switch between main application sections
function showSection(section) {
  state.activeSection = section;
  
  if (section === 'dashboard') {
    els.navDashboard.classList.add('active');
    els.navTopicsBtn.classList.remove('active');
    els.dashboardSec.style.display = 'block';
    els.searchSec.style.display = 'block';
    els.topicsSec.style.display = 'none';
  } else if (section === 'topics') {
    els.navDashboard.classList.remove('active');
    els.navTopicsBtn.classList.add('active');
    els.dashboardSec.style.display = 'none';
    els.searchSec.style.display = 'none';
    els.topicsSec.style.display = 'block';
    // Trigger chart load for current topic
    showTopic(state.activeTopic);
  }
}

// Switch between special topic tabs
function showTopic(topic) {
  state.activeTopic = topic;
  
  // Toggles active buttons
  els.btnTopicEnv.classList.toggle('active', topic === 'env');
  els.btnTopicAging.classList.toggle('active', topic === 'aging');
  els.btnTopicTour.classList.toggle('active', topic === 'tour');
  
  // Toggles active panels
  els.panelEnv.style.display = topic === 'env' ? 'flex' : 'none';
  els.panelAging.style.display = topic === 'aging' ? 'flex' : 'none';
  els.panelTour.style.display = topic === 'tour' ? 'flex' : 'none';
  
  // Load respective topic charts
  if (topic === 'env') loadTopicEnv();
  else if (topic === 'aging') loadTopicAging();
  else if (topic === 'tour') loadTopicTourism();
}

// Fetch and load high-level statistics & init charts
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const stats = await res.json();
    
    // Set total count
    els.statTotal.textContent = Number(stats.total).toLocaleString();
    
    // Populate Agency filter with Top 10 agencies
    els.filterAgency.innerHTML = '<option value="">全部機關</option>' + 
      stats.agencies.map(a => `<option value="${a.name}">${a.name} (${a.count})</option>`).join('');
    
    // Draw Formats Bar Chart
    const formatCtx = document.getElementById('formatChart').getContext('2d');
    state.charts.format = new Chart(formatCtx, {
      type: 'bar',
      data: {
        labels: stats.formats.map(f => f.name),
        datasets: [{
          label: '資料集數量',
          data: stats.formats.map(f => f.count),
          backgroundColor: 'rgba(6, 182, 212, 0.45)',
          borderColor: '#06b6d4',
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } }
        }
      }
    });

    // Draw Categories Doughnut Chart
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    state.charts.category = new Chart(categoryCtx, {
      type: 'doughnut',
      data: {
        labels: stats.categories.map(c => c.name),
        datasets: [{
          data: stats.categories.map(c => c.count),
          backgroundColor: [
            '#06b6d4', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
            '#ec4899', '#f43f5e', '#14b8a6', '#6366f1', '#a855f7'
          ],
          borderWidth: 0,
          hoverOffset: 12
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            position: 'right',
            labels: { color: '#9ca3af', font: { size: 11 } }
          }
        }
      }
    });

  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// Perform advanced search & populate cards
async function performSearch(page = 1) {
  state.currentPage = page;
  els.loadingSpinner.style.display = 'flex';
  
  // Clear only cards, keep loading indicator visible
  const cards = els.datasetsContainer.querySelectorAll('.dataset-card');
  cards.forEach(c => c.remove());

  const q = els.searchInput.value.trim();
  const format = els.filterFormat.value;
  const category = els.filterCategory.value;
  const agency = els.filterAgency.value;

  const url = `/api/search?q=${encodeURIComponent(q)}&format=${encodeURIComponent(format)}&category=${encodeURIComponent(category)}&agency=${encodeURIComponent(agency)}&page=${page}&limit=${state.limit}`;

  try {
    const res = await fetch(url);
    const data = await res.json();
    
    els.loadingSpinner.style.display = 'none';
    els.resultsTotalNum.textContent = Number(data.total).toLocaleString();

    if (data.results.length === 0) {
      els.datasetsContainer.innerHTML += `
        <div class="loading-spinner-container" style="grid-column: 1 / -1;">
          <i class="fa-solid fa-folder-open" style="font-size: 3rem; color: var(--text-muted);"></i>
          <span>沒有找到符合條件的資料集，建議更換搜尋條件或關鍵字。</span>
        </div>
      `;
      els.pagination.innerHTML = '';
      return;
    }

    // Render dataset card grids
    data.results.forEach(item => {
      const descText = item.描述 ? item.描述 : '此資料集尚未提供詮釋資料描述。';
      const sizeText = item.資料量 ? `資料量：${item.資料量}` : '公開資料';
      
      const card = document.createElement('div');
      card.className = 'dataset-card glass-card';
      card.innerHTML = `
        <div class="card-tags">
          <span class="badge-format">${item.檔案格式 || '未知'}</span>
          <span class="badge-category">${item.服務分類 || '未分類'}</span>
        </div>
        <h3 class="card-title">${item.名稱}</h3>
        <p class="card-desc">${descText}</p>
        <div class="card-footer">
          <span class="card-agency"><i class="fa-solid fa-landmark"></i> ${item.提供機關}</span>
          <span><i class="fa-solid fa-box"></i> ${sizeText}</span>
        </div>
      `;
      card.addEventListener('click', () => openDatasetDetails(item.id));
      els.datasetsContainer.appendChild(card);
    });

    renderPagination(data.page, data.pages);

  } catch (err) {
    els.loadingSpinner.style.display = 'none';
    console.error('Search error:', err);
  }
}

// Draw Pagination Page Button elements
function renderPagination(current, total) {
  if (total <= 1) {
    els.pagination.innerHTML = '';
    return;
  }

  let html = '';
  
  // Previous button
  html += `<button class="page-btn ${current === 1 ? 'disabled' : ''}" onclick="performSearch(${current - 1})"><i class="fa-solid fa-chevron-left"></i></button>`;

  // Smart page numbers (Show first, last, and window around current)
  const windowStart = Math.max(1, current - 2);
  const windowEnd = Math.min(total, current + 2);

  if (windowStart > 1) {
    html += `<button class="page-btn" onclick="performSearch(1)">1</button>`;
    if (windowStart > 2) html += `<span style="color: var(--text-muted); padding: 0 4px;">...</span>`;
  }

  for (let i = windowStart; i <= windowEnd; i++) {
    html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="performSearch(${i})">${i}</button>`;
  }

  if (windowEnd < total) {
    if (windowEnd < total - 1) html += `<span style="color: var(--text-muted); padding: 0 4px;">...</span>`;
    html += `<button class="page-btn" onclick="performSearch(${total})">${total}</button>`;
  }

  // Next button
  html += `<button class="page-btn ${current === total ? 'disabled' : ''}" onclick="performSearch(${current + 1})"><i class="fa-solid fa-chevron-right"></i></button>`;

  els.pagination.innerHTML = html;
}

// Open modal and load detail metadata
async function openDatasetDetails(id) {
  els.modalBackdrop.classList.add('open');
  
  // Set default loading state
  els.modalTitle.textContent = '載入資料中...';
  els.modalDesc.textContent = '正在高速讀取詳細詮釋資料...';
  els.modalFields.innerHTML = '';
  
  try {
    const res = await fetch(`/api/dataset/${id}`);
    const item = await res.json();
    
    els.modalTitle.textContent = item.名稱;
    els.modalFormat.textContent = item.檔案格式 || '未知';
    els.modalCategory.textContent = item.服務分類 || '公共資訊';
    els.modalAgency.textContent = item.提供機關 || '中華民國政府';
    els.modalFrequency.textContent = item.更新頻率 || '無定期';
    els.modalDesc.textContent = item.描述 || '此政府開放資料集暫無詳細文字描述。';
    
    // Parse fields and make interactive tags
    if (item.主要欄位) {
      const fields = item.主要欄位.split(/[;；,，#\s]+/);
      els.modalFields.innerHTML = fields.filter(f => f.trim()).map(f => `<span class="column-tag">${f.trim()}</span>`).join('');
    } else {
      els.modalFields.innerHTML = '<span class="column-tag">暫無欄位說明</span>';
    }

    els.modalProp.textContent = item.提供屬性 || '原始資料';
    els.modalEncoding.textContent = item.編碼格式 || 'UTF-8';
    els.modalQuality.textContent = item.品質檢測 || '無分類';
    els.modalDate.textContent = item.上架日期 ? item.上架日期.split(' ')[0] : '2016-11-30';
    els.modalUpdate.textContent = item.更新時間 || '暫無更新紀錄';
    
    const contactInfo = [item.聯絡人姓名, item.聯絡人電話].filter(c => c).join(' / ');
    els.modalContact.textContent = contactInfo || '政府開放資料推動小組';

    if (item.下載網址) {
      els.modalDownloadBtn.href = item.下載網址;
      els.modalDownloadBtn.style.display = 'inline-flex';
    } else {
      els.modalDownloadBtn.style.display = 'none';
    }

  } catch (err) {
    console.error('Failed to load dataset details:', err);
    els.modalTitle.textContent = '讀取失敗';
    els.modalDesc.textContent = '系統讀取此資料集細節時發生異常錯誤，請稍後再試。';
  }
}

function closeModal() {
  els.modalBackdrop.classList.remove('open');
}

// AI Assistant Chat Flows
async function sendChatMessage() {
  const query = els.chatInput.value.trim();
  if (!query) return;

  // Render User Message bubble
  appendChatBubble(query, 'user');
  els.chatInput.value = '';
  
  // Render typing bubble placeholder
  const typingBubble = appendChatBubble('<i class="fa-solid fa-ellipsis fa-bounce"></i> 正在檢索 53k 資料庫並編寫推薦...', 'system-typing');

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: query })
    });
    const data = await res.json();
    
    // Remove typing indicator
    typingBubble.remove();

    // Render chatbot reply bubble
    const replyText = data.reply.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    const bubble = appendChatBubble(replyText, 'system');

    // If matching datasets returned, render mini recommendation cards!
    if (data.datasets && data.datasets.length > 0) {
      data.datasets.forEach(d => {
        const miniCard = document.createElement('div');
        miniCard.className = 'chat-dataset-card';
        miniCard.innerHTML = `
          <h5>${d.name}</h5>
          <p><i class="fa-solid fa-landmark"></i> ${d.agency} | 格式: ${d.format}</p>
        `;
        miniCard.addEventListener('click', () => {
          openDatasetDetails(d.id);
        });
        bubble.querySelector('.msg-text').appendChild(miniCard);
      });
    }

  } catch (err) {
    typingBubble.remove();
    appendChatBubble('抱歉，與 AI 助手伺服器通訊時發生了異常錯誤。請再試一次。', 'system');
    console.error('Chat error:', err);
  }
}

function appendChatBubble(content, sender) {
  const bubble = document.createElement('div');
  bubble.className = `message ${sender === 'user' ? 'user-msg' : 'system-msg'}`;
  bubble.innerHTML = `
    <div class="msg-avatar">
      <i class="fa-solid ${sender === 'user' ? 'fa-user' : 'fa-robot'}"></i>
    </div>
    <div class="msg-text">${content}</div>
  `;
  els.chatMessages.appendChild(bubble);
  els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
  return bubble;
}

// Handle sample query buttons inside initial system message
function sendSampleChat(query) {
  els.chatInput.value = query;
  sendChatMessage();
}

// UI helper methods
function scrollToSearch() {
  document.getElementById('search-section').scrollIntoView({ behavior: 'smooth' });
}


/* ==========================================================================
   Special Topics Dynamic Data Loading & Chart.js Rendering
   ========================================================================== */

// Topic 2: Environment Dashboard Load
async function loadTopicEnv() {
  if (state.charts.envAqi && state.charts.envWeather) return; // Prevent double draw

  try {
    const res = await fetch('/data/env_stats.json');
    const data = await res.json();

    // 1. Air Quality (AQI) bar chart
    const aqiCtx = document.getElementById('envAqiChart').getContext('2d');
    state.charts.envAqi = new Chart(aqiCtx, {
      type: 'bar',
      data: {
        labels: data.cities,
        datasets: [
          {
            label: 'AQI 數值',
            data: data.aqi_averages,
            backgroundColor: 'rgba(16, 185, 129, 0.45)',
            borderColor: '#10b981',
            borderWidth: 1.5,
            borderRadius: 5,
            order: 1
          },
          {
            label: 'PM2.5 濃度 (μg/m³)',
            data: data.pm25_averages,
            type: 'line',
            borderColor: '#ec4899',
            backgroundColor: 'transparent',
            pointBackgroundColor: '#ec4899',
            borderWidth: 2,
            tension: 0.3,
            order: 0
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3af' } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 } } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } }
        }
      }
    });

    // 2. Weather Contrast line/bar chart
    const weatherCtx = document.getElementById('envWeatherChart').getContext('2d');
    state.charts.envWeather = new Chart(weatherCtx, {
      type: 'line',
      data: {
        labels: data.seasonal_weather.labels,
        datasets: [
          {
            label: '北部氣溫 (°C)',
            data: data.seasonal_weather.northern_temp,
            borderColor: '#06b6d4',
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.2
          },
          {
            label: '南部氣溫 (°C)',
            data: data.seasonal_weather.southern_temp,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.2
          },
          {
            label: '北部降雨量 (mm)',
            data: data.seasonal_weather.northern_rainfall,
            type: 'bar',
            backgroundColor: 'rgba(6, 182, 212, 0.15)',
            borderColor: 'rgba(6, 182, 212, 0.4)',
            borderWidth: 1,
            borderRadius: 3
          },
          {
            label: '南部降雨量 (mm)',
            data: data.seasonal_weather.southern_rainfall,
            type: 'bar',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            borderColor: 'rgba(245, 158, 11, 0.4)',
            borderWidth: 1,
            borderRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3af', font: { size: 10 } } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } }
        }
      }
    });

  } catch (err) {
    console.error('Failed to load Environment topic data:', err);
  }
}

// Topic 3: Aging Demographics Dashboard Load
async function loadTopicAging() {
  if (state.charts.agingRank && state.charts.agingTrend) return; // Prevent double draw

  try {
    const res = await fetch('/data/aging_stats.json');
    const data = await res.json();

    // 1. Aging Index ranking chart
    const rankCtx = document.getElementById('agingRankChart').getContext('2d');
    state.charts.agingRank = new Chart(rankCtx, {
      type: 'bar',
      data: {
        labels: data.counties,
        datasets: [
          {
            label: '老化指數',
            data: data.aging_index,
            backgroundColor: 'rgba(139, 92, 246, 0.45)',
            borderColor: '#8b5cf6',
            borderWidth: 1.5,
            borderRadius: 4
          },
          {
            label: '老年人口占比 (%)',
            data: data.elderly_percentage,
            type: 'line',
            borderColor: '#f43f5e',
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3af' } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { size: 10 } } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } }
        }
      }
    });

    // 2. Ten-year Aging projection trend line chart
    const trendCtx = document.getElementById('agingTrendChart').getContext('2d');
    state.charts.agingTrend = new Chart(trendCtx, {
      type: 'line',
      data: {
        labels: data.projection_10yr.years,
        datasets: [
          {
            label: '老年人口占比 預測 (%)',
            data: data.projection_10yr.elderly_pct_trend,
            borderColor: '#f43f5e',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            fill: true,
            borderWidth: 2,
            tension: 0.2
          },
          {
            label: '幼年人口占比 預測 (%)',
            data: data.projection_10yr.youth_pct_trend,
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            fill: true,
            borderWidth: 2,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3af' } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } }
        }
      }
    });

  } catch (err) {
    console.error('Failed to load Aging topic data:', err);
  }
}

// Topic 4: Tourism Dashboard Load
async function loadTopicTourism() {
  // Populate table and draw crowd seasonality chart
  try {
    const res = await fetch('/data/tourism_stats.json');
    const data = await res.json();

    // 1. Populate TOP 10 Spot Table
    const tbody = document.querySelector('#tourism-table tbody');
    if (tbody.children.length === 0) {
      tbody.innerHTML = data.top_spots.map((spot, idx) => `
        <tr>
          <td><span class="rank-num">#${idx + 1}</span></td>
          <td style="font-weight: 700; color: white;">${spot.name}</td>
          <td><i class="fa-solid fa-map-pin" style="color: var(--accent-cyan); margin-right: 4px;"></i> ${spot.county}</td>
          <td><span class="badge-category" style="padding: 2px 8px;">${spot.category}</span></td>
          <td style="font-family: var(--font-title); font-weight: 700; color: var(--accent-cyan);">${spot.visitors_annual.toLocaleString()} <span>人次</span></td>
        </tr>
      `).join('');
    }

    // 2. Seasonality chart
    if (state.charts.tourismSeason) return; // Prevent double draw
    const seasonCtx = document.getElementById('tourismSeasonChart').getContext('2d');
    state.charts.tourismSeason = new Chart(seasonCtx, {
      type: 'line',
      data: {
        labels: data.seasonality.labels,
        datasets: [
          {
            label: '都會型休閒熱點人流 (萬人次)',
            data: data.seasonality.urban_spots,
            borderColor: '#ec4899',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            tension: 0.3
          },
          {
            label: '大自然秘境景點人流 (萬人次)',
            data: data.seasonality.nature_spots,
            borderColor: '#10b981',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#9ca3af', font: { size: 10 } } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
          y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#9ca3af' } }
        }
      }
    });

  } catch (err) {
    console.error('Failed to load Tourism topic data:', err);
  }
}
