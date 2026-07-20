const state = { data:null, query:"", region:"all", view:"upcoming", selected:null };
const $ = selector => document.querySelector(selector);
const els = { list:$("#applicationList"), monitors:$("#monitorList"), monitorSection:$("#monitorSection"), summary:$("#summary"), empty:$("#emptyState"), search:$("#searchInput"), region:$("#regionFilter"), detail:$("#detailPanel"), backdrop:$("#panelBackdrop"), updated:$("#lastUpdated"), upcomingCount:$("#upcomingCount"), archiveCount:$("#archiveCount") };
const dateText = new Intl.DateTimeFormat("zh-TW", { year:"numeric", month:"long", day:"numeric" });
const shortDate = new Intl.DateTimeFormat("zh-TW", { month:"numeric", day:"numeric" });

function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]); }
function localDate(value) { return value ? new Date(`${value}T00:00:00`) : null; }
function todayStart() { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), now.getDate()); }
function isClosed(application) { return localDate(application.deadline) < todayStart(); }
function isOpen(application) { return application.openDate && localDate(application.openDate) <= todayStart() && !isClosed(application); }
function daysRemaining(application) { return Math.ceil((localDate(application.deadline) - todayStart()) / 86400000); }
function awardFor(id) { return state.data.awards.find(award => award.id === id); }
function programFor(id) { return (state.data.mirrorPrograms || []).find(program => program.id === id); }
function deadlineDigits(value) { const date = localDate(value); return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2,"0")}`; }
function matchesFilters(award, extra="") { const q = state.query.trim().toLocaleLowerCase("zh-Hant"); const text = [award.name, award.organizer, award.topic, extra].join(" ").toLocaleLowerCase("zh-Hant"); return (!q || text.includes(q)) && (state.region === "all" || award.region === state.region); }

function applicationsForView() {
  return state.data.applications.filter(application => {
    const matchesView = state.view === "upcoming" ? !isClosed(application) && application.infoPublished : isClosed(application);
    return matchesView && matchesFilters(awardFor(application.awardId), application.edition);
  }).sort((a,b) => state.view === "upcoming" ? a.deadline.localeCompare(b.deadline) : b.deadline.localeCompare(a.deadline));
}

function renderApplication(application) {
  const award = awardFor(application.awardId); const archive = isClosed(application); const days = archive ? null : daysRemaining(application);
  const tag = archive ? "徵件已結束" : isOpen(application) ? "徵件中" : "報名資訊已公開";
  return `<button class="application-card ${archive ? "archive-card" : "actionable"}" data-type="application" data-id="${application.id}">
    <span class="deadline-block"><span class="deadline-date">${escapeHtml(deadlineDigits(application.deadline))}</span><span class="deadline-word">截止</span></span>
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
  els.monitors.innerHTML = awards.map(award => `<button class="monitor-card" data-type="monitor" data-id="${award.id}"><span><strong>${escapeHtml(award.name)}</strong><span>持續監控中 · 報名時程待公告</span></span><span class="arrow">›</span></button>`).join("");
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

function winnerBlock(awardId) {
  const winners = (state.data.winners || []).filter(item => item.awardId === awardId);
  if (!winners.length) return `<p class="winner-empty">得獎名單尚未完成官方來源爬取與人工核實。</p>`;
  return `<div class="winner-list">${winners.map(item => `<div class="winner-item"><strong>${escapeHtml(item.program)}</strong><span>${escapeHtml(item.edition)} · ${escapeHtml(item.category)} · ${escapeHtml(item.rank)}</span></div>`).join("")}</div>`;
}

