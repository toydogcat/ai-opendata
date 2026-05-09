import json
import os
from collections import Counter

JSON_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'TMP', 'export1778326398.json')
REPORT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'TMP', 'json_info.md')

print(f"Loading JSON from {JSON_PATH}...")
with open(JSON_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

total_records = len(data)
print(f"Loaded {total_records} records.")

# 1. Analyze Keys and Completeness
field_counts = Counter()
empty_counts = Counter()

for item in data:
    for k, v in item.items():
        field_counts[k] += 1
        if v is None or str(v).strip() in ('', 'null', 'None'):
            empty_counts[k] += 1

# 2. Analyze top values for key categorical fields
format_counter = Counter()
agency_counter = Counter()
category_counter = Counter()
license_counter = Counter()
billing_counter = Counter()

for item in data:
    format_counter[item.get('檔案格式', '未填寫')] += 1
    agency_counter[item.get('提供機關', '未填寫')] += 1
    category_counter[item.get('服務分類', '未填寫')] += 1
    license_counter[item.get('授權方式', '未填寫')] += 1
    billing_counter[item.get('計費方式', '未填寫')] += 1

# 3. Formulate the Markdown Report
report = f"""# 臺灣政府開放資料詮釋資料 (Metadata) 欄位與分布分析報告

本報告由 `python/analyze_json.py` 自動生成，旨在深入剖析 `/TMP/export1778326398.json` 所收錄之 53,000 筆政府公開資料集之中繼詮釋資料（Metadata），為後續在 GitHub Pages 上的靜態視覺化展示提供明確的數據藍圖。

---

## 一、 資料集基本概況

* **資料集總數 (Total Datasets)**: {total_records:,} 筆
* **資料提供屬性分布**: {Counter([item.get('資料提供屬性', '未知') for item in data]).most_common()}
* **計費方式分布 (Billing Mode)**: {dict(billing_counter.most_common())}

---

## 二、 詮釋資料欄位（Metadata Fields）與資料完整度分析

本資料集共包含 22 個欄位。以下為各欄位的出現率與空值（缺失值）分布，這將指導我們哪些資訊是最完整的、最值得在前端展示的：

| 欄位名稱 (JSON Key) | 出現總次數 | 空值次數 | 資料完整度 (Completeness) | 說明與特徵 |
| :--- | :---: | :---: | :---: | :--- |
"""

for field in sorted(field_counts.keys()):
    count = field_counts[field]
    missing = empty_counts[field]
    completeness = ((count - missing) / total_records) * 100
    
    # Simple descriptions for each field
    desc = ""
    if "識別碼" in field: desc = "資料集唯一標籤 ID (整數型態)"
    elif "名稱" in field: desc = "資料集的中文標題名稱"
    elif "描述" in field: desc = "詳細內容大綱與背景說明"
    elif "主要欄位" in field: desc = "CSV/JSON 資料表內所含的欄位名稱清單"
    elif "檔案格式" in field: desc = "如 CSV, JSON, XML, ZIP 等格式"
    elif "下載網址" in field: desc = "直接下載資料內容檔案的超連結 URL"
    elif "提供機關" in field: desc = "負責上架此資料的政府單位機關"
    elif "服務分類" in field: desc = "如 公共資訊、交通、就醫、購屋等服務類別"
    elif "聯絡人" in field: desc = "提供單位聯絡窗口姓名或電話"
    elif "更新頻率" in field: desc = "每日、每週、每月或不定期等更新週期"
    elif "更新時間" in field: desc = "詮釋資料的最後校訂更新時間戳"
    elif "上架日期" in field: desc = "資料集首次公開發布的時間"
    elif "授權方式" in field: desc = "如 政府資料開放授權條款-第1版"
    elif "資料量" in field: desc = "如 39 筆、檔案大小等描述"
    else: desc = "系統中繼資料欄位"
    
    report += f"| `{field}` | {count:,} | {missing:,} | **{completeness:.2f}%** | {desc} |\n"

report += f"""
---

## 三、 categorical 特徵分布分析 (Top Categorical Distributions)

這些關鍵維度是我們在 GitHub Pages 進行主題性「分群、篩選、排行、統計圖表」展示時最核心的切面：

### 1. 熱門服務分類 (Top Service Categories)
* 指引我們哪些類型的政府資料最豐富、最受大眾關心。

| 服務分類 | 資料集數量 | 百分比 |
| :--- | :---: | :---: |
"""

for cat, count in category_counter.most_common(15):
    pct = (count / total_records) * 100
    report += f"| {cat} | {count:,} | {pct:.2f}% |\n"

report += f"""
### 2. 資料檔案格式分布 (Top File Formats)
* 了解資料檔案的科技架構型態。

| 檔案格式 | 資料集數量 | 百分比 |
| :--- | :---: | :---: |
"""

for fmt, count in format_counter.most_common(15):
    pct = (count / total_records) * 100
    report += f"| `{fmt}` | {count:,} | {pct:.2f}% |\n"

report += f"""
### 3. 最活躍的資料提供機關 (Top Active Agencies)
* 提供最多開放資料集的前 15 大政府機關：

| 提供機關 | 資料集數量 | 百分比 |
| :--- | :---: | :---: |
"""

for agency, count in agency_counter.most_common(15):
    pct = (count / total_records) * 100
    report += f"| {agency} | {count:,} | {pct:.2f}% |\n"

report += f"""
### 4. 資料授權條款 (Licensing Methods)
* 法律授權開放性：

| 授權條約 | 資料集數量 | 百分比 |
| :--- | :---: | :---: |
"""

for lic, count in license_counter.most_common(10):
    pct = (count / total_records) * 100
    report += f"| {lic} | {count:,} | {pct:.2f}% |\n"

report += """
---

## 四、 第一筆資料範例 (Sample Record Structure)

為了便於程序調用，以下為 JSON 陣列中第一筆實際紀錄的結構：

```json
""" + json.dumps(data[0], indent=2, ensure_ascii=False) + """
```

---

## 五、 GitHub Pages 靜態展示策略與非「無腦展示」規劃

由於 **GitHub Pages 僅支援靜態網頁（Static Hosting）**，無法運行動態後端 (如 Express + SQLite / Node.js)，如果希望展現出「有深度、不無腦」的內容，我們不應該塞入 53,000 筆卡片讓瀏覽器卡死，而是採用以下策略：

1. **主動式數據視覺化 (Categorical Intelligence Dashboard)**
   - 使用 **Chart.js** 或 **D3.js**，將本報告中的統計特徵（如格式、分類、主辦機關等）做成動態、可點擊的視覺化看板。
   - 點擊「交通及通訊」分類，看板自動呈現該分類下「最活躍的提供機關」與「主要檔案格式」。

2. **精選/高品質資料集目錄 (Curated High-Value Collections)**
   - 我們可以預先從 53,000 個資料集中，篩選出**最完整、最實用、資料量最大、或是擁有「品質檢測：白金」**的高價值資料集（約 500 到 1000 筆，僅需數百KB）。
   - 將這些高品質資料集預先生成一個輕量、乾淨的 JSON 索引，供前端進行**完全本地、毫秒級響應的靜態檢索與卡片展示**。

3. **機關/主題深度專題 (Topic Spotlights)**
   - 深度分析或「精選專題」：例如「農業與生態專題」、「民生安全專題」、「財政預算與招標專題」。
   - 用精美的卡片、微交互與下載次數統計，展現出台灣開放資料最有價值、最具實用性的面貌，完美契合「非無腦展示」的理念。
"""

print(f"Writing report to {REPORT_PATH}...")
with open(REPORT_PATH, 'w', encoding='utf-8') as f:
    f.write(report)
print("Analysis report generated successfully!")
