const {
  saveScrapeResult,
  saveScrapeFailure,
  findTrackedOption,
} = require("./productService");
const { scrapeProduct } = require("../scraper/scraper");

async function runScrapeCycle(productUrl, optionName, options = {}) {
  const maxAttempts = options.maxAttempts || 3;
  const cycleKey = new Date().toISOString();

  let lastError = null;
  let trackedOptionId = options.trackedOptionId || null;

  if (!trackedOptionId) {
    try {
      const trackedOption = await findTrackedOption(
        productUrl,
        optionName
      );

      trackedOptionId = trackedOption?.id || null;
    } catch (error) {
      console.error(
        "Could not resolve tracked option for scrape logging:",
        error.message
      );
    }
  }

  console.log("Resolved trackedOptionId:", trackedOptionId);

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

      if (trackedOptionId) {
        try {
          await saveScrapeFailure({
            trackedOptionId,
            cycleKey,
            attemptNumber,
            durationMs,
            error,
            outcome:
              attemptNumber < maxAttempts
                ? "retried"
                : "failed",
          });
        } catch (logError) {
          console.error(
            "Failed to save scrape failure log:",
            logError.message
          );
        }
      }

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