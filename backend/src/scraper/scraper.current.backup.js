const { chromium } = require("playwright");
const config = require("./config");

async function scrapeProduct(productUrl, optionName = null) {
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("\n=== SCRAPING ===");
    console.log(`URL: ${productUrl}`);
    console.log(`Option: ${optionName || "default"}`);

    await page.goto(productUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(1000);

    // =========================================================
    // CONSENT HANDLER
    // =========================================================

    async function handleConsent() {
      const scrim = page.locator(".consent-scrim");

      try {
        // Check whether consent is present.
        const visible = await scrim.isVisible().catch(() => false);

        if (!visible) {
          return true;
        }

        console.log("Consent scrim detected.");

        const allowButton = scrim
          .locator('button:has-text("Allow"), button[aria-label*="Allow"]')
          .first();

        if (!(await allowButton.count())) {
          throw new Error("Consent Allow button not found.");
        }

        console.log("Clicking Allow...");

        await allowButton.click({
          timeout: 5000,
        });

        // The site may keep the scrim element in the DOM even after
        // consent has been accepted. What matters is whether it still
        // blocks pointer events.

        try {
          await page.waitForFunction(
            () => {
              const scrim = document.querySelector(".consent-scrim");

              if (!scrim) {
                return true;
              }

              const style = window.getComputedStyle(scrim);

              // Element removed/hidden.
              if (
                style.display === "none" ||
                style.visibility === "hidden" ||
                style.pointerEvents === "none" ||
                Number(style.opacity) === 0
              ) {
                return true;
              }

              // If the consent dialog itself is gone, the scrim is no
              // longer an active consent blocker.
              const dialog = scrim.querySelector(
                '[role="dialog"][aria-modal="true"]'
              );

              if (!dialog) {
                return true;
              }

              const dialogStyle = window.getComputedStyle(dialog);

              return (
                dialogStyle.display === "none" ||
                dialogStyle.visibility === "hidden" ||
                dialogStyle.pointerEvents === "none"
              );
            },
            {
              timeout: 5000,
              polling: 100,
            }
          );
        } catch {
          throw new Error(
            "Consent was accepted, but the consent overlay is still blocking the page."
          );
        }

        console.log("Consent scrim dismissed.");

        return true;
      } catch (error) {
        console.log("Consent handling:", error.message);
        return false;
      }
    }

    // Initial consent check
    const initialConsentCleared = await handleConsent();

    if (!initialConsentCleared) {
      throw new Error("Initial consent could not be dismissed.");
    }

    // =========================================================
    // SELECT PRODUCT OPTION
    // =========================================================

    if (optionName) {
      // Final safety check immediately before clicking the option.
      const consentClearedBeforeOption = await handleConsent();

      if (!consentClearedBeforeOption) {
        throw new Error(
          "Consent scrim is still blocking the product option."
        );
      }

      const optionButton = page
        .locator(config.selectors.optionButton)
        .filter({ hasText: optionName });

      if (!(await optionButton.count())) {
        throw new Error(`Option not found: ${optionName}`);
      }

      console.log(`Selecting option: ${optionName}`);

      await optionButton.first().click({
        timeout: 10000,
      });

      await page.waitForTimeout(500);
    }

    // =========================================================
    // OFFER PANEL
    // =========================================================

    const offerPanel = page.locator(config.selectors.offerPanel);

    await offerPanel.waitFor({
      state: "visible",
      timeout: 10000,
    });

    // =========================================================
    // CHECK PRICE BUTTON
    // =========================================================

    const checkButton = page.locator(
      'button.ctl-main[aria-label="Check today’s price"]'
    );

    if (!(await checkButton.count())) {
      throw new Error("Check Price button not found.");
    }

    const priceMessage = page.locator(".offer-msg").first();

    const messageBox = await priceMessage.boundingBox();

    if (!messageBox) {
      throw new Error("Could not get price message bounding box.");
    }

    console.log("Moving mouse across actual price message...");

    await page.mouse.move(
      messageBox.x + 5,
      messageBox.y + messageBox.height / 2,
      { steps: 20 }
    );

    await page.mouse.move(
      messageBox.x + messageBox.width / 2,
      messageBox.y + messageBox.height / 2,
      { steps: 30 }
    );

    await page.mouse.move(
      messageBox.x + messageBox.width - 5,
      messageBox.y + messageBox.height / 2,
      { steps: 30 }
    );

    await page.waitForTimeout(500);

    console.log(
      "Button disabled after mouse:",
      await checkButton.isDisabled()
    );

    // =========================================================
    // WAIT FOR BUTTON TO ENABLE
    // =========================================================

    console.log("Waiting for Check Price button to become enabled...");

    await page.waitForFunction(
      () => {
        const button = document.querySelector(
          'button.ctl-main[aria-label="Check today’s price"]'
        );

        return button && !button.disabled;
      },
      {
        timeout: 5000,
        polling: 100,
      }
    );

    console.log("Check Price button is ENABLED.");

    // =========================================================
    // CONSENT MAY APPEAR DYNAMICALLY
    // =========================================================

    const consentCleared = await handleConsent();

    if (!consentCleared) {
      throw new Error(
        "Consent scrim is still visible and is blocking Check Price."
      );
    }

    const scrim = page.locator(".consent-scrim");

    const scrimVisible = await scrim
      .isVisible()
      .catch(() => false);

    console.log(
      "Scrim visible before Check Price:",
      scrimVisible
    );

    if (scrimVisible) {
      throw new Error(
        "Cannot click Check Price because consent scrim is still visible."
      );
    }

    // =========================================================
    // CLICK CHECK PRICE
    // =========================================================

    console.log("Clicking Check Price...");

    await checkButton.click({
      timeout: 10000,
    });

    console.log("Check Price clicked.");

    // =========================================================
    // WAIT FOR PRICE TO RESOLVE
    // =========================================================

    console.log("Waiting for offer-panel to resolve and price to appear...");

    const resolutionStartedAt = Date.now();

    const priceHandle = await page.waitForFunction(
      () => {
        const panel = document.querySelector(".offer-panel");

        if (!panel) {
          return null;
        }

        // Still locked
        if (panel.classList.contains("offer-locked")) {
          return null;
        }

        const text = panel.innerText || "";

        // Still loading
        if (/loading/i.test(text)) {
          return null;
        }

        const candidates = Array.from(
          panel.querySelectorAll('.offer-row > *')
        );

        const visible = candidates.find((el) => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();

          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            style.opacity !== "0" &&
            el.getAttribute("aria-hidden") !== "true" &&
            rect.width > 0 &&
            rect.height > 0 &&
            style.textDecorationLine !== "line-through" &&
            (el.textContent.includes("₹") || el.textContent.includes("$"))
          );
        });

        return visible
          ? visible.textContent.trim()
          : null;
      },
      {
        timeout: config.scraper.resolutionTimeoutMs || 30000,
        polling: 500,
      }
    );

    // Convert Playwright JSHandle to the actual string.
    const rawPrice = await priceHandle.jsonValue();

    // Remove zero-width Unicode characters.
    const price = rawPrice
  ? rawPrice
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, "")
      .replace(/^₹(\d+)$/, (_, digits) => {
        return `₹${Number(digits).toLocaleString("en-IN")}`;
      })
  : null;

    console.log(
      `Offer panel resolved after ${
        Date.now() - resolutionStartedAt
      }ms`
    );

    // =========================================================
    // FINAL PRICE
    // =========================================================

    if (!price) {
      const panelText = await offerPanel.innerText();

      throw new Error(
        `No visible price after resolution. Offer panel says: ${panelText}`
      );
    }

    console.log("VISIBLE PRICE:", price);

    let priceAmount = null;
    if (price) {
      const match = price.match(/[\d,]+/);
      if (match) {
        priceAmount = Number(match[0].replace(/,/g, ""));
      }
    }

    console.log("PRICE AMOUNT:", priceAmount);

    // =========================================================
    // STOCK / AVAILABILITY
    // =========================================================

    const panelText = await offerPanel.innerText();

    const stockMatch = panelText.match(/(?:LAST FEW|STOCK):\s*(\d+)/i);

    const stockCount = stockMatch
      ? Number(stockMatch[1])
      : null;

    const stockStatus = stockCount !== null
      ? "available"
      : "unknown";

    console.log("STOCK COUNT:", stockCount);
    console.log("STOCK STATUS:", stockStatus);

    console.log("\n=== SCRAPE SUCCESS ===");
    console.log("Price:", price);
    console.log("Price amount:", priceAmount);
    console.log("Offer panel:");
    console.log(panelText);

    // =========================================================
    // STRUCTURED RESULT
    // =========================================================

    return {
      success: true,

      product: {
        storeProductId: 2609,
        name: null,
        brand: null,
        sku: null,
        url: productUrl,
      },

      option: {
        group: "Color",
        value: optionName,
      },

      price: {
        amount: priceAmount,
        currency: "INR",
      },

      stock: {
        count: stockCount,
        status: stockStatus,
      },

      raw: {
        stockText: panelText,
      },
    };

  } finally {
    await context.close();
    await browser.close();
  }
}

module.exports = {
  scrapeProduct,
};