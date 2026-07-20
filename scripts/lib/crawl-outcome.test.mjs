import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyCrawlResults } from "./crawl-outcome.mjs";

test("all sources succeed: no carry-over, allFailed is false", () => {
  const raw = [
    { sourceId: "a", status: "fetched", candidate: { name: "A" } },
    { sourceId: "b", status: "fetched", candidate: { name: "B" } }
  ];
  const outcome = classifyCrawlResults(raw, []);
  assert.equal(outcome.allFailed, false);
  assert.equal(outcome.succeededCount, 2);
  assert.equal(outcome.failedCount, 0);
  assert.deepEqual(outcome.results, raw);
});

test("partial failure: failed source keeps previous good candidate instead of being blanked", () => {
  const raw = [
    { sourceId: "a", status: "fetched", candidate: { name: "A（新）" } },
    { sourceId: "b", status: "fetch_failed", error: "HTTP 500" }
  ];
  const previousPrograms = [
    { sourceId: "a", status: "fetched", checkedAt: "t0", candidate: { name: "A（舊）" } },
    { sourceId: "b", status: "fetched", checkedAt: "t0", candidate: { name: "B（舊，仍應保留）" } }
  ];
  const outcome = classifyCrawlResults(raw, previousPrograms);
  assert.equal(outcome.allFailed, false);
  assert.equal(outcome.succeededCount, 1);
  assert.equal(outcome.failedCount, 1);
  const kept = outcome.results.find(item => item.sourceId === "b");
  assert.equal(kept.status, "fetch_failed_kept_previous");
  assert.deepEqual(kept.candidate, { name: "B（舊，仍應保留）" });
  const fresh = outcome.results.find(item => item.sourceId === "a");
  assert.deepEqual(fresh.candidate, { name: "A（新）" });
});

test("all sources fail: allFailed is true even when a previous good snapshot exists", () => {
  const raw = [
    { sourceId: "a", status: "fetch_failed", error: "timeout" },
    { sourceId: "b", status: "fetch_failed", error: "HTTP 500" }
  ];
  const previousPrograms = [
    { sourceId: "a", status: "fetched", checkedAt: "t0", candidate: { name: "A" } },
    { sourceId: "b", status: "fetched", checkedAt: "t0", candidate: { name: "B" } }
  ];
  const outcome = classifyCrawlResults(raw, previousPrograms);
  assert.equal(outcome.allFailed, true);
  assert.equal(outcome.succeededCount, 0);
  assert.equal(outcome.failedCount, 2);
});
