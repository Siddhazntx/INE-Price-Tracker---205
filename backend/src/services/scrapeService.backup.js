const { scrapeProduct } = require("../scraper/scraper");
const { saveScrapeResult } = require("./productService");

async function runScrapeCycle(productUrl, optionName, options = {}) {
  const maxAttempts = options.maxAttempts || 3;
  const cycleKey = new Date().toISOString();

  let lastError = null;

  for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
    const startedAt = Date.now();

    console.log(
      `\n=== SCRAPE ATTEMPT ${attemptNumber}/${maxAttempts} ===`
    );

    try {
      const result = await scrapeProduct(productUrl, optionName);

      if (!result || !result.success) {
        throw new Error("Scraper returned an unsuccessful result.");
      }

      const durationMs = Date.now() - startedAt;

      const saved = await saveScrapeResult(result, {
        cycleKey,
        attemptNumber,
        durationMs,
      });

      console.log(
        `Scrape attempt ${attemptNumber} succeeded in ${durationMs}ms`
      );

      return {
        success: true,
        cycleKey,
        attemptNumber,
        durationMs,
        data: saved,
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;

      lastError = error;

      console.error(
        `Scrape attempt ${attemptNumber} failed after ${durationMs}ms`
      );
      console.error(error.message);

      if (attemptNumber < maxAttempts) {
        console.log("Retrying...");
      }
    }
  }

  throw new Error(
    `Scrape cycle failed after ${maxAttempts} attempts: ${lastError?.message}`
  );
}

module.exports = {
  runScrapeCycle,
};