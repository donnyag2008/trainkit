// ═══════════════════════════════════════════════════════════
// /api/compare — Cloudflare Pages Function
// Proxies the Wise Comparison API for real provider pricing
// ═══════════════════════════════════════════════════════════
//
// Usage: /api/compare?source=GBP&target=IDR&amount=1000
//
// Returns real fees and rates from Wise, Revolut, OFX, banks etc.
// The Wise Comparison API is public (no auth needed) and updates hourly.
// We cache results in KV for 30 minutes to stay within fair-use limits.

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const source = (url.searchParams.get("source") || "GBP").toUpperCase();
  const target = (url.searchParams.get("target") || "IDR").toUpperCase();
  const amount = parseInt(url.searchParams.get("amount") || "1000");

  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=1800",
    "Access-Control-Allow-Origin": "*",
  };

  const cacheKey = `compare_${source}_${target}_${amount}`;

  try {
    // 1. Check KV cache
    if (env.TRAINKIT_KV) {
      const cached = await env.TRAINKIT_KV.get(cacheKey, { type: "json" });
      if (cached) {
        return new Response(JSON.stringify(cached), { headers });
      }
    }

    // 2. Fetch from Wise Comparison API
    const wiseUrl = `https://api.wise.com/v4/comparisons/?sourceCurrency=${source}&targetCurrency=${target}&sendAmount=${amount}`;
    const wiseRes = await fetch(wiseUrl, {
      headers: {
        "Accept": "application/json",
        "User-Agent": "TrainKit/1.0",
      },
    });

    if (!wiseRes.ok) {
      throw new Error(`Wise API returned ${wiseRes.status}`);
    }

    const wiseData = await wiseRes.json();

    // 3. Parse provider data into a clean format
    const providers = [];

    if (Array.isArray(wiseData)) {
      for (const provider of wiseData) {
        // Each provider may have multiple quotes (different countries)
        // Take the best (cheapest) quote per provider
        if (!provider.quotes || provider.quotes.length === 0) continue;

        // Find the cheapest quote for this provider
        let bestQuote = provider.quotes[0];
        for (const q of provider.quotes) {
          const qReceived = (amount - (q.fee || 0)) * (q.rate || 0);
          const bestReceived = (amount - (bestQuote.fee || 0)) * (bestQuote.rate || 0);
          if (qReceived > bestReceived) bestQuote = q;
        }

        const received = (amount - (bestQuote.fee || 0)) * (bestQuote.rate || 0);

        providers.push({
          name: provider.name || provider.alias || "Unknown",
          alias: provider.alias || "",
          type: provider.type || "",
          logo: provider.logos?.[0] || null,
          fee: bestQuote.fee || 0,
          rate: bestQuote.rate || 0,
          markup: bestQuote.markup || 0,
          received: Math.round(received * 100) / 100,
          speed: bestQuote.speed || null,
        });
      }

      // Sort by received amount (best deal first)
      providers.sort((a, b) => b.received - a.received);
    }

    const payload = {
      source,
      target,
      amount,
      providers,
      fetched: new Date().toISOString(),
    };

    // 4. Cache in KV for 30 minutes
    if (env.TRAINKIT_KV) {
      await env.TRAINKIT_KV.put(cacheKey, JSON.stringify(payload), {
        expirationTtl: 1800,
      });
    }

    return new Response(JSON.stringify(payload), { headers });

  } catch (error) {
    return new Response(JSON.stringify({
      source,
      target,
      amount,
      providers: [],
      error: error.message,
    }), { headers, status: 502 });
  }
}
