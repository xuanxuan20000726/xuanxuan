# 米媗媗｜音樂、AI 與生活

靜態個人網站，包含首頁、履歷、文章列表與每篇文章的獨立閱讀頁。履歷提供適合 A4 的列印樣式，瀏覽器可另存 PDF。內容依專案角色設定撰寫，不推定學位取得、職業、成就或婚育狀態。

## 本機預覽

需要 Node.js 22 以上。在此目錄執行：

```sh
npm ci
npm run build
npm run check
npm test
npm run preview
```

開啟終端機顯示的網址。SITE_URL 決定正式網址與 GitHub Pages 子路徑；正式部署會從 GitHub Pages 設定自動取得。

## 新增與修改文章

1. 在 `content/` 新增或修改 Markdown 文章。
2. 將已完成的日系動畫圖片放入 `public/images/`。
3. 在 `content/articles.json` 登記英文網址 slug、標題、分類、日期、摘要、圖片檔名與替代文字；每篇新增含明確時區的 `publishAt`，例如 `2026-09-22T08:00:00+08:00`；畫面依刊登時間由新到舊排序。Markdown 檔名須為 slug 加上 `.md`。
4. 執行 `npm run build` 和 `npm run check`。
5. 將修改提交並推送到 `main`，GitHub Actions 會自動建立並部署網站。

每篇文章的插圖由清單統一渲染在閱讀頁頂部。Markdown 中獨立一行的舊圖片標記與社群 hashtag 行會在建置時移除，避免重複顯示；正文、粗體與來源連結保留。Markdown 的原始 HTML 停用。專案原始 `posts/` 草稿不會自動發布，選定版本需整理進這份網站內容清單。

## 自動發布

根目錄 `.github/workflows/pages.yml` 在 `main` 收到網站修改時執行：安裝鎖定依賴、建立靜態頁面、檢查所有內部連結與配圖、部署 GitHub Pages。也可在 Actions 手動啟動。Pages 的來源設定需為 GitHub Actions。

網站無需後端、資料庫或 API 金鑰。程式只打包 `public/` 與生成的頁面，不發布角色設定、原始草稿、圖片生成紀錄或私人登入資料。

## Instagram 自動排程服務

管理控制台會連接本機 `127.0.0.1:43170` 的排程服務。GitHub Pages 只顯示公開狀態；Meta 權杖保留在專案根目錄的 `.env.ig`，該檔案已被 Git 排除，不會部署到網站。

首次設定：

```sh
cp .env.ig.example .env.ig
# 編輯 .env.ig，填入 Meta App Secret；IG_USER_ID 與 IG_ACCESS_TOKEN 會在 Instagram Login 完成後自動寫入
cd website
npm run ig:install
```

安裝後，macOS 登入時會自動啟動排程服務。本機控制台位於 `http://127.0.0.1:43170/xuanxuan/admin/`。請在 Meta App 的 Instagram Login 設定加入 `https://xuanxuan20000726.github.io/xuanxuan/oauth/instagram/callback`，再從控制台點「開始 Instagram 授權」。完成後服務會自動保存長效權杖與 IG 使用者 ID；之後影片會透過 Instagram Content Publishing API 排程發布。

也可以從終端機操作：

```sh
npm run ig:server
npm run ig:schedule -- volt-gen2
npm run ig:run
```

排程與執行紀錄保存在 `work/instagram-scheduler/`。發布電腦必須保持開機並能連上網路；若到期時離線，服務恢復後會補跑仍為 `scheduled` 的工作。

## 預排與文章瀏覽

首頁顯示最近 6 篇，文章列表提供關鍵字、主題、日期篩選，每頁 12 篇。所有篩選選項、筆數、搜尋結果與延伸閱讀，均先排除尚未刊登的文章。

瀏覽器讀取使用者裝置的系統時間，和 `publishAt` 的絕對時間比較；這批文章按 Asia/Taipei 每天 08:00、10:00、12:00、14:00、17:00、20:00 刊登。時區不同的讀者會在同一瞬間看到內容。停留頁面時會在下一個刊登時間重新檢查，另每 30 秒與視窗重新取得焦點時檢查，直接文章網址也有相同限制。舊文章只提供日期時，以當日台灣時間 00:00 計。

此為靜態網站的顯示排程，不是伺服器保密機制。裝置時間錯誤會影響顯示；預排資料和圖片已包含在靜態檔案中，知道資源網址的人仍可取得。若將來需要未發布內容不可被下載，需改成伺服器控制或到期才部署。關閉 JavaScript 時不會直接顯示預排文章。

站點地圖只包含建置當下已刊登的文章；新文章到時仍會在前台顯示，但要再次建置才能加入 sitemap。所有稿件原始檔與本地審稿頁不在 website/public，部署不會帶上審稿頁。

本批稿件資料整理於 2026/09/21，預排日期不代表未來新聞已發生，也不等於已在 Facebook 排程。各篇保留來源與實際新聞／研究日期。
