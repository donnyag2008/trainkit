// ═══════════════════════════════════════════════════════════
// TrainKit — Offline Productivity Toolkit
// ═══════════════════════════════════════════════════════════

// ─── Currencies ───
const CURRENCIES = [
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧" },
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", flag: "🇮🇩" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", flag: "🇸🇬" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", flag: "🇦🇪" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", flag: "🇸🇦" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", flag: "🇦🇺" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", flag: "🇲🇾" },
  { code: "THB", name: "Thai Baht", symbol: "฿", flag: "🇹🇭" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "🇮🇳" },
];

// Fallback rates vs GBP if API unavailable (22 Jul 2026)
const FALLBACK_RATES = {
  GBP: 1, USD: 1.338, EUR: 1.175, IDR: 23974, SGD: 1.737,
  AED: 4.914, SAR: 5.018, JPY: 218.0, AUD: 1.909, MYR: 5.35, THB: 44.5, INR: 129.8,
};

// Transfer services
const SERVICES = [
  { name: "Wise", color: "#9fe870", feePct: 0.41, feeFixed: 0, markup: 0.0, url: "https://wise.com/send", tagline: "Mid-market rate, low flat fee" },
  { name: "Revolut", color: "#6c63ff", feePct: 0.0, feeFixed: 0, markup: 0.5, url: "https://revolut.com", tagline: "Free plan has weekend markup" },
  { name: "OFX", color: "#00b4d8", feePct: 0.0, feeFixed: 0, markup: 0.8, url: "https://ofx.com", tagline: "Good for large transfers" },
  { name: "Bank Transfer", color: "#94a3b8", feePct: 0.0, feeFixed: 25, markup: 3.0, url: null, tagline: "Typical high-street bank" },
];

// ─── State ───
let rates = { ...FALLBACK_RATES };
let rateDate = "22 Jul 2026 (fallback)";
let activeTool = "fx";

// ─── Utilities ───
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const toolArea = $("#toolArea");

