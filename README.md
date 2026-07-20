# 華語 Podcast 獎項雷達

台灣與香港華語 Podcast、音訊及相關新聞獎項的公開查詢頁面。

## 本機預覽

這是無建置步驟的靜態網站。請用 HTTP server 開啟，避免瀏覽器阻擋 JSON 載入：

```bash
python3 -m http.server 4173
```

開啟 `http://localhost:4173`。

## 資料更新介面

前端只讀取 `data/awards.json`。後續爬蟲每次完成並通過人工審核後，只需更新這個檔案：

- `updatedAt`：ISO 日期
- `awards`：獎項陣列
- `status`：`open`、`upcoming`、`judging`、`completed`、`unannounced`
- `eligibility`：人工判讀的 Podcast 參賽資格

資格不明的獎項不得自動標成「明確可報」。
