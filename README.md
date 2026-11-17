# Podcast 報獎雷達（Beta）

以官方徵件資訊與截止日期為核心的 Podcast／聲音相關獎項追蹤工具。

公開頁面：https://mirrorvoicegit.github.io/podcast-awards/

## 現在可以做什麼

- **正式獎項清單**（`index.html`）：依徵件截止日排列；截止後自動移入歷史紀錄。只將依當屆官方來源查證的 `data/awards.json` 視為正式資料。
- **資料新鮮度提醒**：首頁明確顯示 `data/awards.json` 的 `updatedAt`，超過 45 天未查證就提醒資料可能不完整。爬蟲執行日期不可取代正式資料更新日期。
- **候選資訊核對**：自動搜尋到的新聞僅供維護者／AI 查找獎項線索。一般使用者不需要處理候選資料；公開網站已移除人工審核入口。由已啟用的每週 AI 獎項官方查核排程對照當屆官方公告後，才能新增正式資料；如遇無法存取或證據不足就保留待確認，絕不自行推測。排程本身不保證每次都能成功更新 GitHub。
- **獎項日曆**（`awards.ics`）：只從已核對且有本屆公告來源的 `applications` 產生開始與截止日期，絕不根據上一屆日期推測本屆日期。
- **Email 通知預覽**：每週一台灣時間上午九點由 GitHub Actions 產生摘要，已核實新徵件（須有 `verifiedAt`）及 28／14／7 天內的截止提醒才會符合通知條件，並保留已寄送識別碼以避免重複提醒。

**不需要使用者人工審核候選新聞。** AI 定期查證可以減少人工工作，但無法保證每個官網都能讀取、每次查證都正確；無法證實時維持待確認，不能拿自動搜尋日期冒充官方核實日期。

**節目推薦功能已停用。** 網站不再維護特定節目清單、節目爬蟲、節目與單集推薦。

## 資料來源與官方查證（無須使用者人工審核）

1. `scripts/discover-awards.mjs` 每週搜尋 Google News RSS，將候選資訊寫到 `data/award-discovery-candidates.json`。
2. 候選新聞**不會直接寫入**正式獎項主檔。每週一上午九點的 ChatGPT「Podcast 獎項官方查核」任務會嘗試查詢當屆主辦單位官方公告、比對日期與參賽資格，再使用 GitHub 更新已證實的本屆資料；若工具無法存取網站或 GitHub，則不會假稱已更新。
3. 若已有審核結果 JSON，維護者可在專案根目錄執行（這是維護用途，**不是一般使用者必須做的事**）：
   ```bash
   node scripts/apply-review-decisions.mjs /path/to/報獎雷達_候選審核結果.json
   ```
   這只會更新候選分類與 `data/discovery-reviews.json`，**不會**把「值得查證」當成「已確認徵件」。
4. AI 經當屆官方公告查證後，才可修改 `data/awards.json` 的獎項、`applications`、`sourceUrl`、`openDate`、`deadline`，並依實際查證日期填寫 `verifiedAt`；若完成完整巡檢才更新 `updatedAt`。日期使用 `YYYY-MM-DD`，沒有官方日期就不要推測。
5. `data/discovery-reviews.json` 保存人工候選分類；爬蟲下一次執行時會保留這些決定，避免重新把已排除的無關新聞標記為待審。

### 日曆訂閱

日曆公開網址：

```
https://mirrorvoicegit.github.io/podcast-awards/awards.ics
```

使用 Google 日曆電腦版左側「其他日曆」旁的 ＋ →「從網址新增」，貼入網址。**訂閱**會隨日曆網址更新；直接下載 `.ics` 再匯入則是一次性動作，不會跟著更新。訂閱同步時間由 Google 日曆決定。

日曆可用以下指令重建：

```bash
node scripts/build-calendar.mjs
```

## Email 通知（預設關閉）

GitHub Actions 工作流程：`.github/workflows/awards-calendar-and-notify.yml`。

**目前沒有任何寄件者、收件者或寄信金鑰設定，不能宣稱已啟用實際通知。**

若日後確定要開啟寄信，先由管理者建立並驗證 Resend 寄件網域，將下列值設在 GitHub Repository 的 Actions 設定，絕對不要寫進公開的程式碼：

- **Variable**：`AWARDS_NOTIFY_ENABLED`＝`true`
- **Secret**：`AWARDS_RESEND_API_KEY`＝寄信服務 API 金鑰
- **Secret**：`AWARDS_NOTIFY_FROM`＝已驗證的寄件地址
- **Secret**：`AWARDS_NOTIFY_TO`＝收件者地址（多個以逗號隔開）

在開啟寄信前，應先用 GitHub Actions 的 `workflow_dispatch` 並保持 `preview_only=true` 核對摘要。實際寄送會使用 API 冪等識別碼及 `data/notification-state.json` 的已通知識別碼避免重複寄送，但寄送 API 成功不代表收件人郵箱已完成投遞。

**資料保護**：若正式資料 `updatedAt` 超過 45 天未核對，通知腳本會自動阻止寄送。候選新聞、待查證及已結束徵件不會因為單純搜尋到就變成寄送內容。未啟用通知時，排程只會產出預覽並更新獎項日曆。

測試：

```bash
node --test scripts/lib/notification-digest.test.mjs
```

## 維護與署名

- 此專案為公開 GitHub Pages 網站，不應將任何 API Key、私人資料或未授權內容寫入 repo。
- 候選核實由維護者／AI 負責，不要求一般使用者手動分類新聞。
- 報獎雷達首頁和通知不再推薦任何特定鏡好聽節目。
- 工具製作與維護：**Ryuushouin Touga**
- 聯絡信箱：**fywgogowild@gmail.com**
