# ⚡ TrainKit — Offline Productivity Tools

Productivity tools that work between tunnels. A PWA built for UK commuters with flaky train WiFi.

## Tools
- **Currency Exchange** — 12 currencies, transfer service comparison (Wise, Revolut, OFX, banks)
- **Salary Breakdown** — Annual to monthly, weekly, daily, hourly
- **Split the Bill** — Tip calculator with per-person split
- **Percentage Calculator** — X% of Y, % change, reverse %
- **VAT Calculator** — Add or remove VAT at any rate

## Architecture
- **Frontend:** Vanilla HTML/CSS/JS (no framework, no build step)
- **Hosting:** Cloudflare Pages
- **API:** Cloudflare Pages Function (`/api/rates`) fetches live exchange rates
- **Caching:** Cloudflare KV (server-side, 30-min TTL) + localStorage (client-side offline)
- **Offline:** Service worker caches all static assets on first visit

## Deploy to Cloudflare Pages

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial TrainKit"
git remote add origin https://github.com/YOUR_USERNAME/trainkit.git
git push -u origin main
```

### 2. Connect to Cloudflare Pages
1. Go to Cloudflare dashboard > Workers & Pages > Create
2. Connect your GitHub repo
3. Build settings:
   - Build command: _(leave empty — no build needed)_
   - Build output directory: `public`

### 3. Set up KV (for rate caching)
1. Go to Workers & Pages > KV > Create namespace > Name it `trainkit-rates`
2. Go to your Pages project > Settings > Functions > KV namespace bindings
3. Add binding: Variable name = `TRAINKIT_KV`, KV namespace = `trainkit-rates`

### 4. Set up Exchange Rate API
1. Get a free API key at https://app.exchangerate-api.com/
2. Go to Pages project > Settings > Environment variables
3. Add: `EXCHANGE_API_KEY` = your key
4. Free tier: 1,500 requests/month (with 30-min caching = ~1,440/month)

### 5. Custom domain (optional)
1. Go to Pages project > Custom domains
2. Add `trainkit.uk` or your chosen domain
3. Cloudflare handles SSL automatically

## Offline behaviour
1. First visit: service worker caches all static files + latest exchange rates
2. Subsequent visits: everything loads from cache instantly
3. When online: rates refresh silently in the background
4. When offline: uses last cached rates with timestamp shown
5. Users can "Add to Home Screen" for native app experience

## Monetisation ideas
- **Wise affiliate link** — earn ~£75 per qualifying referral via "Send via Wise" button
- **Revolut/OFX affiliate** — similar referral programmes
- **Premium tools** — additional calculators behind a one-time purchase
- **Sponsored placement** — featured position in transfer comparison

## Tech stack
- Zero dependencies, zero build step
- Vanilla JS, ~15KB total
- Cloudflare Pages (free tier)
- Cloudflare KV (free tier: 100K reads/day)
- ExchangeRate-API (free tier: 1,500/month)
