// ═══════════════════════════════════════════════════════════
// /api/rates — Cloudflare Pages Function
// Fetches live exchange rates, caches in KV for 30 minutes
// ═══════════════════════════════════════════════════════════
//
// SETUP:
// 1. Create a KV namespace called TRAINKIT_KV in Cloudflare dashboard
// 2. Bind it in wrangler.toml or Pages settings
// 3. Get a free API key from https://app.exchangerate-api.com/
// 4. Set EXCHANGE_API_KEY as an environment variable in Pages settings
//
// Free tier: 1,500 requests/month — with 30-min caching that's ~1,440/month (perfect fit)

const CURRENCIES = ["GBP", "USD", "EUR", "IDR", "SGD", "AED", "SAR", "JPY", "AUD", "MYR", "THB", "INR"];
const CACHE_KEY = "rates_vs_gbp";
const CACHE_TTL = 1800; // 30 minutes in seconds

// Fallback rates if everything fails (22 Jul 2026)
const FALLBACK = {
  GBP: 1, USD: 1.338, EUR: 1.175, IDR: 23974, SGD: 1.737,
  AED: 4.914, SAR: 5.018, JPY: 218.0, AUD: 1.909, MYR: 5.35, THB: 44.5, INR: 129.8,
};

export async function onRequestGet(context) {
  const { env } = context;
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=1800",
    "Access-Control-Allow-Origin": "*",
  };

  try {
    // 1. Check KV cache
    if (env.TRAINKIT_KV) {
      const cached = await env.TRAINKIT_KV.get(CACHE_KEY, { type: "json" });
      if (cached) {
        return new Response(JSON.stringify(cached), { headers });
      }
    }

    // 2. Fetch fresh rates from ExchangeRate-API (free tier)
    const apiKey = env.EXCHANGE_API_KEY;
    if (!apiKey) {
      // No API key configured — return fallback
      return new Response(JSON.stringify({
        rates: FALLBACK,
        date: "22 Jul 2026 (fallback — set EXCHANGE_API_KEY)",
        source: "fallback",
      }), { headers });
    }

    const apiUrl = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/GBP`;
    const apiRes = await fetch(apiUrl);
    const apiData = await apiRes.json();

    if (apiData.result !== "success") {
      throw new Error(apiData["error-type"] || "API error");
    }

    // 3. Extract only the currencies we need
    const ratesVsGbp = { GBP: 1 };
    for (const code of CURRENCIES) {
      if (apiData.conversion_rates[code] !== undefined) {
        ratesVsGbp[code] = apiData.conversion_rates[code];
      }
    }

    const now = new Date();
    const dateStr = now.toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", timeZone: "Europe/London",
    });

    const payload = {
      rates: ratesVsGbp,
      date: dateStr,
      source: "exchangerate-api.com",
    };

    // 4. Cache in KV
    if (env.TRAINKIT_KV) {
      await env.TRAINKIT_KV.put(CACHE_KEY, JSON.stringify(payload), {
        expirationTtl: CACHE_TTL,
      });
    }

    return new Response(JSON.stringify(payload), { headers });

  } catch (error) {
    // Return fallback on any error
    return new Response(JSON.stringify({
      rates: FALLBACK,
      date: "22 Jul 2026 (offline fallback)",
      source: "fallback",
      error: error.message,
    }), { headers });
  }
}