function fmt(n, dp = 2) {
  if (isNaN(n) || !isFinite(n)) return "—";
  return n.toLocaleString("en-GB", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

function crossRate(from, to) {
  return rates[to] / rates[from];
}

function getCur(code) {
  return CURRENCIES.find((c) => c.code === code);
}

function currencyOptions(selected) {
  return CURRENCIES.map(
    (c) => `<option value="${c.code}" ${c.code === selected ? "selected" : ""}>${c.flag} ${c.code}</option>`
  ).join("");
}

// ─── Rate Fetching & Caching ───
const RATE_CACHE_KEY = "trainkit_rates";
const RATE_TIMESTAMP_KEY = "trainkit_rates_ts";

function loadCachedRates() {
  try {
    const cached = localStorage.getItem(RATE_CACHE_KEY);
    const ts = localStorage.getItem(RATE_TIMESTAMP_KEY);
    if (cached && ts) {
      rates = JSON.parse(cached);
      const d = new Date(parseInt(ts));
      rateDate = d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " (cached)";
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

async function fetchLiveRates() {
  try {
    const res = await fetch("/api/rates");
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    if (data.rates) {
      rates = data.rates;
      rateDate = data.date || new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

      // Cache for offline use
      localStorage.setItem(RATE_CACHE_KEY, JSON.stringify(rates));
      localStorage.setItem(RATE_TIMESTAMP_KEY, Date.now().toString());

      // Re-render FX if active
      if (activeTool === "fx") renderFx();
      updateConnectionBadge(true);
    }
  } catch (e) {
    console.log("Using cached/fallback rates:", e.message);
    updateConnectionBadge(false);
  }
}

function updateConnectionBadge(isLive) {
  const badge = $("#connectionBadge");
  const text = $("#connectionText");
  if (isLive) {
    badge.className = "offline-badge online";
    text.textContent = "Rates Live";
  } else if (navigator.onLine) {
    badge.className = "offline-badge online";
    text.textContent = "Works Offline";
  } else {
    badge.className = "offline-badge offline";
    text.textContent = "Offline Mode";
  }
}

// ─── Tool Renderers ───

function renderFx() {
  const fromCode = toolArea.querySelector("#fxFrom")?.value || "GBP";
  const toCode = toolArea.querySelector("#fxTo")?.value || "IDR";
  const amount = toolArea.querySelector("#fxAmount")?.value || "1000";

  toolArea.innerHTML = `
    <h2 class="tool-title">Currency Exchange</h2>
    <p class="tool-desc">Convert &amp; compare transfer services</p>

    <div class="form-row" style="align-items:flex-end">
      <div>
        <label class="form-label">From</label>
        <select class="form-select" id="fxFrom">${currencyOptions(fromCode)}</select>
      </div>
      <button class="swap-btn" id="fxSwap" title="Swap currencies">⇄</button>
      <div>
        <label class="form-label">To</label>
        <select class="form-select" id="fxTo">${currencyOptions(toCode)}</select>
      </div>
    </div>

    <label class="form-label">Amount (${getCur(fromCode).symbol})</label>
    <input class="form-input" type="number" id="fxAmount" value="${amount}" placeholder="e.g. 1000">

    <div id="fxResults"></div>
  `;

  // Bind events
  $("#fxFrom").addEventListener("change", updateFxResults);
  $("#fxTo").addEventListener("change", updateFxResults);
  $("#fxAmount").addEventListener("input", updateFxResults);
  $("#fxSwap").addEventListener("click", () => {
    const f = $("#fxFrom"), t = $("#fxTo");
    const tmp = f.value; f.value = t.value; t.value = tmp;
    // Update the amount label
    const fromCur = getCur(f.value);
    const label = toolArea.querySelector('.form-label:last-of-type');
    if (label) label.textContent = `Amount (${fromCur.symbol})`;
    updateFxResults();
  });

  updateFxResults();
}

function updateFxResults() {
  const fromCode = $("#fxFrom").value;
  const toCode = $("#fxTo").value;
  const amt = parseFloat($("#fxAmount").value) || 0;
  const container = $("#fxResults");

  if (amt <= 0) { container.innerHTML = ""; return; }

  const midRate = crossRate(fromCode, toCode);
  const fromCur = getCur(fromCode);
  const toCur = getCur(toCode);
  const converted = amt * midRate;
  const dp = ["IDR", "JPY"].includes(toCode) ? 0 : 2;

  let svcHtml = SERVICES.map((svc) => {
    const fee = amt * (svc.feePct / 100) + svc.feeFixed;
    const effectiveRate = midRate * (1 - svc.markup / 100);
    const received = (amt - fee) * effectiveRate;
    const totalCost = converted - received;
    const costClass = totalCost < 5 ? "low" : totalCost < 50 ? "mid" : "high";
    const linkHtml = svc.url ? `<a class="svc-link" href="${svc.url}" target="_blank" rel="noopener">Send via ${svc.name} →</a>` : "";
    return `
      <div class="svc-card">
        <div class="svc-header">
          <div>
            <div class="svc-name" style="color:${svc.color}">${svc.name}</div>
            <div class="svc-tagline">${svc.tagline}</div>
          </div>
          <div style="text-align:right">
            <div class="svc-amount">${toCur.symbol} ${fmt(received, dp)}</div>
            <div class="svc-cost ${costClass}">Cost: ${fromCur.symbol}${fmt(totalCost, 2)}</div>
          </div>
        </div>
        ${linkHtml}
      </div>
    `;
  }).join("");

  container.innerHTML = `
    <div class="result-card highlight mt-16">
      <div class="result-label">Mid-Market Rate</div>
      <div class="result-value accent" style="font-size:22px">${toCur.symbol} ${fmt(converted, dp)}</div>
      <div class="result-sub">1 ${fromCode} = ${fmt(midRate, dp > 0 ? 4 : 2)} ${toCode} · ${rateDate}</div>
    </div>
    <div class="mt-20">
      <div class="svc-section-label">Transfer Comparison</div>
      ${svcHtml}
    </div>
    <div class="disclaimer">
      Indicative rates — cached for offline use. Fees are estimates, check each provider for exact pricing.
      Rates auto-refresh when connected.
    </div>
  `;
}

function renderSalary() {
  const annual = toolArea.querySelector("#salaryInput")?.value || "";
  toolArea.innerHTML = `
    <h2 class="tool-title">Salary Breakdown</h2>
    <p class="tool-desc">Annual to monthly, weekly, daily, hourly</p>
    <label class="form-label">Annual Salary (£)</label>
    <input class="form-input" type="number" id="salaryInput" value="${annual}" placeholder="e.g. 85000">
    <div id="salaryResults"></div>
  `;
  $("#salaryInput").addEventListener("input", updateSalaryResults);
  updateSalaryResults();
}

function updateSalaryResults() {
  const a = parseFloat($("#salaryInput").value) || 0;
  const container = $("#salaryResults");
  if (a <= 0) { container.innerHTML = ""; return; }
  const items = [
    { label: "Monthly", value: a / 12 },
    { label: "Weekly", value: a / 52 },
    { label: "Daily (5-day)", value: a / 260 },
    { label: "Hourly (37.5h)", value: a / (52 * 37.5) },
  ];
  container.innerHTML = `<div class="results-grid">${items.map((r) =>
    `<div class="result-card"><div class="result-label">${r.label}</div><div class="result-value">£${fmt(r.value)}</div></div>`
  ).join("")}</div>`;
}

function renderSplit() {
  toolArea.innerHTML = `
    <h2 class="tool-title">Split the Bill</h2>
    <p class="tool-desc">Add tip, split evenly</p>
    <label class="form-label">Bill Total (£)</label>
    <input class="form-input" type="number" id="splitTotal" placeholder="e.g. 86.50">
    <div class="form-row">
      <div><label class="form-label">People</label><input class="form-input" type="number" id="splitPeople" value="2" min="1"></div>
      <div><label class="form-label">Tip %</label><input class="form-input" type="number" id="splitTip" value="10" min="0"></div>
    </div>
    <div id="splitResults"></div>
  `;
  ["splitTotal", "splitPeople", "splitTip"].forEach((id) =>
    $(`#${id}`).addEventListener("input", updateSplitResults)
  );
}

function updateSplitResults() {
  const t = parseFloat($("#splitTotal").value) || 0;
  const p = parseInt($("#splitPeople").value) || 1;
  const tp = parseFloat($("#splitTip").value) || 0;
  const container = $("#splitResults");
  if (t <= 0) { container.innerHTML = ""; return; }
  const tip = t * (tp / 100);
  const grand = t + tip;
  const pp = grand / p;
  container.innerHTML = `<div class="results-grid">
    <div class="result-card"><div class="result-label">Tip</div><div class="result-value">£${fmt(tip)}</div></div>
    <div class="result-card"><div class="result-label">Total</div><div class="result-value">£${fmt(grand)}</div></div>
    <div class="result-card highlight"><div class="result-label">Per Person</div><div class="result-value accent">£${fmt(pp)}</div></div>
  </div>`;
}

function renderPercent() {
  toolArea.innerHTML = `
    <h2 class="tool-title">Percentage Calculator</h2>
    <div class="mode-row">
      <button class="mode-btn active" data-mode="of">X% of Y</button>
      <button class="mode-btn" data-mode="change">% Change</button>
      <button class="mode-btn" data-mode="reverse">Reverse %</button>
    </div>
    <label class="form-label" id="pctLabelA">Percentage</label>
    <input class="form-input" type="number" id="pctA" placeholder="e.g. 15">
    <label class="form-label" id="pctLabelB">Of Value</label>
    <input class="form-input" type="number" id="pctB" placeholder="e.g. 250">
    <div id="pctResults"></div>
  `;

  let pctMode = "of";
  $$(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".mode-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      pctMode = btn.dataset.mode;
      $("#pctA").value = ""; $("#pctB").value = "";
      const labels = {
        of: ["Percentage", "Of Value", "e.g. 15", "e.g. 250"],
        change: ["Old Value", "New Value", "e.g. 200", "e.g. 230"],
        reverse: ["Final Price (£)", "Markup/Tax %", "e.g. 120", "e.g. 20"],
      };
      const l = labels[pctMode];
      $("#pctLabelA").textContent = l[0];
      $("#pctLabelB").textContent = l[1];
      $("#pctA").placeholder = l[2];
      $("#pctB").placeholder = l[3];
      updatePctResults();
    });
  });
  ["pctA", "pctB"].forEach((id) => $(`#${id}`).addEventListener("input", updatePctResults));

  function updatePctResults() {
    const va = parseFloat($("#pctA").value) || 0;
    const vb = parseFloat($("#pctB").value) || 0;
    const container = $("#pctResults");
    if (!va || !vb) { container.innerHTML = ""; return; }
    let text;
    if (pctMode === "of") {
      text = `${va}% of ${vb} = ${fmt((va / 100) * vb)}`;
    } else if (pctMode === "change") {
      text = `${va} → ${vb} = ${fmt(((vb - va) / va) * 100)}% change`;
    } else {
      text = `Pre-${vb}% price = £${fmt(va / (1 + vb / 100))}`;
    }
    container.innerHTML = `<div class="result-card highlight mt-16"><div class="result-value accent" style="font-size:18px">${text}</div></div>`;
  }
}

function renderVat() {
  toolArea.innerHTML = `
    <h2 class="tool-title">VAT Calculator</h2>
    <div class="mode-row">
      <button class="mode-btn active" data-mode="add">Add VAT</button>
      <button class="mode-btn" data-mode="remove">Remove VAT</button>
    </div>
    <label class="form-label" id="vatLabel">Net Amount (£)</label>
    <input class="form-input" type="number" id="vatAmount" placeholder="e.g. 500">
    <label class="form-label">VAT Rate (%)</label>
    <input class="form-input" type="number" id="vatRate" value="20">
    <div id="vatResults"></div>
  `;

  let vatMode = "add";
  $$(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".mode-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      vatMode = btn.dataset.mode;
      $("#vatAmount").value = "";
      $("#vatLabel").textContent = vatMode === "add" ? "Net Amount (£)" : "Gross Amount (£)";
      updateVatResults();
    });
  });
  ["vatAmount", "vatRate"].forEach((id) => $(`#${id}`).addEventListener("input", updateVatResults));

  function updateVatResults() {
    const a = parseFloat($("#vatAmount").value) || 0;
    const r = parseFloat($("#vatRate").value) || 0;
    const container = $("#vatResults");
    if (a <= 0) { container.innerHTML = ""; return; }
    let net, vat, gross;
    if (vatMode === "add") { net = a; vat = a * (r / 100); gross = a + vat; }
    else { gross = a; net = a / (1 + r / 100); vat = gross - net; }
    container.innerHTML = `<div class="results-grid">
      <div class="result-card"><div class="result-label">Net</div><div class="result-value">£${fmt(net)}</div></div>
      <div class="result-card"><div class="result-label">VAT (${r}%)</div><div class="result-value">£${fmt(vat)}</div></div>
      <div class="result-card highlight"><div class="result-label">Gross</div><div class="result-value accent">£${fmt(gross)}</div></div>
    </div>`;
  }
}

// ─── Tool Router ───
const RENDERERS = { fx: renderFx, salary: renderSalary, split: renderSplit, percent: renderPercent, vat: renderVat };

function switchTool(tool) {
  activeTool = tool;
  $$(".nav-btn").forEach((b) => b.classList.toggle("active", b.dataset.tool === tool));
  RENDERERS[tool]();
}

// ─── Navigation ───
$$("#bottomNav .nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => switchTool(btn.dataset.tool));
});

// ─── Network Status ───
window.addEventListener("online", () => { updateConnectionBadge(false); fetchLiveRates(); });
window.addEventListener("offline", () => updateConnectionBadge(false));

// ─── Service Worker Registration ───
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").then((reg) => {
    console.log("SW registered:", reg.scope);
  }).catch((err) => {
    console.log("SW registration failed:", err);
  });
}

// ─── Init ───
loadCachedRates();
switchTool("fx");
fetchLiveRates();
