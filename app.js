const state = { data:null, discoveries:[], query:"", region:"all", view:"upcoming", selected:null };
const $ = selector => document.querySelector(selector);
const els = { list:$("#applicationList"), monitors:$("#monitorList"), monitorSection:$("#monitorSection"), discoveries:$("#discoveryList"), discoverySection:$("#discoverySection"), summary:$("#summary"), empty:$("#emptyState"), search:$("#searchInput"), region:$("#regionFilter"), detail:$("#detailPanel"), backdrop:$("#panelBackdrop"), updated:$("#lastUpdated"), upcomingCount:$("#upcomingCount"), archiveCount:$("#archiveCount") };
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
function episodeFor(id) { return (state.data.programEpisodes || []).find(episode => episode.id === id); }
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
function renderDiscoveries() {
  const items = state.discoveries.filter(item => item.status === "review_needed").slice(0,10);
  els.discoverySection.hidden = state.view === "archive" || items.length === 0;
  els.discoveries.innerHTML = items.map(item => `<a class="discovery-card" href="${escapeHtml(item.link)}" target="_blank" rel="noreferrer"><span><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.publishedAt || "日期待確認")} · 關鍵字：${escapeHtml(item.matchedQuery)}</span></span><span class="discovery-state">待人工確認 ↗</span></a>`).join("");
}
function render() {
  const upcomingTotal = state.data.applications.filter(application => !isClosed(application) && application.infoPublished).length;
  const archiveTotal = state.data.applications.filter(isClosed).length;
  const applications = applicationsForView();
  els.upcomingCount.textContent = upcomingTotal; els.archiveCount.textContent = archiveTotal;
  document.querySelectorAll(".view-tab").forEach(tab => { const active = tab.dataset.view === state.view; tab.classList.toggle("active",active); tab.setAttribute("aria-selected",String(active)); });
  els.list.innerHTML = applications.map(renderApplication).join(""); renderMonitors(); renderDiscoveries();
  els.summary.textContent = state.view === "upcoming" ? `共 ${applications.length} 個已公開報名資訊，依截止日排序` : `共 ${applications.length} 個已結束徵件，依截止日倒序`;
  els.empty.hidden = applications.length > 0 || (state.view === "upcoming" && monitorItems().length > 0);
}

function winnerBlock(awardId) {
  const winners = (state.data.winners || []).filter(item => item.awardId === awardId);
  if (!winners.length) return `<p class="winner-empty">得獎名單尚未完成官方來源爬取與人工核實。</p>`;
  return `<div class="winner-list">${winners.map(item => `<div class="winner-item"><strong>${escapeHtml(item.program)}</strong><span>${escapeHtml(item.edition)} · ${escapeHtml(item.category)} · ${escapeHtml(item.rank)}</span></div>`).join("")}</div>`;
}

