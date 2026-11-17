const asUTC=value=>new Date(value+"T00:00:00Z");
const daysBetween=(from,to)=>Math.round((asUTC(to)-asUTC(from))/86400000);
export function collectAlerts(data,previous,today){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(today))throw new Error("日期格式錯誤");
  if(!data.updatedAt||daysBetween(data.updatedAt,today)>45)return {items:[],stale:true};
  const sent=new Set(previous.sent||[]);
  const names=new Map((data.awards||[]).map(a=>[a.id,a.name]));
  const items=[];
  for(const app of data.applications||[]){
    if(!app.infoPublished||!app.deadline||!app.sourceUrl||!names.has(app.awardId))continue;
    const days=daysBetween(today,app.deadline);
    const verified=app.verifiedAt?daysBetween(app.verifiedAt,today):null;
    const entry={name:names.get(app.awardId),edition:app.edition||"",deadline:app.deadline,url:app.sourceUrl};
    if(verified!==null&&verified>=0&&verified<=7&&days>=0){
      const key="new:"+app.id;
      if(!sent.has(key))items.push({key,kind:"new",...entry});
    }
    if(days>=0&&days<=28){
      const tier=days<=7?7:days<=14?14:28;
      const key="deadline:"+app.id+":"+tier;
      if(!sent.has(key))items.push({key,kind:"deadline",days,tier,...entry});
    }
  }
  return {items,stale:false};
}