function recommendationBlock(awardId) {
  const recommendations = (state.data.programRecommendations || [])
    .filter(item => item.awardId === awardId)
    .map(item => ({ ...item, program:programFor(item.programId) }))
    .filter(item => item.program && item.program.crawlStatus === "verified");
  if (!recommendations.length) {
    return `<div class="recommendation-empty"><strong>目前沒有明確候選節目</strong><span>不為了填滿清單而推薦；待節目題材或當屆資格更新後再比對。</span></div>`;
  }
  return `<div class="recommendation-note">依節目定位與獎項主題初步比對，仍須逐集確認作品期間、語言、原創採訪與報名資格。</div>
    <div class="recommendation-list">${recommendations.map(item => `<a class="recommendation-item" href="${escapeHtml(item.program.url)}" target="_blank" rel="noreferrer"><span class="recommendation-main"><span class="fit-tag">${escapeHtml(item.fit)}</span><strong>${escapeHtml(item.program.name)}</strong><small>${escapeHtml(item.program.category)} · ${escapeHtml(item.program.host)}</small><span>${escapeHtml(item.reason)}</span></span><span class="recommendation-arrow">↗</span></a>`).join("")}</div>`;
}
function renderDetail(type,id) {
  const application = type === "application" ? state.data.applications.find(item => item.id === id) : null;
  const award = application ? awardFor(application.awardId) : awardFor(id); const statusClass = application ? (isClosed(application) ? "archive" : "") : "monitor";
  const statusText = application ? (isClosed(application) ? "歷史紀錄" : isOpen(application) ? "徵件中" : "報名資訊已公開") : "持續監控中";
  const deadlineBlock = application ? `<div class="detail-deadline"><span>徵件截止日</span><strong>${escapeHtml(dateText.format(localDate(application.deadline)))}</strong>${application.openDate ? `<span>開放報名：${escapeHtml(dateText.format(localDate(application.openDate)))}</span>` : ""}</div>` : "";
  els.detail.innerHTML = `<div class="detail-top"><p class="detail-kicker">${escapeHtml(award.region)} · ${escapeHtml(award.type)}</p><button class="detail-close" aria-label="關閉詳細資料">關閉 ×</button></div><span class="detail-status ${statusClass}">${statusText}</span><h2>${escapeHtml(award.name)}</h2><p class="detail-organizer">${escapeHtml(award.organizer)}</p>${deadlineBlock}<section class="detail-section recommendation-section"><div class="detail-section-heading"><h3>鏡好聽節目建議</h3><span>內部初篩</span></div>${recommendationBlock(award.id)}</section><section class="detail-section"><h3>PODCAST 資格</h3><p><strong>${escapeHtml(award.eligibility)}</strong>。${escapeHtml(award.eligibilityNote)}</p></section><section class="detail-section"><h3>參賽資訊</h3><dl class="detail-meta"><div><dt>類別</dt><dd>${escapeHtml(award.category)}</dd></div><div><dt>主題</dt><dd>${escapeHtml(award.topic)}</dd></div><div><dt>可報主體</dt><dd>${escapeHtml(award.applicant)}</dd></div><div><dt>可信度</dt><dd>${escapeHtml(award.confidence)}</dd></div></dl></section><section class="detail-section"><h3>人工審核註記</h3><p>${escapeHtml(award.reviewNote)}</p></section><section class="detail-section"><h3>已核實得獎節目</h3>${winnerBlock(award.id)}</section><a class="source-link" href="${escapeHtml(award.url)}" target="_blank" rel="noreferrer">查看官方來源 <span>↗</span></a>`;
  els.detail.classList.add("show"); els.detail.setAttribute("aria-hidden","false"); els.backdrop.hidden = false;
  els.detail.querySelector(".detail-close").addEventListener("click",closeDetail);
}
function closeDetail() { els.detail.classList.remove("show"); els.detail.setAttribute("aria-hidden","true"); els.backdrop.hidden = true; }
function handleCardClick(event) { const card = event.target.closest("[data-type]"); if (card) renderDetail(card.dataset.type,card.dataset.id); }
function bindEvents() {
  els.search.addEventListener("input",event => { state.query=event.target.value; render(); }); els.region.addEventListener("change",event => { state.region=event.target.value; render(); });
  document.querySelector(".view-tabs").addEventListener("click",event => { const tab=event.target.closest("[data-view]"); if(!tab)return; state.view=tab.dataset.view; closeDetail(); render(); });
  els.list.addEventListener("click",handleCardClick); els.monitors.addEventListener("click",handleCardClick); els.backdrop.addEventListener("click",closeDetail); document.addEventListener("keydown",event => { if(event.key==="Escape")closeDetail(); });
}
async function init() { const response=await fetch("./data/awards.json",{cache:"no-store"}); state.data=await response.json(); els.updated.textContent=state.data.updatedAt; els.updated.dateTime=state.data.updatedAt; bindEvents(); render(); }
init().catch(error => { els.list.innerHTML=`<div class="empty">資料載入失敗：${escapeHtml(error.message)}</div>`; });