function recommendationBlock(awardId) {
  const fitMeta = {
    "高度相符":{ rank:3, className:"fit-high" },
    "優先檢視":{ rank:2, className:"fit-priority" },
    "可檢視":{ rank:1, className:"fit-possible" }
  };
  const recommendations = (state.data.programRecommendations || [])
    .filter(item => item.awardId === awardId)
    .map(item => ({ ...item, program:programFor(item.programId), fitMeta:fitMeta[item.fit] || fitMeta["可檢視"] }))
    .filter(item => item.program && item.program.crawlStatus === "verified")
    .sort((a,b) => b.fitMeta.rank - a.fitMeta.rank || a.program.name.localeCompare(b.program.name,"zh-Hant"));
  if (!recommendations.length) {
    return `<div class="recommendation-empty"><strong>目前沒有明確候選節目</strong><span>不為了填滿清單而推薦；待節目題材或當屆資格更新後再比對。</span></div>`;
  }
  const exampleBlock = programId => {
    const match = (state.data.episodeRecommendations || []).find(item => item.awardId === awardId && item.programId === programId);
    const episodes = (match?.episodeIds || []).map(episodeFor).filter(Boolean).slice(0,2);
    if (!episodes.length) return `<div class="episode-pending">推薦集數待進一步比對</div>`;
    return `<div class="episode-examples"><span class="episode-label">推薦集數舉例</span>${episodes.map(episode => `<a class="episode-link" href="${escapeHtml(episode.url)}" target="_blank" rel="noreferrer"><span><strong>${escapeHtml(episode.title)}</strong><small>${escapeHtml(episode.publishedAt)} 發布</small></span><span>↗</span></a>`).join("")}</div>`;
  };
  return `<div class="recommendation-note">依節目定位與獎項主題初步比對，仍須逐集確認語言、原創採訪與報名資格。</div><div class="selection-disclaimer"><strong>選件提醒</strong><span>單集只會作為選件例子，不代表已確認符合參賽期間。</span></div>
    <div class="recommendation-list">${recommendations.map(item => `<article class="recommendation-item ${item.fitMeta.className}"><div class="recommendation-main"><span class="fit-tag">${escapeHtml(item.fit)}</span><a class="program-link" href="${escapeHtml(item.program.url)}" target="_blank" rel="noreferrer"><strong>${escapeHtml(item.program.name)}</strong><span>節目頁 ↗</span></a><small>${escapeHtml(item.program.category)} · ${escapeHtml(item.program.host)}</small><span class="recommendation-reason">${escapeHtml(item.reason)}</span>${exampleBlock(item.program.id)}</div></article>`).join("")}</div>`;
}
function renderDetail(type,id) {
  const application = type === "application" ? state.data.applications.find(item => item.id === id) : null;
  const award = application ? awardFor(application.awardId) : awardFor(id); const statusClass = application ? (isClosed(application) ? "archive" : "") : "monitor";
  const statusText = application ? (isClosed(application) ? "歷史紀錄" : isOpen(application) ? "徵件中" : "報名資訊已公開") : "持續監控中";
  const deadlineBlock = application ? `<div class="detail-deadline"><span>徵件截止日</span><strong>${escapeHtml(dateText.format(localDate(application.deadline)))}</strong>${application.openDate ? `<span>開放報名：${escapeHtml(dateText.format(localDate(application.openDate)))}</span>` : ""}</div>` : "";
  els.detail.innerHTML = `
    <div class="detail-top"><p class="detail-kicker">${escapeHtml(award.region)} · ${escapeHtml(award.type)}</p><button class="detail-close" aria-label="關閉詳細資料">關閉 ×</button></div>
    <span class="detail-status ${statusClass}">${statusText}</span>
    <h2>${escapeHtml(award.name)}</h2>
    <p class="detail-organizer">${escapeHtml(award.organizer)}</p>
    ${deadlineBlock}
    <section class="detail-section"><h3>Podcast 資格</h3><p><strong>${escapeHtml(award.eligibility)}</strong>。${escapeHtml(award.eligibilityNote)}</p></section>
    <section class="detail-section"><h3>參賽資訊</h3><dl class="detail-meta"><div><dt>類別</dt><dd>${escapeHtml(award.category)}</dd></div><div><dt>主題</dt><dd>${escapeHtml(award.topic)}</dd></div><div><dt>可報主體</dt><dd>${escapeHtml(award.applicant)}</dd></div><div><dt>可信度</dt><dd>${escapeHtml(award.confidence)}</dd></div></dl></section>
    <section class="detail-section"><h3>人工審核註記</h3><p>${escapeHtml(award.reviewNote)}</p></section>
    <a class="source-link" href="${escapeHtml(award.url)}" target="_blank" rel="noreferrer">查看官方來源 <span>↗</span></a>
    <section class="detail-section"><h3>已核實得獎節目</h3>${winnerBlock(award.id)}</section>
    <section class="detail-section recommendation-section"><div class="detail-section-heading"><h3>鏡好聽節目建議</h3><span>內部初篩</span></div>${recommendationBlock(award.id)}</section>`;
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
async function init() {
  const response=await fetch("./data/awards.json",{cache:"no-store"}); state.data=await response.json();
  try { const discoveryResponse=await fetch("./data/award-discovery-candidates.json",{cache:"no-store"}); if(discoveryResponse.ok) state.discoveries=(await discoveryResponse.json()).candidates || []; } catch (_) { state.discoveries=[]; }
  els.updated.textContent=state.data.updatedAt; els.updated.dateTime=state.data.updatedAt; bindEvents(); render();
}
init().catch(error => { els.list.innerHTML=`<div class="empty">資料載入失敗：${escapeHtml(error.message)}</div>`; });
