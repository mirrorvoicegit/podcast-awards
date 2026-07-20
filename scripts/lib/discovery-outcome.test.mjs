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
    { status: "fulfilled", value: [{ title: "獎項 A", link: "https://a", matchedQuery: "q1", publishedAt: "2026-01-01" }] },
    { status: "rejected", reason: new Error("RSS timeout") }
  ];
  const outcome = classifyQueryResults(settled, ["q1", "q2"]);
  assert.equal(outcome.allFailed, false);
  assert.equal(outcome.succeededCount, 1);
  assert.equal(outcome.failedQueries.length, 1);
  assert.equal(outcome.failedQueries[0].query, "q2");

  const previousCandidates = [
    { title: "獎項 B（僅 q2 查得到）", link: "https://b", matchedQuery: "q2", publishedAt: "2025-12-01" },
    { title: "獎項 C（僅 q1 查得到，q1 這次已重新抓到，不需保留）", link: "https://c", matchedQuery: "q1", publishedAt: "2025-11-01" }
  ];
  const merged = mergeCandidates({
    found: outcome.found,
    previousCandidates,
    failedQueries: outcome.failedQueries,
    excludedTitleTerms: [],
    normalize
  });
  const titles = merged.map(item => item.title);
  assert.ok(titles.includes("獎項 A"), "fresh result from the succeeding query is kept");
  assert.ok(titles.includes("獎項 B（僅 q2 查得到）"), "candidate only known via the failed query is carried over");
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
