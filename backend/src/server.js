const express = require("express");
const cors = require("cors");

require("dotenv").config();

console.log("SUPABASE_URL:", process.env.SUPABASE_URL);
console.log(
  "SUPABASE_SECRET_KEY exists:",
  Boolean(process.env.SUPABASE_SECRET_KEY)
);

const supabase = require("./config/supabase");
const { scrapeProduct } = require("./scraper/scraper");
const { runScrapeCycle } = require("./services/scrapeService");
const { startScheduler } = require("./scheduler/scraperScheduler");

const app = express();

app.use(cors());
app.use(express.json());

// Start the automated price tracking scheduler
startScheduler();


// =========================================================
// HEALTH CHECK
// =========================================================

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "ine-price-tracker-backend",
  });
});


// =========================================================
// GET PRODUCTS
// =========================================================

app.get("/api/products", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        tracked_options (
          id,
          option_group,
          option_value,
          price_history (
            price,
            stock_count,
            stock_status,
            scraped_at
          )
        )
      `)
      .order("created_at", { ascending: false })
      .order("scraped_at", { foreignTable: "tracked_options.price_history", ascending: false })
      .limit(1, { foreignTable: "tracked_options.price_history" })
      .eq("tracked_options.is_active", true);

    if (error) {
      console.error("Supabase error:", error);

      return res.status(500).json({
        error: "Failed to fetch products",
      });
    }

    res.json({
      products: data,
    });
  } catch (error) {
    console.error("Server error:", error);

    res.status(500).json({
      error: "Internal server error",
    });
  }
});

// =========================================================
// GET OPTION HISTORY
// =========================================================

app.get("/api/options/:id/history", async (req, res) => {
  try {
    const optionId = req.params.id;
    
    const { data: priceHistory, error: priceError } = await supabase
      .from("price_history")
      .select("tracked_option_id, price, stock_count, stock_status, scraped_at")
      .eq("tracked_option_id", optionId)
      .order("scraped_at", { ascending: false });

    const { data: scrapeLogs, error: logError } = await supabase
      .from("scrape_logs")
      .select("tracked_option_id, attempt_number, outcome, price, stock_count, stock_status, attempted_at")
      .eq("tracked_option_id", optionId)
      .order("attempted_at", { ascending: false });

    if (priceError || logError) {
      console.error("Supabase error:", priceError || logError);
      return res.status(500).json({ error: "Failed to fetch history" });
    }

    res.json({
      priceHistory: priceHistory || [],
      scrapeLogs: scrapeLogs || [],
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =========================================================
// EXPORT CSV
// =========================================================
app.get("/api/export/csv", async (req, res) => {
  try {
    const { data: logs, error } = await supabase
      .from("scrape_logs")
      .select(`
        attempted_at,
        outcome,
        price,
        stock_status,
        tracked_options!inner (
          option_value,
          products!inner (
            product_url,
            name
          )
        )
      `)
      .order("attempted_at", { ascending: true });

    if (error) {
      console.error("Supabase error exporting CSV:", error);
      return res.status(500).send("Error exporting CSV");
    }

    const headers = ["store_product_id", "product_name", "selected_option", "timestamp", "price", "stock", "outcome"];
    const rows = logs.map(log => {
      const p = log.tracked_options.products;
      const opt = log.tracked_options;
      const storeProductId = p.product_url ? p.product_url.split("/").pop() : "";
      
      return [
        storeProductId,
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${(opt.option_value || '').replace(/"/g, '""')}"`,
        new Date(log.attempted_at).toISOString(),
        log.outcome === "success" ? (log.price !== null ? log.price : "") : "",
        log.outcome === "success" ? (log.stock_status || "") : "",
        log.outcome
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=\"scrape_history.csv\"");
    res.send(csvContent);
  } catch (error) {
    console.error("CSV Export error:", error);
    res.status(500).send("Internal server error");
  }
});


// =========================================================
// EXTERNAL SCHEDULER TRIGGER
// =========================================================

app.post("/api/scheduler/run", async (req, res) => {
  const secret = req.headers.authorization?.replace("Bearer ", "") || req.query.secret;
  if (!process.env.SCHEDULER_SECRET) {
    return res.status(500).json({ error: "SCHEDULER_SECRET not configured on server" });
  }
  if (secret !== process.env.SCHEDULER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { runScheduledScrapes } = require("./scheduler/scraperScheduler");
  
  // Run it asynchronously so we don't block the HTTP request if it takes a while
  runScheduledScrapes().catch(err => console.error("External scrape trigger failed:", err));

  res.json({ success: true, message: "Scheduled scrape cycle triggered" });
});

// =========================================================
// SEARCH PROXY (CACHED, FILTERED)
// =========================================================

let cachedProducts = null;
let cacheTime = 0;

async function getAllProducts() {
  if (cachedProducts && Date.now() - cacheTime < 5 * 60 * 1000) {
    return cachedProducts;
  }
  
  const allResults = [];
  const limit = 60;
  
  // fetch first page to get total
  const first = await fetch(`https://demo.inelabteamdev.com/api/v2/listings?page=1&limit=${limit}`).then(r => r.json());
  allResults.push(...first.results);
  
  const totalPages = first.totalPages;
  const promises = [];
  for (let i = 2; i <= totalPages; i++) {
    promises.push(fetch(`https://demo.inelabteamdev.com/api/v2/listings?page=${i}&limit=${limit}`).then(r => r.json()));
  }
  
  const rest = await Promise.all(promises);
  for (const page of rest) {
    allResults.push(...page.results);
  }
  
  cachedProducts = allResults;
  cacheTime = Date.now();
  return allResults;
}

app.get("/api/search", async (req, res) => {
  try {
    const q = (req.query.q || "").toLowerCase();
    
    if (!q) {
      return res.json({ results: [] });
    }
    
    const all = await getAllProducts();
    const filtered = all.filter(p => 
      (p.name && p.name.toLowerCase().includes(q)) || 
      (p.description && p.description.toLowerCase().includes(q))
    ).slice(0, 10);
    
    res.json({ results: filtered });
  } catch (error) {
    console.error("Search proxy error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// =========================================================
// CREATE PRODUCT
// =========================================================

app.post("/api/products", async (req, res) => {
  try {
    const { productUrl, optionName } = req.body;

    // Validate request
    if (!productUrl) {
      return res.status(400).json({
        error: "productUrl is required",
      });
    }

    console.log("\n=== API PRODUCT SCRAPE ===");
    console.log("URL:", productUrl);
    console.log("Option:", optionName || "default");

    const cycleResult = await runScrapeCycle(
      productUrl,
      optionName || null
    );

    res.status(201).json({
      success: true,
      data: cycleResult.data,
    });
  } catch (error) {
    console.error("Product scrape/save failed:", error);

    res.status(500).json({
      success: false,
      error: error.message || "Failed to scrape product",
    });
  }
});


// =========================================================
// SCRAPE PRODUCT
// =========================================================

app.post("/api/scrape", async (req, res) => {
  try {
    const { url, option } = req.body;

    if (!url) {
      return res.status(400).json({
        error: "Product URL is required",
      });
    }

    console.log("\n=== API SCRAPE REQUEST ===");
    console.log("URL:", url);
    console.log("Option:", option || "default");

    const result = await scrapeProduct(
      url,
      option || null
    );

    res.json(result);

  } catch (error) {
    console.error("Scraping error:", error);

    res.status(500).json({
      success: false,
      error: error.message || "Failed to scrape product",
    });
  }
});


// =========================================================
// START SERVER
// =========================================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});