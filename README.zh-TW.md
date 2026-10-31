# Web Design Toolkit

[![CI](https://github.com/Pinyi333/Open-source-Web-Design-Toolkit/actions/workflows/ci.yml/badge.svg)](https://github.com/Pinyi333/Open-source-Web-Design-Toolkit/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

一組在瀏覽器裡直接跑的網頁設計小工具。不需要帳號、沒有上傳額度、不做任何追蹤 —— clone 下來就能用。

English version: **[README.md](README.md)**

> 註：專案的操作介面與程式碼註解皆為英文，這份文件是給中文使用者的說明。

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FPinyi333%2FOpen-source-Web-Design-Toolkit)

部署一份自己的副本大約兩分鐘，而且不需要任何設定 —— 沒有環境變數、沒有資料庫、也不需要 API key。

---

## 工具

### Color Extractor（配色擷取）

丟一張截圖、設計稿或照片進去，拿回一組調色盤。

- 使用 median cut 分色演算法，每個色票代表圖片中一塊真實的區域，而不是單一取樣像素。可調 3 到 12 色。
- 每個色票都提供 HEX、RGB、HSL、OKLCH，點一下即複製。
- 對白色與黑色的 WCAG 對比值，另外附上調色盤內**每一組配對**的對比矩陣 —— 這才是你從調色盤挑兩個顏色時真正想知道的事。
- 可匯出成 CSS 自訂屬性、Tailwind v4 的 `@theme` 區塊、JSON，以及 [W3C design tokens](https://tr.designtokens.org/format/)。

**圖片不會離開你的瀏覽器。** 檔案是在本機解碼進 canvas 再讀回像素，不會上傳到任何地方。

### Typography Analyzer（字體排版分析）

輸入網址，或直接貼上 HTML 與 CSS。

- 盤點使用中的字體家族、字級、字重、行高與字距。
- 判斷每個字體是 Google Fonts、自架的 `@font-face`，還是系統字；也可以選擇預覽該字體 —— 只有你按下預覽時才會去載入字型檔。
- 分析字級是否遵循模數比例（modular scale）；若有就指出是哪一種比例，若沒有則給出一致性分數。
- 產生一組可以直接貼進樣式表的建議字階。
- 標出值得修的問題：內文小於 16px、行高過於擁擠、字級種類過度發散、載入太多網路字體、缺少 `<h1>`、標題層級跳號、缺少 viewport meta 標籤。

貼上原始碼的模式完全在瀏覽器內執行，任何網站都能分析 —— 包括那些擋住抓取的網站。

### Responsive Tester（響應式測試）

同時在手機、平板、桌機的框架中載入同一個頁面。

- 十二種裝置預設，加上自訂寬度，可切換直向／橫向。
- 讀取該網站**自己的 CSS media query**，直接在真正存在的斷點開框，而不是猜幾個整數寬度。
- 載入前先檢查 `X-Frame-Options` 與 CSP `frame-ancestors`；當網站不允許被嵌入時會明確告訴你原因，而不是讓你對著一片空白發呆。
- 頁面若缺少 viewport meta 標籤會提出警告，因為那種情況下框架呈現的結果不會等同真實手機。

每個框都是該 CSS 寬度下的真實 iframe，所以你看到的是網站自己的響應式行為。

### Site Planner（網站規劃大師）

依產業類型規劃網站架構，並直接看到結果。

- 內建十種產業範本：餐飲、電商、SaaS 軟體、企業形象、作品集、醫療診所、教育、房地產、非營利組織、活動展覽。選擇目標、規模（從單頁 landing 到大型網站）與需要的功能，網站地圖、每頁的區塊順序、導覽列與主要按鈕會即時更新。
- **線框圖**：每一頁都能產生桌機與手機寬度的灰階線框，輸出為純 SVG，可下載後在 Figma 開啟成可編輯圖形。
- **自動匹配案例**：依產業、功能與風格替參考網站打分排序，並列出每項得分理由。內建一組示範案例；接上**你自己的 Notion 資料庫**後就改用你整理的案例庫（[設定方式](#notion-案例庫設定)）。
- **串接你自己的 Claude**，兩種方式：透過 MCP 伺服器在 Claude Code／Claude Desktop 裡呼叫規劃工具（不需要 API key），或貼上你自己的 Anthropic API key 讓 Claude 審閱規劃。key 由你的瀏覽器直接送到 Anthropic，不會經過這個 app 的伺服器。
- 規劃可匯出成 Markdown 或 JSON。

規劃本身是規則式、可重現的：同樣的輸入永遠得到同樣的規劃，離線可用、不花錢；Claude 是疊在上面的選用功能。詳細說明見 [docs/SITE-PLANNER.md](docs/SITE-PLANNER.md)。

#### Notion 案例庫設定

1. 到 [notion.so/profile/integrations](https://www.notion.so/profile/integrations) 建立一個 internal integration（只需讀取權限），複製 token（`ntn_` 開頭）。
2. 建立一個資料庫，欄位如下（英文或中文欄位名稱都可以）：

   | 欄位 | 類型 | 可用名稱 |
   | --- | --- | --- |
   | 名稱 | Title | Name、Title、名稱、網站名稱、標題 |
   | 網址 | URL | URL、Link、Website、網址、連結 |
   | 產業 | Select | Industry、Category、產業、類型、產業類型 |
   | 風格 | Multi-select | Style、Styles、Tags、風格、風格標籤 |
   | 功能 | Multi-select | Features、功能 |
   | 截圖 | Files（選填） | Screenshot、Image、Cover、截圖、圖片 |
   | 備註 | Text（選填） | Notes、Description、備註、說明 |

   產業可以填 id（`saas`）、英文名（Real estate）或中文名（餐飲）；功能請用 `blog`、`booking`、`shop`、`membership`、`search`、`multilingual`、`newsletter`、`live-chat`。
3. 打開資料庫，右上角 ··· → Connections，加入剛剛的 integration。
4. 在 Site Planner 的 Cases → Notion 貼上 token 與資料庫連結。勾選「Remember in this browser」才會存在你的瀏覽器裡，伺服器端從不儲存。

MCP 使用者則在伺服器環境變數設定 `NOTION_TOKEN` 與 `NOTION_CASES_DATABASE_ID`，`match_cases` 就會改用你的 Notion 案例庫。

### 給 AI 代理用的 MCP 伺服器

同一套分析工具也以 [MCP 伺服器](mcp/README.md)的形式提供給 AI 編碼代理 ——
`extract_palette`、`check_contrast`、`analyze_typography`、`plan_site`、`generate_wireframe`、`match_cases` 等，透過 stdio
在本機執行，完全不需要瀏覽器。設定方式見 [mcp/README.md](mcp/README.md)。

---

## 快速開始

```bash
git clone https://github.com/Pinyi333/Open-source-Web-Design-Toolkit.git
cd Open-source-Web-Design-Toolkit
npm install
npm run dev
```

接著開啟 <http://localhost:3000>。需要 Node 20 以上。

| 指令                | 用途                     |
| ------------------- | ------------------------ |
| `npm run dev`       | 開發伺服器               |
| `npm run build`     | 正式版建置               |
| `npm start`         | 執行建置後的正式版       |
| `npm run lint`      | ESLint                   |
| `npm run typecheck` | `tsc --noEmit`           |
| `npm test`          | Vitest 測試              |

---

## 技術架構

- **[Next.js 16](https://nextjs.org)**（App Router）、**React 19**、**TypeScript**、**[Tailwind CSS 4](https://tailwindcss.com)**。
- 沒有 UI 元件庫、沒有 icon 套件、沒有 CSS parser 相依。執行期相依只有 Next、React、React DOM，就這三個。
- 所有分析邏輯都放在 `lib/`，是不依賴 DOM 的純函式 —— 這也是它們能被直接測試的原因。

```
app/            路由：首頁、每個工具一頁、兩支 API
components/     設計系統與共用 UI 元件
lib/
  color/        色彩轉換、WCAG 對比、median cut、調色盤匯出
  typography/   輕量 CSS 解析、長度換算、字階偵測
  responsive/   裝置預設與視窗尺寸計算
  net/          SSRF 防護與網站抓取
  planner/      產業範本、網站規劃、SVG 線框圖、案例匹配、Notion 讀取與選用的 Claude 審閱
  tools.ts      各頁面共用的工具註冊表
tests/          Vitest，涵蓋所有純邏輯
```

### 伺服器端端點

除了下方的 `POST /api/fetch-site`，Site Planner 另有 `POST /api/notion/cases`：因為 Notion API 不送 CORS 標頭，才需要這支窄窄的轉送端點。它只會呼叫 `api.notion.com`，資料庫 id 先被化簡成 32 個十六進位字元，使用者的 token 只用在那一次請求，不儲存也不寫進 log。

除了「抓取你輸入的網址」之外，所有運算都在瀏覽器完成 —— 而跨來源抓取是瀏覽器不允許網頁自己做的事。`POST /api/fetch-site` 由伺服器代勞，這也是整個專案唯一有實質攻擊面的地方，因此寫得相當保守：

- 只允許 http 與 https。
- 在 **DNS 解析之後**封鎖私有網段、loopback、link-local、CGNAT 與 multicast，IPv4 與 IPv6 皆然，包含 IPv4-mapped IPv6。一個解析到 `169.254.169.254` 的網域名稱會被擋下。
- 自行處理轉址，最多三跳，且**每一跳都重新檢查位址** —— 公開網址無法靠 302 溜進你的內網。
- 有時間上限（單次 8 秒、總計 12 秒）、位元組上限（HTML 2 MB、單一樣式表 1 MB、最多 10 個樣式表），以及 content-type 檢查。
- 以 IP 為單位的速率限制，但這只是盡力而為：它存在於行程記憶體中，橫向擴展的部署撐不住。若要公開部署，請在前面放一層真正的 rate limiter。

如果你自架後找到繞過上述任一項的方法，[SECURITY.md](SECURITY.md) 說明了回報方式。

### 公開部署時請關掉 URL 抓取

SSRF 防護擋得住這支端點連向**內網**，但擋不住它被當成通往**公開網路**的一般代理 —— 在任何人都連得到的部署上，陌生人可以花你的頻寬，也可能害你的部署 IP 被討厭這類流量的網站封鎖。

所以公開部署時請設定：

```
WDT_DISABLE_URL_FETCH=1
```

兩個工具都還是能用。Typography Analyzer 保留貼上模式，那條路徑用的是同一個分析器、完全在瀏覽器裡跑。Responsive Tester 的每個框都還在，因為 iframe 本來就是在訪客自己的瀏覽器裡載入、從沒經過伺服器 —— 只有「可嵌入性預檢」會失效。

這個開關是**每次請求時讀取**，不是建置時寫死，所以設定後不需要重新建置就會生效。預設是開啟的：在本機跑的時候，是你自己的機器幫你抓網頁，那正是這個工具的用途。

---

## 開發藍圖

還有六個工具在計畫中，詳見 [ROADMAP.md](ROADMAP.md)：

Screenshot Analyzer、Design Token Generator、CSS Generator、SVG Animation Generator、Lottie Playground、AI Design Analyzer

每一個都是自成一體的頁面，除了共用的設計系統之外不依賴其他工具，因此很適合當作第一次貢獻。[docs/ADDING-A-TOOL.md](docs/ADDING-A-TOOL.md) 會帶你走完新增一個工具的流程。

---

## 參與貢獻

歡迎貢獻 —— 請見 [CONTRIBUTING.md](CONTRIBUTING.md)。標記為 `good first issue` 的 issue 是不錯的起點，而從藍圖中挑一個工具實作出來是最有幫助的貢獻。

參與前請先閱讀[行為準則](CODE_OF_CONDUCT.md)。

## 授權

[MIT](LICENSE) © CHIANG, PIN-YI
