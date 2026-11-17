"use strict";
const STORAGE_KEY="podcastAwardReviewV1";
const byId=id=>document.getElementById(id);
const rows=byId("candidates");
let data=null;
let choices={};
try { choices=JSON.parse(localStorage.getItem(STORAGE_KEY)||"{}"); } catch (_) { choices={}; }
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(choices));}catch(_){byId("reviewNotice").textContent="本機儲存不可用，請立即下載審核結果 JSON 以免資料遺失。";}}
function node(tag,classes,text){const el=document.createElement(tag);if(classes)el.className=classes;if(text!==undefined)el.textContent=text;return el;}
function isReviewed(item){return Boolean(choices[item.id] && choices[item.id].decision);}
function render(){
  if(!data)return;
  const all=data.candidates||[];
  const reviewed=all.filter(isReviewed).length;
  byId("pendingCount").textContent=String(all.filter(x=>x.status==="review_needed"&&!isReviewed(x)).length);
  byId("reviewedCount").textContent=String(reviewed);
  byId("scanDate").textContent=(data.generatedAt||"").slice(0,10)||"未知";
  const filter=byId("filter").value;
  const q=byId("search").value.trim().toLowerCase();
  const filtered=all.filter(x=>{
    if(filter==="pending"&&(x.status!=="review_needed"||isReviewed(x)))return false;
    if(filter==="reviewed"&&!isReviewed(x))return false;
    return !q || (x.title||"").toLowerCase().includes(q) || (x.matchedQuery||"").toLowerCase().includes(q);
  });
  rows.replaceChildren();
  if(!filtered.length){rows.append(node("p","","沒有符合條件的候選資訊。"));return;}
  for(const item of filtered){
    const choice=choices[item.id]||{};
    const article=node("article","candidate");
    article.append(node("h2","",item.title||"未命名資料"));
    const details=node("p","",(item.publishedAt||"日期未知")+" · 搜尋詞："+(item.matchedQuery||""));
    article.append(details);
    if(item.link){const a=node("a","","查看新聞來源");a.href=item.link;a.target="_blank";a.rel="noopener noreferrer";article.append(a);}
    const controls=node("div","decisions");
    const decisionLabel=node("label","","審核決定");
    const select=node("select","");
    for(const [value,label] of [["","尚未處理"],["verify","值得進一步查證"],["known_award","已有獎項／重複"],["irrelevant","無關資訊"]]){
      const opt=node("option","",label);opt.value=value;select.append(opt);
    }
    select.value=choice.decision||"";
    const noteLabel=node("label","","備註／核對線索");
    const note=node("input","");note.placeholder="選填，方便下次核對";note.value=choice.note||"";
    const urlLabel=node("label","","官方公告網址");
    const official=node("input","");official.placeholder="https://（如有）";official.value=choice.officialUrl||"";official.inputMode="url";
    function write(){choices[item.id]={decision:select.value,note:note.value.trim(),officialUrl:official.value.trim()};save();updateCounts();}
    select.addEventListener("change",()=>{write();render();});
    note.addEventListener("change",write);official.addEventListener("change",write);
    decisionLabel.append(select);noteLabel.append(note);urlLabel.append(official);
    controls.append(decisionLabel,noteLabel,urlLabel);article.append(controls);rows.append(article);
  }
}
function updateCounts(){const all=data.candidates||[];byId("pendingCount").textContent=String(all.filter(x=>x.status==="review_needed"&&!isReviewed(x)).length);byId("reviewedCount").textContent=String(all.filter(isReviewed).length);}
function exportJson(){
  const decisions=(data.candidates||[]).filter(isReviewed).map(item=>({id:item.id,title:item.title,sourceUrl:item.link,decision:choices[item.id].decision,note:choices[item.id].note||"",officialUrl:choices[item.id].officialUrl||""}));
  if(!decisions.length){byId("reviewNotice").textContent="還沒有任何審核結果可以下載。";return;}
  const payload={sourceGeneratedAt:data.generatedAt,exportedAt:new Date().toISOString(),decisions};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"}));
  const a=node("a");a.href=url;a.download="報獎雷達_候選審核結果.json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
byId("filter").addEventListener("change",render);
byId("search").addEventListener("input",render);
byId("export").addEventListener("click",exportJson);
fetch("./data/award-discovery-candidates.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("候選資料載入失敗");return r.json();}).then(json=>{data=json;render();}).catch(error=>{rows.append(node("p","",error.message));});
