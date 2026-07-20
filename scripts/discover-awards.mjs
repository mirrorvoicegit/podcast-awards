import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async file => JSON.parse(await readFile(path.join(root, file), "utf8"));
const config = await readJson("data/discovery-config.json");
const awards = (await readJson("data/awards.json")).awards;
let previous = { candidates:[] };
try { previous = await readJson("data/award-discovery-candidates.json"); } catch (_) {}

const decodeXml = value => String(value || "")
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const clean = value => decodeXml(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const normalize = value => clean(value).toLocaleLowerCase("zh-Hant").replace(/第\d+屆/g, "").replace(/先生/g, "").replace(/[^\p{L}\p{N}]/gu, "");
const element = (xml, name) => clean(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1]);
const previousByTitle = new Map((previous.candidates || []).map(item => [normalize(item.title), item]));
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
const errors = settled.flatMap((result,index) => result.status === "rejected" ? [{ query:config.queries[index], error:String(result.reason?.message || result.reason) }] : []);
const found = settled.flatMap(result => result.status === "fulfilled" ? result.value : []);
const excluded = title => config.excludedTitleTerms.some(term => title.toLocaleLowerCase("zh-Hant").includes(term.toLocaleLowerCase("zh-Hant")));
const unique = new Map();
for (const item of found) {
  if (!item.title || !item.link || excluded(item.title)) continue;
  const key = normalize(item.title);
  if (!unique.has(key)) unique.set(key,item);
}

const candidates = [...unique.values()]
  .sort((a,b) => (b.publishedAt || "").localeCompare(a.publishedAt || ""))
  .slice(0,80);
await writeFile(path.join(root,"data","award-discovery-candidates.json"), `${JSON.stringify({ generatedAt:new Date().toISOString(), reviewRequired:true, errors, candidates }, null, 2)}\n`);
console.log(`Discovered ${candidates.length} candidates; ${candidates.filter(item => item.status === "review_needed").length} need review.`);
