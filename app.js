const state = { data:null, view:"upcoming", selected:null };
const $ = selector => document.querySelector(selector);
const els = { list:$("#applicationList"), monitors:$("#monitorList"), monitorSection:$("#monitorSection"), summary:$("#summary"), empty:$("#emptyState"), detail:$("#detailPanel"), backdrop:$("#panelBackdrop"), updated:$("#lastUpdated"), period:$("#periodLabel"), dataStatus:$("#dataStatus"), notice:$("#dataNotice"), upcomingCount:$("#upcomingCount"), archiveCount:$("#archiveCount") };
const dateText = new Intl.DateTimeFormat("zh-TW", { year:"numeric", month:"long", day:"numeric" });
const shortDate = new Intl.DateTimeFormat("zh-TW", { month:"numeric", day:"numeric" });

function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]); }
function localDate(value) { return value ? new Date(`${value}T00:00:00`) : null; }
function todayStart() { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
function isClosed(application) { return localDate(application.deadline) < todayStart(); }
function isOpen(application) { return application.openDate && localDate(application.openDate) <= todayStart() && !isClosed(application); }
function daysRemaining(application) { return Math.ceil((localDate(application.deadline) - todayStart()) / 86400000); }
function awardFor(id) { return state.data.awards.find(award => award.id === id); }
function deadlineParts(value) { const date = localDate(value); return { month:String(date.getMonth() + 1).padStart(2,"0"), day:String(date.getDate()).padStart(2,"0") }; }
function matchesFilters() { return true; }
function yearMonth(value) { const date=localDate(value); return date ? `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,"0")}` : null; }
function applicationReference(awardId) {
  const previous=(state.data.applications || []).filter(item=>item.awardId===awardId && item.deadline).sort((a,b)=>b.deadline.localeCompare(a.deadline))[0];
  if(previous){
    const start=yearMonth(previous.openDate); const end=yearMonth(previous.deadline);
    if(start && end) return start.slice(0,4)===end.slice(0,4) ? `${start}–${end.slice(5)}` : `${start}–${end}`;
    if(end) return end;
  }
  const knownStart=(state.data.timeline || []).filter(item=>item.awardId===awardId && item.phase==="open" && item.date && /開始|徵件/.test(item.label)).sort((a,b)=>b.date.localeCompare(a.date))[0];
  return knownStart ? `${yearMonth(knownStart.date)} 起` : null;
}

function applicationsForView() {
  return state.data.applications.filter(application => {
    const matchesView = state.view === "upcoming" ? !isClosed(application) && application.infoPublished : isClosed(application);
    return matchesView && matchesFilters(awardFor(application.awardId));
  }).sort((a,b) => state.view === "upcoming" ? a.deadline.localeCompare(b.deadline) : b.deadline.localeCompare(a.deadline));
}

function renderApplication(application) {
  const award = awardFor(application.awardId); const archive = isClosed(application); const days = archive ? null : daysRemaining(application);
  const deadline = deadlineParts(application.deadline);
  const tag = archive ? "徵件已結束" : isOpen(application) ? "徵件中" : "報名資訊已公開";
  return `<button class="application-card ${archive ? "archive-card" : "actionable"}" data-type="application" data-id="${application.id}">
    <span class="deadline-block"><span class="deadline-date"><span class="deadline-month">${escapeHtml(deadline.month)}</span><span class="deadline-separator">.</span><span class="deadline-day">${escapeHtml(deadline.day)}</span></span><span class="deadline-word">截止</span></span>
    <span><h3>${escapeHtml(award.name)}</h3><p class="application-meta">${escapeHtml(application.edition)}${application.openDate ? ` · ${escapeHtml(shortDate.format(localDate(application.openDate)))} 開放報名` : ""}</p></span>
    <span><span class="application-tag">${tag}</span>${days !== null ? `<span class="days-left">${days === 0 ? "今天截止" : `剩 ${days} 天`}</span>` : ""}</span>
  </button>`;
}

function monitorItems() {
  const known = new Set(state.data.timeline.filter(item => item.phase === "monitor").map(item => item.awardId));
  return [...known].map(awardFor).filter(award => matchesFilters(award));
}
function renderMonitors() {
  const awards = monitorItems();
  els.monitorSection.hidden = state.view === "archive" || awards.length === 0;
  els.monitors.innerHTML = awards.map(award => { const reference=applicationReference(award.id); return `<button class="monitor-card" data-type="monitor" data-id="${award.id}"><span><strong>${escapeHtml(award.name)}</strong><span>持續監控中 · ${reference ? `最近一屆徵件 ${escapeHtml(reference)}` : "上屆月份待補"}</span></span><span class="arrow">›</span></button>`; }).join("");
}
function render() {
  const upcomingTotal = state.data.applications.filter(application => !isClosed(application) && application.infoPublished).length;
  const archiveTotal = state.data.applications.filter(isClosed).length;
  const applications = applicationsForView();
  els.upcomingCount.textContent = upcomingTotal; els.archiveCount.textContent = archiveTotal;
  document.querySelectorAll(".view-tab").forEach(tab => { const active = tab.dataset.view === state.view; tab.classList.toggle("active",active); tab.setAttribute("aria-selected",String(active)); });
  els.list.innerHTML = applications.map(renderApplication).join(""); renderMonitors();
  els.summary.textContent = state.view === "upcoming" ? (applications.length ? `已核實 ${applications.length} 筆尚未截止的徵件，依截止日排序` : "目前沒有已核實且尚未截止的徵件；不代表其他獎項沒有開放報名。") : `共 ${applications.length} 筆已結束徵件，依截止日倒序`;
  els.empty.hidden = applications.length > 0 || (state.view === "upcoming" && monitorItems().length > 0);
}

function renderDetail(type,id) {
  const application = type === "application" ? state.data.applications.find(item => item.id === id) : null;
  const award = application ? awardFor(application.awardId) : awardFor(id); const statusClass = application ? (isClosed(application) ? "archive" : "") : "monitor";
  const statusText = application ? (isClosed(application) ? "歷史紀錄" : isOpen(application) ? "徵件中" : "報名資訊已公開") : "持續監控中";
  const reference=applicationReference(award.id);
  const deadlineBlock = application ? `<div class="detail-deadline"><span>徵件截止日</span><strong>${escapeHtml(dateText.format(localDate(application.deadline)))}</strong>${application.openDate ? `<span>開放報名：${escapeHtml(dateText.format(localDate(application.openDate)))}</span>` : ""}</div>` : reference ? `<div class="detail-deadline monitor-reference"><span>最近一屆徵件月份</span><strong>${escapeHtml(reference)}</strong><span>僅供預排工作參考，仍以本屆公告為準。</span></div>` : "";
  const entryFeeLink=application?.entryFeeUrl ? ` <a class="meta-link" href="${escapeHtml(application.entryFeeUrl)}" target="_blank" rel="noreferrer">費用來源 ↗</a>` : "";
  const entryFeeRow=application?.entryFee ? `<div><dt>報名費</dt><dd>${escapeHtml(application.entryFee)}${entryFeeLink}</dd></div>` : "";
  const sourceUrl=application?.sourceUrl || award.url;
  const sourceLabel=application?.sourceUrl ? "查看本屆徵件公告" : "查看獎項官方網站";
  els.detail.innerHTML = `
    <div class="detail-top"><p class="detail-kicker">${escapeHtml(award.region)} · ${escapeHtml(award.type)}</p><button class="detail-close" aria-label="關閉詳細資料">關閉 ×</button></div>
    <span class="detail-status ${statusClass}">${statusText}</span>
    <h2>${escapeHtml(award.name)}</h2>
    <p class="detail-organizer">${escapeHtml(award.organizer)}</p>
    ${deadlineBlock}
    <section class="detail-section"><h3>參賽資訊</h3><dl class="detail-meta">${entryFeeRow}<div><dt>類別</dt><dd>${escapeHtml(award.category)}</dd></div><div><dt>主題</dt><dd>${escapeHtml(award.topic)}</dd></div><div><dt>可報主體</dt><dd>${escapeHtml(award.applicant)}</dd></div></dl></section>
    <section class="detail-section source-section"><a class="source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">${sourceLabel} <span>↗</span></a></section>`;
  els.detail.classList.add("show"); els.detail.setAttribute("aria-hidden","false"); els.backdrop.hidden = false;
  els.detail.querySelector(".detail-close").addEventListener("click",closeDetail);
}
function closeDetail() { els.detail.classList.remove("show"); els.detail.setAttribute("aria-hidden","true"); els.backdrop.hidden = true; }
function handleCardClick(event) { const card = event.target.closest("[data-type]"); if (card) renderDetail(card.dataset.type,card.dataset.id); }
function bindEvents() {
  const copyButton=document.getElementById("copyCalendarUrl");
  if(copyButton)copyButton.addEventListener("click",async()=>{
    const url=document.getElementById("calendarUrl").textContent.trim();
    try { await navigator.clipboard.writeText(url); document.getElementById("copyCalendarFeedback").textContent="網址已複製，可貼到 Google 日曆的「從網址新增」。"; }
    catch(_) { document.getElementById("copyCalendarFeedback").textContent="無法自動複製，請直接選取上方網址複製。"; }
  });
  document.querySelector(".view-tabs").addEventListener("click",event => { const tab=event.target.closest("[data-view]"); if(!tab)return; state.view=tab.dataset.view; closeDetail(); render(); });
  els.list.addEventListener("click",handleCardClick); els.monitors.addEventListener("click",handleCardClick); els.backdrop.addEventListener("click",closeDetail); document.addEventListener("keydown",event => { if(event.key==="Escape")closeDetail(); });
}
function renderDataStatus() {
  const updated=state.data.updatedAt;
  const today=todayStart();
  const age=updated ? Math.floor((today-localDate(updated))/86400000) : Infinity;
  const old=!Number.isFinite(age)||age>45;
  els.updated.textContent=updated || "未提供";
  if (updated) els.updated.dateTime=updated;
  els.dataStatus.textContent=old ? "官方徵件資料待重新查證" : "官方徵件資料已查證";
  els.notice.textContent=old
    ? `正式獎項資料最後核對日期為 ${updated || "未知"}，距今已超過 45 天。系統會自動搜尋獎項資訊，並由定期 AI 查核比對當屆官方公告後更新；尚未證實的消息不會列為正式徵件。目前清單可能不完整，請以主辦單位公告為準。`
    : "已收錄的徵件資訊須有當屆官方公告佐證。新增獎項由自動搜尋與 AI 定期查核，不要求使用者自行審核；尚未證實的消息不會列為正式徵件。";
  const dates=(state.data.applications||[]).map(a=>a.deadline).filter(Boolean).sort();
  els.period.textContent=dates.length ? `${dates[0].slice(0,7).replace("-",".")} — ${dates[dates.length-1].slice(0,7).replace("-",".")}` : "暫無已核實徵件";
}
async function init() {
  const response=await fetch("./data/awards.json",{cache:"no-store"}); state.data=await response.json();
  renderDataStatus(); bindEvents(); render();
}
init().catch(error => { els.list.innerHTML=`<div class="empty">資料載入失敗：${escapeHtml(error.message)}</div>`; });
