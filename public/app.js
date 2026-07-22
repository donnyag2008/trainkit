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

  // Show mid-market rate immediately
  container.innerHTML = `
    <div class="result-card highlight mt-16">
      <div class="result-label">Mid-Market Rate</div>
      <div class="result-value accent" style="font-size:22px">${toCur.symbol} ${fmt(converted, dp)}</div>
      <div class="result-sub">1 ${fromCode} = ${fmt(midRate, dp > 0 ? 4 : 2)} ${toCode} · ${rateDate}</div>
    </div>
    <div class="mt-20">
      <div class="svc-section-label">Transfer Comparison</div>
      <div id="svcCards" style="opacity:0.5"><div class="svc-card"><div style="color:#64748b;text-align:center;padding:8px">Loading live provider rates...</div></div></div>
    </div>
  `;

  // Fetch live comparison data
  fetchComparison(fromCode, toCode, amt, midRate, fromCur, toCur, dp, converted);
}

// Known provider colors and URLs
const PROVIDER_META = {
  wise: { color: "#9fe870", url: "https://wise.com/send" },
  revolut: { color: "#6c63ff", url: "https://revolut.com" },
  ofx: { color: "#00b4d8", url: "https://ofx.com" },
  currencyfair: { color: "#42b983", url: "https://currencyfair.com" },
  xe: { color: "#00a4e4", url: "https://xe.com" },
  remitly: { color: "#3dba73", url: "https://remitly.com" },
  westernunion: { color: "#ffdd00", url: "https://westernunion.com" },
  moneygram: { color: "#ff6600", url: "https://moneygram.com" },
  worldremit: { color: "#753bbd", url: "https://worldremit.com" },
};

async function fetchComparison(fromCode, toCode, amt, midRate, fromCur, toCur, dp, converted) {
  const svcContainer = document.getElementById("svcCards");
  if (!svcContainer) return;

  try {
    const res = await fetch(`https://api.wise.com/v4/comparisons/?sourceCurrency=${fromCode}&targetCurrency=${toCode}&sendAmount=${Math.round(amt)}`);
    if (!res.ok) throw new Error("API error");
    const wiseData = await res.json();

    // Parse Wise comparison response into provider list
    const providers = [];
    if (Array.isArray(wiseData)) {
      for (const provider of wiseData) {
        if (!provider.quotes || provider.quotes.length === 0) continue;
        let best = provider.quotes[0];
        for (const q of provider.quotes) {
          const qRcv = (amt - (q.fee || 0)) * (q.rate || 0);
          const bRcv = (amt - (best.fee || 0)) * (best.rate || 0);
          if (qRcv > bRcv) best = q;
        }
        const received = (amt - (best.fee || 0)) * (best.rate || 0);
        providers.push({ name: provider.name || provider.alias, alias: provider.alias || "", fee: best.fee || 0, rate: best.rate || 0, received });
      }
      providers.sort((a, b) => b.received - a.received);
    }
    const data = { providers };

    if (data.providers && data.providers.length > 0) {
      // Render live provider data
      const html = data.providers.slice(0, 6).map((p) => {
        const alias = (p.alias || p.name || "").toLowerCase().replace(/\s+/g, "");
        const meta = PROVIDER_META[alias] || {};
        const color = meta.color || "#94a3b8";
        const url = meta.url;
        const costInFrom = amt - (p.received / midRate);
        const costClass = costInFrom < 5 ? "low" : costInFrom < 30 ? "mid" : "high";
        const linkHtml = url ? `<a class="svc-link" href="${url}" target="_blank" rel="noopener">Send via ${p.name} →</a>` : "";
        const feeText = p.fee > 0 ? `Fee: ${fromCur.symbol}${fmt(p.fee, 2)}` : "No fee";
        return `
          <div class="svc-card">
            <div class="svc-header">
              <div>
                <div class="svc-name" style="color:${color}">${p.name}</div>
                <div class="svc-tagline">${feeText} · Rate: ${fmt(p.rate, dp > 0 ? 4 : 2)}</div>
              </div>
              <div style="text-align:right">
                <div class="svc-amount">${toCur.symbol} ${fmt(p.received, dp)}</div>
                <div class="svc-cost ${costClass}">Cost: ${fromCur.symbol}${fmt(Math.max(0, costInFrom), 2)}</div>
              </div>
            </div>
            ${linkHtml}
          </div>
        `;
      }).join("");

      svcContainer.innerHTML = html;
      svcContainer.style.opacity = "1";

      // Add disclaimer
      const disclaimer = document.createElement("div");
      disclaimer.className = "disclaimer";
      disclaimer.textContent = `Live rates from Wise Comparison API · Updated ${new Date(data.fetched).toLocaleTimeString("en-GB")}`;
      svcContainer.parentNode.appendChild(disclaimer);
      return;
    }
    throw new Error("No providers");
  } catch (e) {
    // Fallback to static estimates
    const fallbackHtml = SERVICES.map((svc) => {
      const fee = amt * (svc.feePct / 100) + svc.feeFixed;
      const effectiveRate = midRate * (1 - svc.markup / 100);
      const received = (amt - fee) * effectiveRate;
      const lostInTarget = converted - received;
      const costInFrom = lostInTarget / midRate;
      const costClass = costInFrom < 5 ? "low" : costInFrom < 30 ? "mid" : "high";
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
              <div class="svc-cost ${costClass}">Cost: ${fromCur.symbol}${fmt(costInFrom, 2)}</div>
            </div>
          </div>
          ${linkHtml}
        </div>
      `;
    }).join("");
    svcContainer.innerHTML = fallbackHtml;
    svcContainer.style.opacity = "1";

    const disclaimer = document.createElement("div");
    disclaimer.className = "disclaimer";
    disclaimer.textContent = "Estimated rates (offline fallback). Fees are approximate — check each provider for exact pricing.";
    svcContainer.parentNode.appendChild(disclaimer);
  }
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
