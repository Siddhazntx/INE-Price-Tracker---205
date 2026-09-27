# INE Product Price Tracker

INE Product Price Tracker is a full-stack application for tracking prices and availability on the INE-hosted mock storefront. Users can search the catalogue, choose a product, enter an option to monitor, and start a scrape from the dashboard. Successful results are stored in Supabase and presented with the latest price and stock information.

The backend also runs recurring scrape cycles for active tracked options and records attempt outcomes. The dashboard exposes price history, scrape logs, and a CSV download. This repository contains the application code and a manual scheduler trigger; deployment to Vercel or Render and configuration of an external cron provider are not verified here.

## Features

- Search storefront listings by partial or full text in product names and descriptions. Search results are limited to ten and cached in backend memory for five minutes. No matches return an empty results array; the current form has no dedicated no-results message.
- Select a search result to populate its storefront product URL, or paste a URL directly. Enter the option name in the tracking form.
- Scrape the selected product and option, then upsert product and tracked-option records in Supabase.
- Extract the visible selling price and stock status/count from the rendered storefront page.
- Retry a scrape cycle up to three times by default and record failed attempts when a tracked-option ID is available.
- Show each tracked option's latest stored price and stock, its price history, and its scrape log.
- Export scrape history as CSV from the dashboard.
- Run a separate headed Playwright inspection script for storefront discovery. The normal `scrapeProduct()` path runs Chromium headlessly.
- Start recurring backend scraping at startup and repeat on a two-hour interval.

## Architecture

The frontend is a React 18 application built with Vite. It loads products and option history from the Express API, and submits search and tracking requests to the same backend. The backend uses Playwright to interact with the storefront and the Supabase JavaScript client to persist product, option, price-history, and scrape-log data.

```text
User
  -> React/Vite dashboard
  -> Express API
  -> Playwright scraper -> INE mock storefront
  -> Supabase/PostgreSQL
```

The source is compatible with the intended Vercel frontend and Render backend hosting, but this repository contains no Vercel or Render deployment configuration, so those deployments are not confirmed by the code.

### Scheduled flow

When `src/server.js` starts, it starts the in-process scheduler. The scheduler runs a scrape cycle immediately and then every two hours. `POST /api/scheduler/run` also allows an external scheduler to trigger a cycle with `SCHEDULER_SECRET`. No external cron-provider configuration is included or verified. An in-process interval may not run while a hosted service is asleep.

## Scraping Approach

The scraper uses Playwright because the storefront renders its product options, consent UI, price, and stock in the browser. It opens the supplied product URL with `domcontentloaded` and a 30-second navigation timeout, waits briefly for the UI, handles the consent overlay, and selects an option by matching its visible option text when one is supplied.

To unlock the price, the scraper moves the pointer across the offer-message area and waits for the Check Price button to become enabled. After clicking, it polls the offer panel for a visible price candidate, filters out hidden and struck-through values, and selects the largest visible currency value. It normalizes the price to an INR numeric amount. Stock text is collected from visible, non-struck-through panel content and interpreted from storefront labels such as `SOLD OUT`, `AVAILABLE`, `READY TO SHIP`, `REMAINING`, and `LAST FEW`.

The scraper waits for asynchronous page changes and has explicit timeouts, but storefront behavior can still vary or fail. If a valid visible price is not found, it throws instead of creating a success result with an empty price. Product name is read from the page's first `h1`; brand and SKU are currently stored as `null`, and the option group is currently set to `Color`.

For a headed inspection run, execute `node src/scraper/inspectProduct.js` from `backend/`. This is a separate discovery utility with a sample product URL; it is not the mode used by the application scraper.

## Retry and Failure Handling

`runScrapeCycle()` defaults to three attempts (`options.maxAttempts || 3`). It catches scraper and save errors per attempt, records duration, and immediately proceeds to the next attempt; the active service does not use exponential backoff. A separate jittered retry helper exists in `src/utils/retry.js`, but it is not called by `runScrapeCycle()`.

On success, the product service saves the price-history row and a `success` scrape-log row. On failure, it writes a `retried` row for an attempt that will be followed by another attempt, or a `failed` row for the last attempt. Failure rows are recorded only when the service can resolve a tracked option from the product URL and option name, or receives an explicit tracked-option ID. A first-time product that fails before a tracked option exists may therefore have no database failure row.

