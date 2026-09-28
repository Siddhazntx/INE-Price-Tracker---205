# INE Product Price Tracker

INE Product Price Tracker searches the INE-hosted mock storefront and tracks the price and availability of a selected product option. It uses a React dashboard, an Express API, Playwright for browser-based scraping, and Supabase for persistence.

## Demo

[**▶️ Watch the scraper demo**](https://drive.google.com/file/d/1sEBLsstkFdfvUPyQboS9_o0a6IxgBull/view?usp=drive_link)

## Architecture

The production backend runs on Render. cron-job.org triggers its authenticated scheduler endpoint every two hours; the configuration and a real triggered production scrape cycle have been verified.

```mermaid
flowchart LR
  User --> Frontend[React and Vite frontend - Vercel target]
  Frontend --> Backend[Express API - Render target]
  Cron[cron-job.org] -->|POST every 2 hours| Trigger[Render /api/scheduler/run]
  Trigger --> Cycle[Scrape cycle]
  Cycle --> Scraper[Playwright]
  Scraper --> Storefront[INE Mock Store]
  Storefront --> Database[(Supabase PostgreSQL)]
```

## Scraping & Reliability

- Playwright is used because product options, consent, price, and stock are rendered in the browser.
- The scraper selects the requested option and extracts a visible selling price and stock status/count from the offer panel.
- `runScrapeCycle()` retries up to three times by default. Attempts are immediate; the separate backoff helper is not used by this service.
- Failed attempts are recorded as `retried` or `failed` when a tracked-option ID is available. First-time products without an existing option may have no failure log.
- A scrape error or missing visible price does not enter the success-save path. Successful database writes are separate operations, not a single transaction.

```mermaid
flowchart TD
  Start[Start scrape cycle] --> Attempt[Run scrape attempt]
  Attempt --> Scrape[Load product and extract price/stock]
  Scrape --> Result{Valid successful result?}
  Result -->|Yes| Save[Persist product, option, history, success log]
  Save --> Done[Return success]
  Result -->|No or save error| Failure[Capture error and duration]
  Failure --> HasId{Tracked-option ID available?}
  HasId -->|Yes| Log[Record retried or failed attempt]
  HasId -->|No| Skip[Failure log cannot be inserted]
  Log --> More{Attempts remain?}
  Skip --> More
  More -->|Yes| Attempt
  More -->|No| Stop[Return scrape-cycle failure]
```

## Dashboard

- Search by partial or full product name; choose a result or paste a product URL, then enter an option name.
- View tracked products with current stored price and stock information.
- Open per-option price history and scrape logs.
- Download scrape history from the **Export CSV** link.

## Scheduling

The backend starts an in-process scrape cycle at startup and repeats it every two hours while running. Because Render's free-tier service can sleep, cron-job.org is configured with `0 */2 * * *` to send `POST` requests every two hours to `https://ine-price-tracker-205.onrender.com/api/scheduler/run` with `Authorization: Bearer <SCHEDULER_SECRET>`. The secret value is not documented. The trigger returns after starting the cycle; it does not wait for scraping to finish.

## Production Verification

The cron-job.org test returned `200 OK` with `{"success":true,"message":"Scheduled scrape cycle triggered"}`. Render logs confirmed a triggered cycle processed multiple tracked products, loaded dynamically rendered prices with Playwright, handled delayed offer panels, detected and recorded price changes, and completed. One consent-overlay failure was retried successfully. Stock is recorded when available; otherwise it remains unknown.

## Local Development

Install dependencies and Chromium for Playwright:

```bash
cd backend
npm install
npx playwright install chromium
```

Create `backend/.env` with `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Optionally set `PORT` (defaults to `3000`) and `SCHEDULER_SECRET` (for the scheduler trigger). Never commit real secret values to Git. The example file currently names `SUPABASE_SERVICE_ROLE_KEY`; the active code expects `SUPABASE_SECRET_KEY`.

Start the backend with `npm run dev` or `npm start`. In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Set frontend `VITE_API_URL` when the backend is not at `http://localhost:3000`. Build the frontend with `npm run build` from `frontend/`.

For implementation details, constraints, and development notes, see [DESIGN_NOTE.md](DESIGN_NOTE.md).
