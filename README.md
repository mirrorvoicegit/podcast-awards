# 華語 Podcast 獎項曆

以截止日為核心的 Podcast 獎項處理工具。只要報名資訊已公開且尚未截止，就以醒目的橘色卡片放在「處理中」；截止隔天自動移進「歷史紀錄」。尚未公布完整報名時程的獎項保留在灰階的「持續監控中」。點擊卡片後才會展開右側詳細資料。

## 資料更新

前端只讀取 `data/awards.json`：

- `awards`：獎項系列主檔；資格不明者不可自動標為「明確可報」。
- `applications`：每屆徵件資訊，包含資訊是否公開、開放日與截止日；主頁狀態由截止日自動判定。
- `timeline`：排程節點。`date` 為 ISO 日期；沒有精確日期時可設為 `null`，並將 `phase` 設為 `monitor`。
- `phase`：`open`（徵件／截止）、`result`（入圍／得獎）、`monitor`（待公告／待確認）。
- `winners`：已由官方得獎公告與人工審核確認的節目。不得以搜尋結果或未驗證的網頁內容直接寫入。
- `mirrorPrograms`：固定監測的鏡好聽節目主檔。每月爬蟲產出的結果須先人工確認，不直接覆寫已核實欄位。
- `programRecommendations`：獎項與節目的可解釋比對結果。這是題材候選，不代表已符合參賽資格。

畫面會依使用者當下日期，自動把已過徵件截止日的該屆卡片移到「歷史紀錄」，仍可點開檢視。

## 鏡好聽節目監測

GitHub Actions 每月執行 `scripts/crawl-mirror-programs.mjs`，把 9 個指定節目的公開頁面資料寫入 `data/program-crawl-candidates.json`。這份候選資料只供人工比對，不會直接改動推薦結果，避免網站改版或解析錯誤污染正式資料。也可在 Actions 頁面手動執行「Monthly Mirror Voice program crawl」。

## 新獎項發現

除了固定獎項名單，GitHub Actions 每週執行 `scripts/discover-awards.mjs`，依 `data/discovery-config.json` 的關鍵字搜尋新公告。結果寫入 `data/award-discovery-candidates.json`，未知項目會顯示在頁面的「系統新發現」，但不會自動變成正式獎項。學生／校園獎及專案已排除的獎項會在候選階段先過濾。

主排程遵守「每個獎項每一屆只有一張徵件卡」：開始日、複選、入圍及頒獎不會產生第二張主卡；主卡只依初次徵件截止日排序與歸檔。
