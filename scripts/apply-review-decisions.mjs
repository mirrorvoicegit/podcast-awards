import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const inputFile=process.argv[2];
if(!inputFile)throw new Error("用法：node scripts/apply-review-decisions.mjs 審核結果.json");
const input=JSON.parse(await readFile(path.resolve(inputFile),"utf8"));
if(!Array.isArray(input.decisions))throw new Error("找不到 decisions 陣列");
const normalize=value=>String(value||"").toLocaleLowerCase("zh-Hant").replace(/第\d+屆/g,"").replace(/先生/g,"").replace(/[^\p{L}\p{N}]/gu,"");
const allowed=new Map([["verify","verification_requested"],["known_award","known_award"],["irrelevant","irrelevant"]]);
const storedPath=path.join(root,"data/discovery-reviews.json");
const candidatePath=path.join(root,"data/award-discovery-candidates.json");
const stored=JSON.parse(await readFile(storedPath,"utf8"));
const candidates=JSON.parse(await readFile(candidatePath,"utf8"));
const index=new Map(stored.entries.map(row=>[row.key,row]));
const date=String(input.exportedAt||new Date().toISOString()).slice(0,10);
for(const row of input.decisions){
  if(!row.title||!row.id||!allowed.has(row.decision))throw new Error("審核項目缺必要資料或決定不合法");
  const key=normalize(row.title);
  const verifiedUrl=String(row.officialUrl||"").trim();
  if(verifiedUrl&&!/^https?:\/\/\S+$/i.test(verifiedUrl))throw new Error("官方連結不是有效的 http(s) 網址");
  index.set(key,{key,title:row.title,status:allowed.get(row.decision),note:String(row.note||"").slice(0,600),officialUrl:verifiedUrl,reviewedAt:date});
}
stored.entries=[...index.values()].sort((a,b)=>a.key.localeCompare(b.key));
for(const row of candidates.candidates||[]){
  const review=index.get(normalize(row.title));
  if(!review)continue;
  row.status=review.status;
  row.note=review.note||null;
  if(review.officialUrl)row.officialUrl=review.officialUrl;
}
await writeFile(storedPath,JSON.stringify(stored,null,2)+"\n");
await writeFile(candidatePath,JSON.stringify(candidates,null,2)+"\n");
console.log("已整併 "+input.decisions.length+" 筆候選分類；不會自動新增正式獎項或寄信。");
