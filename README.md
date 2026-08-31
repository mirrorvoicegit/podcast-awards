# Podcast 報獎雷達

以截止日為核心的 Podcast 獎項處理工具。只要報名資訊已公開且尚未截止，就放在「處理中」；截止隔天自動移進「歷史紀錄」。尚未公布完整報名時程的獎項保留在「持續監控中」。點擊卡片後才會展開右側詳細資料。

## 資料更新

前端只讀取 `data/awards.json`：

- `awards`：獎項系列主檔；資格不明者不可自動標為「明確可報」。
- `applications`：每屆徵件資訊，包含資訊是否公開、開放日、截止日，以及直接指向該屆徵件公告／規則的 `sourceUrl`；主頁狀態由截止日自動判定。
- `entryFee` 與 `entryFeeUrl` 只在官方已明確公布費用時填寫與顯示；沒有確定金額時整列省略，不推測免費，也不顯示待確認文字。
- `timeline`：排程節點。`date` 為 ISO 日期；沒有精確日期時可設為 `null`，並將 `phase` 設為 `monitor`。
- `phase`：`open`（徵件／截止）、`result`（入圍／得獎）、`monitor`（待公告／待確認）。
- `mirrorPrograms`：固定監測的鏡好聽節目主檔。每兩週爬蟲產出的結果須先人工確認，不直接覆寫已核實欄位。
- `recommendationRules`：每個獎項的通用推薦門檻，包含允許的節目類型、節目主題詞、單集題材詞與最低分數。系統會將所有已核實節目套用同一套規則，不設定特定節目黑名單。
- `recommendation-engine.js`：依獎項門檻、節目類型、主題重合與具體單集線索即時計分。只輸出「高度相符」及「優先檢視」；未達門檻時留白，不為了填滿清單而推薦。

畫面會依使用者當下日期，自動把已過徵件截止日的該屆卡片移到「歷史紀錄」，仍可點開檢視。`eligibility`、`eligibilityNote` 與 `reviewNote` 僅供推薦引擎及人工維護資料使用，不顯示在側欄。

「持續監控中」會自動從最近一屆 `applications` 推算徵件月份；若沒有屆次資料，則以 `timeline` 最近一次開始徵件日期作為參考，並明示仍以本屆公告為準。

## 鏡好聽節目監測

GitHub Actions 排程是每週檢查一次，但 `scripts/crawl-mirror-programs.mjs` 會比對上次真正執行（`program-crawl-candidates.json` 的 `generatedAt`）是否已滿 14 天，未滿就直接略過、不發送任何網路請求，確保實際爬取頻率是真正的兩週一次，而不是被 cron 語法概略湊出來的天數。也可在 Actions 頁面手動執行「Biweekly Mirror Voice program crawl」，勾選 `force` 可略過兩週間隔限制立即執行。

爬到的結果寫入 `data/program-crawl-candidates.json`，只供人工比對，不會直接改動推薦結果，避免網站改版或解析錯誤污染正式資料。首頁「最後整理」顯示的就是這份檔案的 `generatedAt`（爬蟲真正跑過的日期），不是 `data/awards.json` 的人工維護日期；若爬蟲從未成功執行過，才會退回顯示 `data/awards.json` 的 `updatedAt`。

側欄的「推薦集數舉例」由推薦引擎從已人工核對的 `programEpisodes` 中，依該獎項的單集題材詞自動挑選。單集只作為選件例子，不代表已確認符合參賽期間；每次爬蟲抓到的新單集仍須人工確認後才能加入正式資料。

主排程遵守「每個獎項每一屆只有一張徵件卡」：開始日、複選、入圍及頒獎不會產生第二張主卡；主卡只依初次徵件截止日排序與歸檔。

## 新獎項巡檢

固定名單只會越來越跟不上新獎項出現的速度，所以另外用 GitHub Actions 每週執行 `scripts/discover-awards.mjs`，依 `data/discovery-config.json` 的關鍵字查詢 Google News RSS。這個功能曾經因為抓到大量無關內容（例如一般文學獎、企業 ESG 獎）被整個移除過一次，這次重新加入時做了兩個關鍵調整：

- `requireAnyTitleTerms`：標題必須實際包含「Podcast」或「播客」才會保留，這是硬性正面篩選，比起無止盡地列黑名單更能應付未來持續冒出的新獎項類型。
- `excludedTitleTerms` 額外排除「得獎／獲獎／優選／入圍／得主／頒獎／出爐／公布結果／揭曉」等結果類字眼，避免把「某節目得了 OO 獎」這種得獎新聞誤當成新獎項候選——這類內容本來就不該進資料庫，本站已經不追蹤得獎節目。

候選結果只寫入 `data/award-discovery-candidates.json`，**不會顯示在網站上**，`status` 為 `review_needed` 的項目一律要人工看過、確認是台灣／香港的華語 Podcast 相關獎項後，才手動整理進 `data/awards.json`；`status` 為 `known_award` 代表標題比對到既有獎項名稱，通常是該獎項的既有報導或得獎消息，不需要當成新候選處理。也可在 Actions 頁面手動執行「Weekly award discovery scan」。
