import { readFile, writeFile, appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { classifyQueryResults, mergeCandidates } from "./lib/discovery-outcome.mjs";
import { hasSubstantiveChange } from "./lib/data-diff.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async file => JSON.parse(await readFile(path.join(root, file), "utf8"));
const config = await readJson("data/discovery-config.json");
const awards = (await readJson("data/awards.json")).awards;
let previous = null;
try { previous = await readJson("data/award-discovery-candidates.json"); } catch (_) {}
const previousCandidates = previous?.candidates || [];

const decodeXml = value => String(value || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const clean = value => decodeXml(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const normalize = value => clean(value).toLocaleLowerCase("zh-Hant").replace(/第\d+屆/g, "").replace(/先生/g, "").replace(/[^\p{L}\p{N}]/gu, "");
const element = (xml, name) => clean(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1]);
const previousByTitle = new Map(previousCandidates.map(item => [normalize(item.title), item]));
const knownNames = awards.flatMap(award => [award.name, ...(award.aliases || [])]).map(normalize).filter(name => name.length >= 4);

function isKnown(title) {
  const value = normalize(title);
  return knownNames.some(name => value.includes(name) || name.includes(value));
}

async function search(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
  const response = await fetch(url, { headers:{ "user-agent":"MirrorVoice-Award-Discovery/1.0" }, signal:AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Google News RSS HTTP ${response.status}`);
  const xml = await response.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(match => {
    const item = match[1];
    const title = element(item, "title");
    const prior = previousByTitle.get(normalize(title));
    const pubDate = element(item, "pubDate");
    return {
      id:`discovery-${Buffer.from(normalize(title)).toString("base64url").slice(0,18)}`,
      title,
      link:element(item, "link"),
      publishedAt:pubDate ? new Date(pubDate).toISOString().slice(0,10) : null,
      matchedQuery:query,
      status:prior?.status || (isKnown(title) ? "known_award" : "review_needed"),
      note:prior?.note || null
    };
  });
}

const settled = await Promise.allSettled(config.queries.map(search));
const outcome = classifyQueryResults(settled, config.queries);

const summaryLines = [
  "## 獎項巡檢結果",
  `- 查詢關鍵字總數：${outcome.totalSources}`,
  `- 成功：${outcome.succeededCount}`,
  `- 失敗：${outcome.failedQueries.length}`
];
if (outcome.failedQueries.length) {
  summaryLines.push("", "### 失敗查詢");
  for (const item of outcome.failedQueries) summaryLines.push(`- ${item.query}：${item.error}`);
}
console.log(summaryLines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summaryLines.join("\n")}\n`);

if (outcome.allFailed) {
  console.error("所有查詢均失敗，保留原檔，不寫入、不建立 commit。");
  process.exitCode = 1;
} else {
  const candidates = mergeCandidates({
    found:outcome.found,
    previousCandidates,
    failedQueries:outcome.failedQueries,
    excludedTitleTerms:config.excludedTitleTerms,
    normalize
  });
  const output = { generatedAt:new Date().toISOString(), reviewRequired:true, errors:outcome.failedQueries, candidates };
  if (!previous || hasSubstantiveChange(previous, output)) {
    await writeFile(path.join(root,"data","award-discovery-candidates.json"), `${JSON.stringify(output, null, 2)}\n`);
    console.log("資料有實質變化，已更新輸出檔。");
  } else {
    console.log("僅執行時間不同，資料無實質變化，保留原檔，不寫入。");
  }
}
