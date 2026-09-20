# 紀依媗｜音樂、AI 與生活

靜態個人網站，包含首頁、履歷、文章列表與每篇文章的獨立閱讀頁。履歷提供適合 A4 的列印樣式，瀏覽器可另存 PDF。內容依專案角色設定撰寫，不推定學位取得、職業、成就或婚育狀態。

## 本機預覽

需要 Node.js 22 以上。在此目錄執行：

```sh
npm ci
npm run build
npm run check
npm run preview
```

開啟終端機顯示的網址。SITE_URL 決定正式網址與 GitHub Pages 子路徑；正式部署會從 GitHub Pages 設定自動取得。

## 新增與修改文章

1. 在 `content/` 新增或修改 Markdown 文章。
2. 將已完成的日系動畫圖片放入 `public/images/`。
3. 在 `content/articles.json` 登記英文網址 slug、標題、分類、日期、摘要、圖片檔名與替代文字；清單順序就是顯示順序。Markdown 檔名須為 slug 加上 `.md`。
4. 執行 `npm run build` 和 `npm run check`。
5. 將修改提交並推送到 `main`，GitHub Actions 會自動建立並部署網站。

每篇文章的插圖由清單統一渲染在閱讀頁頂部。Markdown 中獨立一行的舊圖片標記與社群 hashtag 行會在建置時移除，避免重複顯示；正文、粗體與來源連結保留。Markdown 的原始 HTML 停用。專案原始 `posts/` 草稿不會自動發布，選定版本需整理進這份網站內容清單。

## 自動發布

根目錄 `.github/workflows/pages.yml` 在 `main` 收到網站修改時執行：安裝鎖定依賴、建立靜態頁面、檢查所有內部連結與配圖、部署 GitHub Pages。也可在 Actions 手動啟動。Pages 的來源設定需為 GitHub Actions。

網站無需後端、資料庫或 API 金鑰。程式只打包 `public/` 與生成的頁面，不發布角色設定、原始草稿、圖片生成紀錄或私人登入資料。
