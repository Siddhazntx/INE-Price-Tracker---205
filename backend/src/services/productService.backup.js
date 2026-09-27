const supabase = require("../config/supabase");

async function saveScrapeResult(result, metadata = {}) {
  if (!result || !result.success) {
    throw new Error("Invalid scrape result.");
  }

  const {
    cycleKey = new Date().toISOString(),
    attemptNumber = 1,
    durationMs = null,
  } = metadata;

  const {
    product,
    option,
    price,
    stock,
  } = result;

  // ==========================================
  // 1. INSERT / UPDATE PRODUCT
  // ==========================================

  const { data: productRow, error: productError } = await supabase
    .from("products")
    .upsert(
      {
        store_product_id: product.storeProductId,
        name: product.name || `Product ${product.storeProductId}`,
        brand: product.brand || null,
        sku: product.sku || null,
        product_url: product.url,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "store_product_id",
      }
    )
    .select()
    .single();

  if (productError) {
    throw new Error(
      `Failed to save product: ${productError.message}`
    );
  }

  // ==========================================
  // 2. INSERT / UPDATE TRACKED OPTION
  // ==========================================

  const { data: optionRow, error: optionError } = await supabase
    .from("tracked_options")
    .upsert(
      {
        product_id: productRow.id,
        option_group: option.group,
        option_value: option.value,
      },
      {
        onConflict: "product_id,option_group,option_value",
      }
    )
    .select()
    .single();

  if (optionError) {
    throw new Error(
      `Failed to save tracked option: ${optionError.message}`
    );
  }

  // ==========================================
  // 3. SAVE PRICE HISTORY
  // ==========================================

  const { data: priceRow, error: priceError } = await supabase
    .from("price_history")
    .insert({
      tracked_option_id: optionRow.id,
      price: price.amount,
      stock_count: stock.count,
      stock_status: stock.status,
    })
    .select()
    .single();

  if (priceError) {
    throw new Error(
      `Failed to save price history: ${priceError.message}`
    );
  }

  // ==========================================
  // 4. SAVE SCRAPE LOG
  // ==========================================

  const { data: logRow, error: logError } = await supabase
    .from("scrape_logs")
    .insert({
      tracked_option_id: optionRow.id,
      cycle_key: cycleKey,
      attempt_number: attemptNumber,
      outcome: "success",
      price: price.amount,
      stock_count: stock.count,
      stock_status: stock.status,
      duration_ms: durationMs,
    })
    .select()
    .single();

  if (logError) {
    throw new Error(
      `Failed to save scrape log: ${logError.message}`
    );
  }

  return {
    product: productRow,
    option: optionRow,
    priceHistory: priceRow,
    scrapeLog: logRow,
  };
}

module.exports = {
  saveScrapeResult,
};