const normalize = value => String(value ?? "").toLocaleLowerCase("zh-Hant");
const unique = values => [...new Set(values)];

export function recommendationRuleFor(data, awardId) {
  return (data.recommendationRules || []).find(rule => rule.awardId === awardId) || null;
}

export function evaluateProgram(data, awardId, program) {
  const rule = recommendationRuleFor(data, awardId);
  if (!rule || rule.manualOnly || program.crawlStatus !== "verified") return null;
  if (rule.allowedCategories?.length && !rule.allowedCategories.includes(program.category)) return null;

  const programText = normalize([program.name, program.category, ...(program.tags || []), program.summary].join(" "));
  const programMatches = unique((rule.programTerms || []).filter(term => programText.includes(normalize(term))));
  const episodes = (data.programEpisodes || [])
    .filter(episode => episode.programId === program.id)
    .sort((a,b) => b.publishedAt.localeCompare(a.publishedAt));
  const matchedEpisodes = episodes.map(episode => ({
    ...episode,
    matchedTerms:unique((rule.episodeTerms || []).filter(term => normalize(episode.title).includes(normalize(term))))
  })).filter(episode => episode.matchedTerms.length > 0);

  if (rule.requireEpisodeEvidence && matchedEpisodes.length === 0) return null;
  const categoryScore = rule.allowedCategories?.length ? 1 : 0;
  const score = Math.min(programMatches.length,3) * 2 + Math.min(matchedEpisodes.length,2) * 2 + categoryScore;
  if (score < (rule.minimumScore ?? 3)) return null;

  const fit = score >= (rule.highScore ?? 5) ? "高度相符" : "優先檢視";
  const evidence = [];
  if (programMatches.length) evidence.push(`節目定位符合「${programMatches.slice(0,3).join("、")}」`);
  if (matchedEpisodes.length) evidence.push(`找到 ${matchedEpisodes.length} 集具體題材線索`);
  return {
    awardId,
    program,
    fit,
    score,
    reason:`${evidence.join("；")}。`,
    matchedEpisodes
  };
}

export function buildRecommendations(data, awardId) {
  const rank = { "高度相符":2, "優先檢視":1 };
  return (data.mirrorPrograms || [])
    .map(program => evaluateProgram(data,awardId,program))
    .filter(Boolean)
    .sort((a,b) => rank[b.fit] - rank[a.fit] || b.score - a.score || a.program.name.localeCompare(b.program.name,"zh-Hant"));
}
