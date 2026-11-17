import { readFile, writeFile, appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { collectAlerts } from "./lib/notification-digest.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const data=JSON.parse(await readFile(path.join(root,"data/awards.json"),"utf8"));
const statePath=path.join(root,"data/notification-state.json");
let state={sent:[]};
try{state=JSON.parse(await readFile(statePath,"utf8"));}catch(_){}
const today=process.env.TODAY||new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const {items,stale}=collectAlerts(data,state,today);
const escapeHtml=x=>String(x).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
const lines=["# Podcast 報獎雷達｜通知預覽","日期："+today,"正式獎項資料核實日期："+data.updatedAt,""];
if(stale)lines.push("資料已超過 45 天未核對，停用自動發送。");
else if(!items.length)lines.push("本週沒有符合寄送條件的新核實徵件或截止提醒。");
else for(const item of items){
  lines.push("## "+(item.kind==="new"?"新核實徵件":"截止提醒：剩 "+item.days+" 天")+"｜"+item.name);
  lines.push(item.edition+"，截止："+item.deadline);
  lines.push("官方公告："+item.url,"");
}
lines.push("報名資訊以主辦單位官方公告為準。");
const digest=lines.join("\n")+"\n";
if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,digest);
console.log(digest);
const enabled=process.env.NOTIFY_ENABLED==="true" && process.env.PREVIEW_ONLY!=="true";
if(!enabled||stale||!items.length){console.log("未發送：未啟用通知、資料過期，或沒有需要通知的內容。");process.exit(0);}
const apiKey=process.env.AWARDS_RESEND_API_KEY;
const sender=process.env.AWARDS_NOTIFY_FROM;
const recipients=(process.env.AWARDS_NOTIFY_TO||"").split(",").map(x=>x.trim()).filter(Boolean);
if(!apiKey||!sender||!recipients.length)throw new Error("已啟用通知但缺少寄件服務金鑰、已驗證寄件地址或收件者設定。");
const subject="Podcast 報獎雷達｜"+today+" 徵件提醒（"+items.length+" 則）";
const text=digest.replace(/^# /gm,"").replace(/^## /gm,"");
const html="<html lang=\"zh-Hant\"><body style=\"font-family:sans-serif;max-width:680px;margin:auto;white-space:pre-wrap;line-height:1.7\">"+escapeHtml(text)+"</body></html>";
const hash=createHash("sha256").update(items.map(x=>x.key).sort().join("|")+"|"+recipients.join(",")).digest("hex");
const response=await fetch("https://api.resend.com/emails",{
  method:"POST",
  headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json","User-Agent":"podcast-awards-radar/1.0","Idempotency-Key":"podcast-awards-"+hash},
  body:JSON.stringify({from:sender,to:recipients,subject,text,html})
});
if(!response.ok)throw new Error("寄信服務回應失敗，HTTP "+response.status+"。本次不記錄為已寄送。");
const result=await response.json();
if(!result.id)throw new Error("寄信服務未回傳成功識別碼，未更新寄送紀錄。");
state.sent=[...new Set([...(state.sent||[]),...items.map(x=>x.key)])];
await writeFile(statePath,JSON.stringify(state,null,2)+"\n");
console.log("通知已交由寄信服務處理，紀錄已更新。");
