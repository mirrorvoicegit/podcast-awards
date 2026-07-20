import { readFile, writeFile, appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { classifyCrawlResults } from "./lib/crawl-outcome.mjs";
import { hasSubstantiveChange } from "./lib/data-diff.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "data", "awards.json");
const outputPath = path.join(root, "data", "program-crawl-candidates.json");
const data = JSON.parse(await readFile(dataPath, "utf8"));

let previous = null;
try { previous = JSON.parse(await readFile(outputPath, "utf8")); } catch (_) {}

const decodeHtml = value => String(value || "")
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const clean = value => decodeHtml(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const attr = (html, property) => {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${property}["']`, "i")
  ];
  return clean(patterns.map(pattern => html.match(pattern)?.[1]).find(Boolean));
};
const pageTitle = html => clean(attr(html, "og:title") || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])
  .replace(/\s*[｜|]\s*鏡好聽.*$/i, "").trim();
const extractEpisodes = (html, sourceId) => {
  const pattern = new RegExp(`<a[^>]+href=["'](/podcasts/${sourceId}/\\d+/?)['"][^>]*>([\\s\\S]*?)<\\/a>`, "gi");
  const episodes = []; const seen = new Set();
  for (const match of html.matchAll(pattern)) {
    const title = clean(match[2]); const relativeUrl = match[1].replace(/\/$/, "");
    if (title.length < 6 || title.length > 180 || seen.has(relativeUrl) || /看全部|開始播放|試聽/.test(title)) continue;
    seen.add(relativeUrl); episodes.push({ title, url:`https://www.mirrorvoice.com.tw${relativeUrl}` });
  }
  return episodes.slice(0,20);
};

async function crawl(program) {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(program.url, {
      headers:{ "user-agent":"MirrorVoice-Podcast-Awards-Monitor/1.0" },
      signal:AbortSignal.timeout(20000)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const text = clean(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " "));
    const updated = text.match(/更新(?:日期|時間)?\s*[：:]?\s*(20\d{2}[./-]\d{1,2}[./-]\d{1,2})/)?.[1]?.replace(/[./]/g, "-") || null;
    const title = pageTitle(html);
    return {
      sourceId:program.sourceId,
      url:program.url,
      status:title ? "fetched" : "needs_review",
      checkedAt,
      httpStatus:response.status,
      candidate:{
        name:title || null,
        description:attr(html, "og:description") || attr(html, "description") || null,
        image:attr(html, "og:image") || null,
        updatedAt:updated,
        episodes:extractEpisodes(html,program.sourceId)
      }
    };
  } catch (error) {
    return { sourceId:program.sourceId, url:program.url, status:"fetch_failed", checkedAt, error:String(error.message || error) };
  }
}

const rawResults = await Promise.all((data.mirrorPrograms || []).map(crawl));
const outcome = classifyCrawlResults(rawResults, previous?.programs || []);
const output = { generatedAt:new Date().toISOString(), reviewRequired:true, programs:outcome.results };

const summaryLines = [
  "## Mirror Voice 節目爬蟲結果",
  `- 來源總數：${outcome.totalSources}`,
  `- 成功：${outcome.succeededCount}`,
  `- 失敗：${outcome.failedCount}`
];
if (outcome.failed.length) {
  summaryLines.push("", "### 失敗來源");
  for (const item of outcome.failed) summaryLines.push(`- ${item.sourceId}（${item.url}）：${item.error}`);
}
console.log(summaryLines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${summaryLines.join("\n")}\n`);

if (outcome.allFailed) {
  console.error("所有節目來源均抓取失敗，保留原檔，不寫入、不建立 commit。");
  process.exitCode = 1;
} else if (!previous || hasSubstantiveChange(previous, output)) {
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log("資料有實質變化，已更新輸出檔。");
} else {
  console.log("僅執行時間不同，資料無實質變化，保留原檔，不寫入。");
}
