import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyQueryResults, mergeCandidates } from "./discovery-outcome.mjs";

const normalize = value => String(value).toLocaleLowerCase("zh-Hant").replace(/\s+/g, "");

test("all queries succeed: no failures, allFailed is false", () => {
  const settled = [
    { status: "fulfilled", value: [{ title: "獎項 A", link: "https://a" }] },
    { status: "fulfilled", value: [{ title: "獎項 B", link: "https://b" }] }
  ];
  const outcome = classifyQueryResults(settled, ["q1", "q2"]);
  assert.equal(outcome.allFailed, false);
  assert.equal(outcome.succeededCount, 2);
  assert.equal(outcome.failedQueries.length, 0);
});

test("partial query failure: carries over previous candidates only from the failed query", () => {
  const settled = [
    { status: "fulfilled", value: [{ title: "Podcast 獎項 A", link: "https://a", matchedQuery: "q1", publishedAt: "2026-01-01" }] },
    { status: "rejected", reason: new Error("RSS timeout") }
  ];
  const outcome = classifyQueryResults(settled, ["q1", "q2"]);
  assert.equal(outcome.allFailed, false);
  assert.equal(outcome.succeededCount, 1);
  assert.equal(outcome.failedQueries.length, 1);
  assert.equal(outcome.failedQueries[0].query, "q2");

  const previousCandidates = [
    { title: "Podcast 獎項 B（僅 q2 查得到）", link: "https://b", matchedQuery: "q2", publishedAt: "2025-12-01" },
    { title: "Podcast 獎項 C（僅 q1 查得到，q1 這次已重新抓到，不需保留）", link: "https://c", matchedQuery: "q1", publishedAt: "2025-11-01" }
  ];
  const merged = mergeCandidates({
    found: outcome.found,
    previousCandidates,
    failedQueries: outcome.failedQueries,
    excludedTitleTerms: [],
    normalize
  });
  const titles = merged.map(item => item.title);
  assert.ok(titles.includes("Podcast 獎項 A"), "fresh result from the succeeding query is kept");
  assert.ok(titles.includes("Podcast 獎項 B（僅 q2 查得到）"), "candidate only known via the failed query is carried over");
});

test("all queries fail: allFailed is true", () => {
  const settled = [
    { status: "rejected", reason: new Error("timeout") },
    { status: "rejected", reason: new Error("HTTP 500") }
  ];
  const outcome = classifyQueryResults(settled, ["q1", "q2"]);
  assert.equal(outcome.allFailed, true);
  assert.equal(outcome.succeededCount, 0);
  assert.equal(outcome.failedQueries.length, 2);
});

test("requireAnyTitleTerms drops the real-world noise seen before the feature was removed", () => {
  const found = [
    { title: "2027書展大獎及金蝶獎徵件起跑 歡迎台灣原創作品踴躍報名！ - TiBE 台北國際書展", link: "https://a", matchedQuery: "q1", publishedAt: "2026-07-20" },
    { title: "第三屆亞洲藝術新秀獎·正式啟動徵件- 比賽 - 獎金獵人", link: "https://b", matchedQuery: "q1", publishedAt: "2026-06-18" },
    { title: "2026台灣AI影響力大獎｜IT Matters Awards｜6/2-7/31 公開徵件中", link: "https://c", matchedQuery: "q1", publishedAt: "2026-06-02" },
    { title: "Podcast YeAr 優質聲音節目競賽 徵件開跑", link: "https://d", matchedQuery: "q1", publishedAt: "2026-08-01" }
  ];
  const merged = mergeCandidates({
    found,
    previousCandidates: [],
    failedQueries: [],
    excludedTitleTerms: [],
    requireAnyTitleTerms: ["podcast", "播客"],
    normalize
  });
  const titles = merged.map(item => item.title);
  assert.equal(titles.length, 1);
  assert.ok(titles.includes("Podcast YeAr 優質聲音節目競賽 徵件開跑"), "only the title that actually mentions Podcast survives");
});

test("excludedTitleTerms drops winner/result announcements even when the title mentions Podcast", () => {
  const found = [
    { title: "查核中心獲銀響力新聞獎優選 Podcast翻轉高齡數位偏見 - 台灣事實查核中心", link: "https://a", matchedQuery: "q1", publishedAt: "2026-07-20" },
    { title: "第25屆卓越新聞獎 Podcast 類初選開放報名", link: "https://b", matchedQuery: "q1", publishedAt: "2026-07-20" }
  ];
  const merged = mergeCandidates({
    found,
    previousCandidates: [],
    failedQueries: [],
    excludedTitleTerms: ["得獎", "獲獎", "優選"],
    requireAnyTitleTerms: ["podcast", "播客"],
    normalize
  });
  const titles = merged.map(item => item.title);
  assert.equal(titles.length, 1);
  assert.ok(titles.includes("第25屆卓越新聞獎 Podcast 類初選開放報名"));
});
