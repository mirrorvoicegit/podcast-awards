import { test } from "node:test";
import assert from "node:assert/strict";
import { hasSubstantiveChange } from "./data-diff.mjs";

test("timestamp-only difference is not a substantive change", () => {
  const previous = {
    generatedAt: "2026-01-01T00:00:00.000Z",
    programs: [{ sourceId: "a", checkedAt: "2026-01-01T00:00:00.000Z", status: "fetched", candidate: { name: "節目 A" } }]
  };
  const next = {
    generatedAt: "2026-02-01T00:00:00.000Z",
    programs: [{ sourceId: "a", checkedAt: "2026-02-01T00:00:00.000Z", status: "fetched", candidate: { name: "節目 A" } }]
  };
  assert.equal(hasSubstantiveChange(previous, next), false);
});

test("candidate data difference is a substantive change", () => {
  const previous = {
    generatedAt: "2026-01-01T00:00:00.000Z",
    programs: [{ sourceId: "a", checkedAt: "2026-01-01T00:00:00.000Z", status: "fetched", candidate: { name: "節目 A" } }]
  };
  const next = {
    generatedAt: "2026-02-01T00:00:00.000Z",
    programs: [{ sourceId: "a", checkedAt: "2026-02-01T00:00:00.000Z", status: "fetched", candidate: { name: "節目 A（改版）" } }]
  };
  assert.equal(hasSubstantiveChange(previous, next), true);
});

test("status change from failed to fetched is a substantive change", () => {
  const previous = { generatedAt: "t1", programs: [{ sourceId: "a", checkedAt: "t1", status: "fetch_failed" }] };
  const next = { generatedAt: "t2", programs: [{ sourceId: "a", checkedAt: "t2", status: "fetched" }] };
  assert.equal(hasSubstantiveChange(previous, next), true);
});
