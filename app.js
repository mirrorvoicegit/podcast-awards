const state = { awards: [], query: "", region: "all", status: "all", eligibility: "all" };

const statusLabels = {
  open: "徵件中",
  upcoming: "即將徵件",
  judging: "評選中",
  completed: "已完成",
  unannounced: "尚未公告"
};

const els = {
  grid: document.querySelector("#awardGrid"),
  count: document.querySelector("#resultCount"),
  empty: document.querySelector("#emptyState"),
  active: document.querySelector("#activeFilters"),
  search: document.querySelector("#searchInput"),
  region: document.querySelector("#regionFilter"),
  status: document.querySelector("#statusFilter"),
  eligibility: document.querySelector("#eligibilityFilter"),
  next: document.querySelector("#nextAward"),
  updated: document.querySelector("#lastUpdated")
};

const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

function filteredAwards() {
  const query = state.query.trim().toLocaleLowerCase("zh-Hant");
  return state.awards.filter(award => {
    const haystack = [award.name, award.organizer, award.topic, award.category].join(" ").toLocaleLowerCase("zh-Hant");
    return (!query || haystack.includes(query))
      && (state.region === "all" || award.region === state.region)
      && (state.status === "all" || award.status === state.status)
      && (state.eligibility === "all" || award.eligibility === state.eligibility);
  });
}

function renderCard(award) {
  return `<article class="award-card">
    <div class="card-top"><span class="region">${escapeHtml(award.region)} · ${escapeHtml(award.type)}</span><span class="status ${escapeHtml(award.status)}">${escapeHtml(statusLabels[award.status])}</span></div>
    <h3>${escapeHtml(award.name)}</h3>
    <p class="organizer">${escapeHtml(award.organizer)}</p>
    <div class="meta-list">
      <div class="meta-row"><span>Podcast 資格</span><span class="eligibility">${escapeHtml(award.eligibility)}</span></div>
      <div class="meta-row"><span>預估監測期</span><span>${escapeHtml(award.watchPeriod)}</span></div>
      <div class="meta-row"><span>主要主題</span><span>${escapeHtml(award.topic)}</span></div>
    </div>
    <a class="card-link" href="${escapeHtml(award.url)}" target="_blank" rel="noreferrer">查看官方來源 <span aria-hidden="true">↗</span></a>
  </article>`;
}

function renderFilters() {
  const chips = [];
  if (state.query) chips.push([`搜尋：${state.query}`, "query"]);
  if (state.region !== "all") chips.push([state.region, "region"]);
  if (state.status !== "all") chips.push([statusLabels[state.status], "status"]);
  if (state.eligibility !== "all") chips.push([state.eligibility, "eligibility"]);
  els.active.innerHTML = chips.map(([label, key]) => `<button class="filter-chip" data-clear="${key}">${escapeHtml(label)} ×</button>`).join("");
}

function render() {
  const awards = filteredAwards();
  els.grid.innerHTML = awards.map(renderCard).join("");
  els.count.textContent = `顯示 ${awards.length}／${state.awards.length} 個獎項`;
  els.empty.hidden = awards.length !== 0;
  renderFilters();
}

function renderNextAward() {
  const candidate = state.awards.find(item => item.status === "open") || state.awards.find(item => item.status === "upcoming");
  els.next.innerHTML = candidate
    ? `<p>近期機會</p><div class="date">${escapeHtml(candidate.deadlineLabel || candidate.watchPeriod)}</div><h3>${escapeHtml(candidate.name)}</h3><p>${escapeHtml(statusLabels[candidate.status])} · ${escapeHtml(candidate.eligibility)}</p>`
    : `<p>下一輪徵件</p><div class="date">持續監測</div><h3>尚無公開中的獎項</h3><p>資料更新後會自動顯示近期機會。</p>`;
}

function bindEvents() {
  els.search.addEventListener("input", event => { state.query = event.target.value; render(); });
  [[els.region, "region"], [els.status, "status"], [els.eligibility, "eligibility"]].forEach(([element, key]) => {
    element.addEventListener("change", event => { state[key] = event.target.value; render(); });
  });
  els.active.addEventListener("click", event => {
    const key = event.target.dataset.clear;
    if (!key) return;
    state[key] = key === "query" ? "" : "all";
    if (key === "query") els.search.value = "";
    else els[key].value = "all";
    render();
  });
}

async function init() {
  try {
    const response = await fetch("./data/awards.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.awards = payload.awards;
    els.updated.textContent = payload.updatedAt;
    els.updated.dateTime = payload.updatedAt;
    renderNextAward();
    render();
    bindEvents();
  } catch (error) {
    els.grid.innerHTML = `<div class="empty-state"><strong>資料載入失敗</strong><span>${escapeHtml(error.message)}</span></div>`;
  }
}

init();
