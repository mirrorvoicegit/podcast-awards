// Decides whether a periodic job is actually due, based on the real
// timestamp of its last completed run rather than the cron trigger cadence.
// This lets a workflow "check in" more often than the real interval
// (e.g. weekly) while still only doing work every `intervalDays`.
export function isRunDue({ previousGeneratedAt, now, intervalDays, force = false }) {
  if (force) return true;
  if (!previousGeneratedAt) return true;
  const elapsedMs = now.getTime() - new Date(previousGeneratedAt).getTime();
  return elapsedMs >= intervalDays * 86400000;
}