Failed attempts do not receive fabricated price or stock values. The history API and dashboard show their outcome and leave price/stock blank; the dashboard does not currently display the stored error message fields.

## Product Search

The dashboard sends the search text to `GET /api/search?q=...`. The backend loads the storefront's paginated listings, caches them in memory for five minutes, and performs a case-insensitive substring match against each listing's name and description. It returns up to ten matches. An empty query or a query with no matches returns `{ "results": [] }`.

Selecting a result sets the tracking form's URL to `https://demo.inelabteamdev.com/item/{id}`. The option name remains a text input; the frontend does not fetch or render an option list from the search result.

## Price History and Scrape Logs

Successful scrapes upsert the product and tracked option, insert a row in `price_history`, and write a success row to `scrape_logs`. The dashboard requests history for each tracked option using `GET /api/options/:id/history` and displays price, stock, timestamps, attempts, and outcomes in scrollable tables.

Failure rows use the `retried` and `failed` outcomes and are included in the per-option scrape-log response. Failed rows have no price or stock values. The UI distinguishes success, retried, and failed outcomes, but does not currently render the database error details.

## CSV Export

The dashboard's **Export CSV** link downloads `GET /api/export/csv` as `scrape_history.csv`. The columns are:

- `store_product_id`
- `product_name`
- `selected_option`
- `timestamp` (UTC ISO 8601)
- `price`
- `stock` (stock status)
- `outcome`

The backend derives the store product ID from the saved product URL. Failed and retried attempts have blank price and stock fields; their outcome remains in the CSV.

## API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Basic service health response |
| `GET` | `/api/search?q=...` | Search storefront product listings |
| `GET` | `/api/products` | List saved products with tracked options and latest price history |
| `POST` | `/api/products` | Scrape and save a product; JSON body: `{ "productUrl": "...", "optionName": "..." }` |
| `GET` | `/api/options/:id/history` | Return price history and scrape logs for a tracked option |
| `GET` | `/api/export/csv` | Download scrape history as CSV |
| `POST` | `/api/scheduler/run` | Trigger scheduled scraping; requires the scheduler secret as a Bearer token or `secret` query parameter |
| `POST` | `/api/scrape` | Run a scrape without the save cycle; JSON body: `{ "url": "...", "option": "..." }` |

## Environment Variables

| Variable | Used by | Purpose |
|---|---|---|
| `SUPABASE_URL` | Backend | Supabase project URL; required during backend startup |
| `SUPABASE_SECRET_KEY` | Backend | Supabase server credential; required during backend startup |
| `PORT` | Backend | HTTP port; defaults to `3000` |
| `SCHEDULER_SECRET` | Backend | Protects `POST /api/scheduler/run`; required to use that endpoint |
| `VITE_API_URL` | Frontend | Backend base URL; defaults to `http://localhost:3000` |

Never commit real secret values to Git.

The current `backend/.env.example` uses the name `SUPABASE_SERVICE_ROLE_KEY`, but the active backend source reads `SUPABASE_SECRET_KEY`; configure the variable name expected by the source. `INE_BASE_URL` is declared in scraper config but the active scraper accepts a complete product URL and navigates to that URL directly. `CRON_SECRET` is not read by the active source.

## Local Development

Requirements: Node.js and npm. The backend requires Chromium for Playwright.

### Backend

```bash
cd backend
npm install
npx playwright install chromium
```

Create `backend/.env` with `SUPABASE_URL` and `SUPABASE_SECRET_KEY`. Set `PORT` if the default port is unsuitable. Set `SCHEDULER_SECRET` if using the scheduler trigger endpoint.

Start the backend in development mode:

```bash
npm run dev
```

Or start it normally:

```bash
npm start
```

Both commands start the in-process scheduler as part of the server startup.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
```

Set `VITE_API_URL` to the backend origin when it is not `http://localhost:3000`, then start Vite:

```bash
npm run dev
```

Build and preview the production frontend with:

```bash
npm run build
npm run preview
```

The frontend fetches the product list on mount and refreshes it after a successful product submission. The package manifests do not define an automated test script; the repository includes manual Node scripts that exercise the live storefront and/or Supabase, so running them can perform real network requests and database writes.
