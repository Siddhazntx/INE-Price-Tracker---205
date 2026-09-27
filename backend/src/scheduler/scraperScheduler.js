const supabase = require("../config/supabase");
const { runScrapeCycle } = require("../services/scrapeService");

const SCRAPE_INTERVAL_MS = 2 * 60 * 60 * 1000;

let isRunning = false;

async function checkPriceChange(trackedOptionId, productUrl, optionValue) {
  const { data, error } = await supabase
    .from("price_history")
    .select("price, scraped_at")
    .eq("tracked_option_id", trackedOptionId)
    .order("scraped_at", { ascending: false })
    .limit(2);

  if (error) {
    console.error("Error fetching price history for change detection:", error);
    return;
  }

  if (data && data.length === 2) {
    const latestPrice = data[0].price;
    const previousPrice = data[1].price;

    if (latestPrice !== previousPrice) {
      const diff = latestPrice - previousPrice;
      const direction = diff > 0 ? "PRICE INCREASE" : "PRICE DROP";
      const sign = diff > 0 ? "+" : "-";
      
      console.log("\n========================================");
      console.log("PRICE CHANGE DETECTED");
      console.log("========================================");
      console.log(`Product: ${productUrl}`);
      console.log(`Option: ${optionValue || "default"}`);
      console.log(`Previous price: ₹${previousPrice}`);
      console.log(`New price: ₹${latestPrice}`);
      console.log(`Change: ${sign}₹${Math.abs(diff)}`);
      console.log(`Direction: ${direction}`);
      console.log("========================================\n");
    }
  }
}

async function runScheduledScrapes() {
  if (isRunning) {
    console.log("Scheduler is already running. Skipping this cycle.");
    return;
  }

  isRunning = true;
  console.log("=== STARTING SCHEDULED SCRAPE CYCLE ===");

  try {
    const { data: options, error } = await supabase
      .from("tracked_options")
      .select(`
        id,
        option_value,
        scrape_interval_minutes,
        products (
          product_url
        )
      `)
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching active tracked options:", error);
      return;
    }

    if (!options || options.length === 0) {
      console.log("No active tracked options found.");
      return;
    }

    for (const opt of options) {
      const productUrl = opt.products.product_url;
      const optionValue = opt.option_value;
      const trackedOptionId = opt.id;

      try {
        console.log(`Scheduled scraping for ${productUrl} [${optionValue || 'default'}]`);
        const result = await runScrapeCycle(productUrl, optionValue);
        
        if (result && result.success) {
          await checkPriceChange(trackedOptionId, productUrl, optionValue);
        }
      } catch (err) {
        console.error(`Failed scheduled scrape for ${productUrl}:`, err);
      }
    }
  } catch (err) {
    console.error("Critical error in runScheduledScrapes:", err);
  } finally {
    console.log("=== FINISHED SCHEDULED SCRAPE CYCLE ===");
    isRunning = false;
  }
}

function startScheduler() {
  console.log(`Scheduler configured to run every ${SCRAPE_INTERVAL_MS} ms.`);
  
  // Run immediately on boot
  runScheduledScrapes();

  // Schedule recurring interval
  setInterval(runScheduledScrapes, SCRAPE_INTERVAL_MS);
}

module.exports = {
  startScheduler,
  runScheduledScrapes,
};
