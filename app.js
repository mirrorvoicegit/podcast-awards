const state = { data: null, query: "", region: "all", phase: "all", view: "upcoming", selectedId: null };
const $ = selector => document.querySelector(selector);
const els = { timeline: $("#timeline"), detail: $("#detailPanel"), summary: $("#summary"), empty: $("#emptyState"), search: $("#searchInput"), region: $("#regionFilter"), phase: $("#phaseFilter"), updated: $("#lastUpdated"), upcomingCount: $("#upcomingCount"), archiveCount: $("#archiveCount") };
const monthFormatter = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long" });
const dateFormatter = new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric" });

function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" })[char]); }
function isPast(event) { return event.date && new Date(`${event.date}T23:59:59`) < new Date(); }
function phaseLabel(phase) { return ({ open:"徵件／截止", result:"入圍／得獎", monitor:"待公告／待確認" })[phase]; }
function displayDate(event) { return event.date ? dateFormatter.format(new Date(`${event.date}T00:00:00`)) : "待公告"; }
function filteredEvents() {
  const q = state.query.trim().toLocaleLowerCase("zh-Hant");
  return state.data.timeline.filter(event => {
    const award = state.data.awards.find(item => item.id === event.awardId);
    const haystack = [award.name, award.organizer, award.topic, event.label, event.note].join(" ").toLocaleLowerCase("zh-Hant");
    const viewMatches = state.view === "upcoming" ? !isPast(event) : isPast(event);
    return viewMatches && (!q || haystack.includes(q)) && (state.region === "all" || award.region === state.region) && (state.phase === "all" || event.phase === state.phase);
  });
}
function monthKey(event) { return event.date ? event.date.slice(0, 7) : "9999-12"; }
function renderEvent(event) {
  const award = state.data.awards.find(item => item.id === event.awardId); const past = isPast(event); const selected = state.selectedId === event.id;
  return `<button class="event ${event.phase} ${past ? "is-past" : ""} ${selected ? "selected" : ""}" data-event-id="${event.id}"><span class="event-date">${escapeHtml(displayDate(event))}</span><span class="event-marker"></span><span class="event-main"><span class="event-title">${escapeHtml(award.name)}｜${escapeHtml(event.label)}</span><span class="event-note">${escapeHtml(event.note || award.topic)}</span></span><span class="event-tag">${escapeHtml(phaseLabel(event.phase))}</span></button>`;
}
function renderTimeline() {
  const events = filteredEvents().sort((a, b) => { const aDate = a.date || "9999-12-31"; const bDate = b.date || "9999-12-31"; return state.view === "upcoming" ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate); });
  const groups = new Map(); events.forEach(event => { const key = monthKey(event); groups.set(key, [...(groups.get(key) || []), event]); });
  els.timeline.innerHTML = [...groups].map(([key, monthEvents]) => `<section class="month"><div class="month-label">${key === "9999-12" ? "待公告" : monthFormatter.format(new Date(`${key}-01T00:00:00`))}<small>${monthEvents.length} 個節點</small></div><div class="events">${monthEvents.map(renderEvent).join("")}</div></section>`).join("");
  els.summary.textContent = state.view === "upcoming" ? `依最近日期排序，顯示 ${events.length} 個即將舉辦／待追蹤節點` : `依最新完成日期排序，保留 ${events.length} 個歷史節點`;
  els.empty.hidden = events.length !== 0;
}
function renderDetail(eventId) {
  const event = state.data.timeline.find(item => item.id === eventId); if (!event) return;
  const award = state.data.awards.find(item => item.id === event.awardId); const past = isPast(event); const winners = (state.data.winners || []).filter(item => item.awardId === award.id);
  const winnerHtml = winners.length ? `<div class="winner-list">${winners.map(item => `<div class="winner-item"><strong>${escapeHtml(item.program)}</strong><span>${escapeHtml(item.edition)}｜${escapeHtml(item.category)}｜${escapeHtml(item.rank)}${item.publisher ? `｜${escapeHtml(item.publisher)}` : ""}</span></div>`).join("")}</div>` : `<p class="winner-empty">尚未完成官方得獎名單爬取或人工核實；不以搜尋結果自動補填。</p>`;
  els.detail.innerHTML = `<div class="detail-top"><p class="overline">${escapeHtml(award.region)} · ${escapeHtml(award.type)}</p><button class="detail-close" aria-label="關閉詳細資料">關閉 ×</button></div><p class="detail-status">${past ? "已結束節點" : phaseLabel(event.phase)}</p><h2>${escapeHtml(award.name)}</h2><p class="detail-organizer">${escapeHtml(award.organizer)}</p><section class="detail-section"><h3>這個節點</h3><p><strong>${escapeHtml(displayDate(event))}｜${escapeHtml(event.label)}</strong><br>${escapeHtml(event.note || "以主辦最新公告為準")}</p></section><section class="detail-section"><h3>Podcast 資格</h3><p>${escapeHtml(award.eligibility)}。${escapeHtml(award.eligibilityNote)}</p></section><section class="detail-section"><h3>作品與參賽資格</h3><dl class="detail-meta"><div><dt>類別</dt><dd>${escapeHtml(award.category)}</dd></div><div><dt>主題</dt><dd>${escapeHtml(award.topic)}</dd></div><div><dt>可報主體</dt><dd>${escapeHtml(award.applicant)}</dd></div><div><dt>資料可信度</dt><dd>${escapeHtml(award.confidence)}</dd></div></dl></section><section class="detail-section"><h3>人工審核註記</h3><p>${escapeHtml(award.reviewNote)}</p></section><section class="detail-section"><h3>已核實得獎節目</h3>${winnerHtml}</section><a class="source-link" href="${escapeHtml(award.url)}" target="_blank" rel="noreferrer">前往官方來源 <span>↗</span></a>`;
  els.detail.classList.add("show"); els.detail.querySelector(".detail-close").addEventListener("click", () => els.detail.classList.remove("show"));
}
function render() {
  const upcoming = state.data.timeline.filter(event => !isPast(event)).length; const archive = state.data.timeline.length - upcoming;
  els.upcomingCount.textContent = upcoming; els.archiveCount.textContent = archive;
  document.querySelectorAll(".view-tab").forEach(tab => { const active = tab.dataset.view === state.view; tab.classList.toggle("active", active); tab.setAttribute("aria-selected", active); });
  renderTimeline(); if (state.selectedId) renderDetail(state.selectedId);
}
function bindEvents() {
  els.search.addEventListener("input", e => { state.query = e.target.value; render(); }); els.region.addEventListener("change", e => { state.region = e.target.value; render(); }); els.phase.addEventListener("change", e => { state.phase = e.target.value; render(); });
  document.querySelector(".view-tabs").addEventListener("click", e => { const tab = e.target.closest("[data-view]"); if (!tab) return; state.view = tab.dataset.view; state.selectedId = null; els.detail.classList.remove("show"); render(); });
  els.timeline.addEventListener("click", e => { const button = e.target.closest("[data-event-id]"); if (!button) return; state.selectedId = button.dataset.eventId; render(); });
}
async function init() { const response = await fetch("./data/awards.json", { cache:"no-store" }); state.data = await response.json(); els.updated.textContent = state.data.updatedAt; els.updated.dateTime = state.data.updatedAt; bindEvents(); render(); }
init().catch(error => { els.timeline.innerHTML = `<div class="empty">資料載入失敗：${escapeHtml(error.message)}</div>`; });
