import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const awards=JSON.parse(await readFile(path.join(root,"data/awards.json"),"utf8"));
const info=new Map(awards.awards.map(award=>[award.id,award]));
const asDate=value=>String(value||"").replaceAll("-","");
const escape=value=>String(value||"").replaceAll("\\","\\\\").replaceAll("\n","\\n").replaceAll(",","\\,").replaceAll(";","\\;");
const stamp=asDate(awards.updatedAt)+"T000000Z";
const lines=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Ryuushouin Touga//Podcast Awards Radar//ZH-TW","CALSCALE:GREGORIAN","METHOD:PUBLISH","X-WR-CALNAME:Podcast 報獎雷達","X-WR-CALDESC:僅收錄經人工核對的徵件日期，仍以官方公告為準","REFRESH-INTERVAL;VALUE=DURATION:P1D"];
for(const application of awards.applications||[]){
  const award=info.get(application.awardId);
  if(!award||!application.infoPublished||!application.deadline||!application.sourceUrl)continue;
  for(const [type,date] of [["open",application.openDate],["deadline",application.deadline]]){
    if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
    const label=type==="open"?"開始徵件":"報名截止";
    const summary=escape(award.name+"｜"+label);
    lines.push("BEGIN:VEVENT","UID:"+application.id+"-"+type+"@podcast-awards.mirrorvoicegit","DTSTAMP:"+stamp,"DTSTART;VALUE=DATE:"+asDate(date),"DURATION:P1D","SUMMARY:"+summary,"DESCRIPTION:"+escape(application.edition+"。報名規則與日期以本屆官方公告為準："+application.sourceUrl),"URL:"+application.sourceUrl,"END:VEVENT");
  }
}
lines.push("END:VCALENDAR");
const fold=line=>{
  let out="",size=0;
  for(const char of line){
    const len=Buffer.byteLength(char,"utf8");
    if(size+len>73){out+="\r\n ";size=1;}
    out+=char;size+=len;
  }
  return out;
};
await writeFile(path.join(root,"awards.ics"),lines.map(fold).join("\r\n")+"\r\n");
console.log("已產生獎項日曆，活動數："+lines.filter(x=>x==="BEGIN:VEVENT").length);
