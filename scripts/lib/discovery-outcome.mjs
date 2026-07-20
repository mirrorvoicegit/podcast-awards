// Classifies one discovery run's per-query results (each keyword query
// against Google News RSS counts as one "source").
export function classifyQueryResults(settled, queries) {
  const failedQueries = settled.flatMap((result, index) => result.status === "rejected"
    ? [{ query: queries[index], error: String(result.reason?.message || result.reason) }]
    : []);
  const found = settled.flatMap(result => result.status === "fulfilled" ? result.value : []);
  const succeededCount = queries.length - failedQueries.length;

  return {
    failedQueries,
    found,
    totalSources: queries.length,
    succeededCount,
    allFailed: queries.length > 0 && succeededCount === 0
  };
}

// Merges freshly found candidates with candidates carried over from the
// previous run for any query that failed this run, so a failing query never
// drops candidates that were only ever discovered through it.
export function mergeCandidates({ found, previousCandidates = [], failedQueries, excludedTitleTerms, normalize }) {
  const failedQuerySet = new Set(failedQueries.map(item => item.query));
  const carriedOver = previousCandidates.filter(item => failedQuerySet.has(item.matchedQuery));
  const excluded = title => excludedTitleTerms.some(term => title.toLocaleLowerCase("zh-Hant").includes(term.toLocaleLowerCase("zh-Hant")));

  const unique = new Map();
  for (const item of [...found, ...carriedOver]) {
    if (!item.title || !item.link || excluded(item.title)) continue;
    const key = normalize(item.title);
    if (!unique.has(key)) unique.set(key, item);
  }

  return [...unique.values()]
    .sort((a, b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))
    .slice(0, 80);
}
