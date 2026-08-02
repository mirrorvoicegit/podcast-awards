import { test } from "node:test";
import assert from "node:assert/strict";
import { isRunDue } from "./schedule-gate.mjs";

test("no previous run: always due", () => {
  assert.equal(isRunDue({ previousGeneratedAt: null, now: new Date("2026-07-20T00:00:00Z"), intervalDays: 14 }), true);
});

test("less than interval elapsed: not due", () => {
  const previousGeneratedAt = "2026-07-10T00:00:00.000Z";
  const now = new Date("2026-07-20T00:00:00.000Z");
  assert.equal(isRunDue({ previousGeneratedAt, now, intervalDays: 14 }), false);
});

test("interval fully elapsed: due", () => {
  const previousGeneratedAt = "2026-07-06T00:00:00.000Z";
  const now = new Date("2026-07-20T00:00:00.000Z");
  assert.equal(isRunDue({ previousGeneratedAt, now, intervalDays: 14 }), true);
});

test("force overrides the interval even when not due", () => {
  const previousGeneratedAt = "2026-07-19T00:00:00.000Z";
  const now = new Date("2026-07-20T00:00:00.000Z");
  assert.equal(isRunDue({ previousGeneratedAt, now, intervalDays: 14, force: true }), true);
});
