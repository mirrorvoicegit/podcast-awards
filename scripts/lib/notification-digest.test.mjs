import test from "node:test";
import assert from "node:assert/strict";
import { collectAlerts } from "./notification-digest.mjs";
const data={updatedAt:"2026-11-17",awards:[{id:"a",name:"測試獎"}],applications:[{id:"app-1",awardId:"a",infoPublished:true,verifiedAt:"2026-11-16",deadline:"2026-11-29",sourceUrl:"https://example.org/rules",edition:"2026"}]};
test("新核實徵件與 14 天提醒各一次",()=>{
 const result=collectAlerts(data,{sent:[]},"2026-11-17");
 assert.deepEqual(result.items.map(x=>x.key),["new:app-1","deadline:app-1:14"]);
});
test("已寄送鍵不再重複提醒",()=>{
 const result=collectAlerts(data,{sent:["new:app-1","deadline:app-1:14"]},"2026-11-17");
 assert.equal(result.items.length,0);
});
test("舊資料不得自動發信",()=>{
 const result=collectAlerts({...data,updatedAt:"2026-07-20"},{sent:[]},"2026-11-17");
 assert.equal(result.stale,true);
 assert.equal(result.items.length,0);
});
test("非正式候選不得加入通知",()=>{
 const d={...data,applications:[{...data.applications[0],infoPublished:false}]};
 assert.equal(collectAlerts(d,{sent:[]},"2026-11-17").items.length,0);
});
test("不出現節目推薦",()=>{
 const result=collectAlerts(data,{sent:[]},"2026-11-17");
 assert.equal(result.items.some(x=>x.program||x.recommendation),false);
});
