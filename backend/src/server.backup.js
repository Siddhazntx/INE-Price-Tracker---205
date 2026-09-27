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
const { saveScrapeResult } = require("./services/productService");

const app = express();

app.use(cors());
app.use(express.json());


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
      .select("*")
      .order("created_at", { ascending: false });

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

    // 1. Scrape website
    const scrapeResult = await scrapeProduct(
      productUrl,
      optionName || null
    );

    // 2. Save scraped result to Supabase
    const savedResult = await saveScrapeResult(scrapeResult);

    // 3. Return saved data
    res.status(201).json({
      success: true,
      data: savedResult,
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