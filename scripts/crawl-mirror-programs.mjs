import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataPath = path.join(root, "data", "awards.json");
const outputPath = path.join(root, "data", "program-crawl-candidates.json");
const data = JSON.parse(await readFile(dataPath, "utf8"));

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
        updatedAt:updated
      }
    };
  } catch (error) {
    return { sourceId:program.sourceId, url:program.url, status:"fetch_failed", checkedAt, error:String(error.message || error) };
  }
}

const results = await Promise.all((data.mirrorPrograms || []).map(crawl));
await writeFile(outputPath, `${JSON.stringify({ generatedAt:new Date().toISOString(), reviewRequired:true, programs:results }, null, 2)}\n`);
console.log(`Checked ${results.length} Mirror Voice programs; ${results.filter(item => item.status === "fetched").length} fetched.`);
