// Classifies one crawl run's per-source results against the previous run's
// output. A source that fails this run keeps its last known-good candidate
// instead of being blanked out, so a transient fetch failure never destroys
// a more complete prior snapshot for that source.
export function classifyCrawlResults(rawResults, previousPrograms = []) {
  const previousBySourceId = new Map(previousPrograms.map(item => [item.sourceId, item]));
  const succeeded = rawResults.filter(item => item.status !== "fetch_failed");
  const failed = rawResults.filter(item => item.status === "fetch_failed");

  const results = rawResults.map(item => {
    if (item.status !== "fetch_failed") return item;
    const prior = previousBySourceId.get(item.sourceId);
    if (prior && prior.status !== "fetch_failed") {
      return {
        ...item,
        status: "fetch_failed_kept_previous",
        candidate: prior.candidate,
        previousCheckedAt: prior.checkedAt
      };
    }
    return item;
  });

  return {
    results,
    totalSources: rawResults.length,
    succeededCount: succeeded.length,
    failedCount: failed.length,
    failed,
    allFailed: rawResults.length > 0 && succeeded.length === 0
  };
}
