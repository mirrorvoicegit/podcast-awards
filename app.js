import { buildRecommendations, recommendationRuleFor } from "./recommendation-engine.js?v=26";

const state = { data:null, view:"upcoming", selected:null };
const $ = selector => document.querySelector(selector);
const els = { list:$("#applicationList"), monitors:$("#monitorList"), monitorSection:$("#monitorSection"), summary:$("#summary"), empty:$("#emptyState"), detail:$("#detailPanel"), backdrop:$("#panelBackdrop"), updated:$("#lastUpdated"), upcomingCount:$("#upcomingCount"), archiveCount:$("#archiveCount") };
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
  els.summary.textContent = state.view === "upcoming" ? `共 ${applications.length} 個已公開報名資訊，依截止日排序` : `共 ${applications.length} 個已結束徵件，依截止日倒序`;
  els.empty.hidden = applications.length > 0 || (state.view === "upcoming" && monitorItems().length > 0);
}

function recommendationBlock(awardId) {
  const fitMeta = {
    "高度相符":{ rank:3, className:"fit-high" },
    "優先檢視":{ rank:2, className:"fit-priority" }
  };
  const rule = recommendationRuleFor(state.data,awardId);
  const recommendations = buildRecommendations(state.data,awardId).map(item => ({ ...item, fitMeta:fitMeta[item.fit] }));
  if (!recommendations.length) {
    const note = rule?.emptyNote || "只有通過獎項門檻、節目類型、主題重合與單集證據檢查後才會出現推薦。";
    return `<div class="recommendation-empty"><strong>目前沒有足夠相符的候選節目</strong><span>${escapeHtml(note)}不為了填滿清單而推薦。</span></div>`;
  }
  const exampleBlock = episodes => {
    episodes = episodes.slice(0,2);
    if (!episodes.length) return `<div class="episode-pending">推薦集數待進一步比對</div>`;
    return `<div class="episode-examples"><span class="episode-label">推薦集數舉例</span>${episodes.map(episode => `<a class="episode-link" href="${escapeHtml(episode.url)}" target="_blank" rel="noreferrer"><span><strong>${escapeHtml(episode.title)}</strong><small>${escapeHtml(episode.publishedAt)} 發布</small></span><span>↗</span></a>`).join("")}</div>`;
  };
  return `<div class="recommendation-note">系統依獎項門檻、節目類型、主題詞與單集線索即時計算；仍須人工確認語言、原創採訪與報名資格。</div><div class="selection-disclaimer"><strong>選件提醒</strong><span>單集只會作為選件例子，不代表已確認符合參賽期間。</span></div>
    <div class="recommendation-list">${recommendations.map(item => `<article class="recommendation-item ${item.fitMeta.className}"><div class="recommendation-main"><span class="fit-tag">${escapeHtml(item.fit)}</span><a class="program-link" href="${escapeHtml(item.program.url)}" target="_blank" rel="noreferrer"><strong>${escapeHtml(item.program.name)}</strong><span>節目頁 ↗</span></a><small>${escapeHtml(item.program.category)} · ${escapeHtml(item.program.host)}</small><span class="recommendation-reason">${escapeHtml(item.reason)}</span>${exampleBlock(item.matchedEpisodes)}</div></article>`).join("")}</div>`;
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
    <section class="detail-section source-section"><a class="source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noreferrer">${sourceLabel} <span>↗</span></a></section>
    <section class="detail-section recommendation-section"><div class="detail-section-heading"><h3>鏡好聽節目建議</h3><span>內部初篩</span></div>${recommendationBlock(award.id)}</section>`;
  els.detail.classList.add("show"); els.detail.setAttribute("aria-hidden","false"); els.backdrop.hidden = false;
  els.detail.querySelector(".detail-close").addEventListener("click",closeDetail);
}
function closeDetail() { els.detail.classList.remove("show"); els.detail.setAttribute("aria-hidden","true"); els.backdrop.hidden = true; }
function handleCardClick(event) { const card = event.target.closest("[data-type]"); if (card) renderDetail(card.dataset.type,card.dataset.id); }
function bindEvents() {
  document.querySelector(".view-tabs").addEventListener("click",event => { const tab=event.target.closest("[data-view]"); if(!tab)return; state.view=tab.dataset.view; closeDetail(); render(); });
  els.list.addEventListener("click",handleCardClick); els.monitors.addEventListener("click",handleCardClick); els.backdrop.addEventListener("click",closeDetail); document.addEventListener("keydown",event => { if(event.key==="Escape")closeDetail(); });
}
async function init() {
  const response=await fetch("./data/awards.json",{cache:"no-store"}); state.data=await response.json();
  els.updated.textContent=state.data.updatedAt; els.updated.dateTime=state.data.updatedAt; bindEvents(); render();
}
init().catch(error => { els.list.innerHTML=`<div class="empty">資料載入失敗：${escapeHtml(error.message)}</div>`; });
