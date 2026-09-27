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

    const idMatch = productUrl.match(/\/item\/(\d+)/);
    if (!idMatch) {
      throw new Error(`Invalid product URL. Cannot extract store product ID: ${productUrl}`);
    }
    const extractedStoreProductId = parseInt(idMatch[1], 10);

    await page.goto(productUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(1000);

    const productName = await page.locator("h1").first().innerText().catch(() => null);

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
          force: true
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

      const firstButton = optionButton.first();
      await firstButton.click({
        timeout: 10000,
      });

      // Wait until the option button gains the "opt-chip-on" selected class
      // (the site applies opt-chip-on + sets aria-pressed=true on the active chip)
      await page
        .locator("button.opt-chip-on")
        .filter({ hasText: optionName })
        .waitFor({ state: "attached", timeout: 5000 })
        .catch(() => {
          // Not critical - some pages may not toggle the class immediately.
          // The click was sent; continue.
          console.log(`Option "${optionName}" selection not visually confirmed, continuing.`);
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

    // =========================================================
    // CONSENT MAY APPEAR DYNAMICALLY DURING HOVER
    // =========================================================
    // Handle consent BEFORE waiting for button to become enabled.
    // On some pages the consent dialog appears during the hover
    // sequence and blocks the button-unlock interaction.

    const consentAfterHover = await handleConsent();

    if (!consentAfterHover) {
      throw new Error(
        "Consent scrim appeared during hover and could not be dismissed."
      );
    }

    console.log(
      "Button disabled after mouse:",
      await checkButton.isDisabled()
    );

    // =========================================================
    // WAIT FOR BUTTON TO ENABLE
    // =========================================================

    console.log("Waiting for Check Price button to become enabled...");

    // Wait for the Check Price button to become enabled using
    // Playwright's native locator API (avoids browser-side
    // querySelector Unicode serialization issues).
    await checkButton.waitFor({ state: "visible", timeout: 5000 });
    await checkButton.evaluate(
      (btn) =>
        new Promise((resolve, reject) => {
          if (!btn.disabled) { resolve(); return; }
          const obs = new MutationObserver(() => {
            if (!btn.disabled) { obs.disconnect(); resolve(); }
          });
          obs.observe(btn, { attributes: true, attributeFilter: ["disabled"] });
          setTimeout(() => { obs.disconnect(); reject(new Error("Button enable timeout")); }, 4500);
        })
    );

    console.log("Check Price button is ENABLED.");

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
      timeout: 10000
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

        // Filter to visible price elements (non-strikethrough, non-hidden, contains currency)
        const visiblePriceCandidates = candidates.filter((el) => {
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

        if (visiblePriceCandidates.length === 0) {
          return null;
        }

        // Pick the candidate with the largest computed font-size.
        // The actual selling price is always the large bold number;
        // "Member price" labels are smaller and appear first in DOM order.
        let bestEl = visiblePriceCandidates[0];
        let bestSize = parseFloat(window.getComputedStyle(bestEl).fontSize) || 0;

        for (let i = 1; i < visiblePriceCandidates.length; i++) {
          const el = visiblePriceCandidates[i];
          const sz = parseFloat(window.getComputedStyle(el).fontSize) || 0;
          if (sz > bestSize) {
            bestSize = sz;
            bestEl = el;
          }
        }

        return bestEl.textContent.trim();
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

    const panelText = await page.evaluate((panel) => {
      function getVisibleTextIgnoringStrikethrough(el) {
        if (el.nodeType === Node.TEXT_NODE) return el.textContent;
        if (el.nodeType !== Node.ELEMENT_NODE) return "";
        
        const style = window.getComputedStyle(el);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0" ||
          style.textDecorationLine.includes("line-through") ||
          el.getAttribute("aria-hidden") === "true"
        ) {
          return "";
        }
        
        // Block-level elements should probably add a newline, but space is fine for our regexes.
        let txt = "";
        for (const child of el.childNodes) {
          txt += getVisibleTextIgnoringStrikethrough(child) + " ";
        }
        return txt;
      }
      return getVisibleTextIgnoringStrikethrough(panel);
    }, await offerPanel.elementHandle());

    let stockCount = null;
    let stockStatus = "unknown";
    
    if (/SOLD OUT/i.test(panelText)) {
      stockStatus = "out_of_stock";
    } else if (/AVAILABLE/i.test(panelText) || /READY TO SHIP/i.test(panelText)) {
      stockStatus = "available";
      // Matches: "99 AVAILABLE", "120 UNITS AVAILABLE", "READY TO SHIP · 99 AVAILABLE"
      const match = panelText.match(/(\d+)\s*(?:\w+\s+)?AVAILABLE/i);
      if (match) {
        stockCount = Number(match[1]);
      }
    } else if (/REMAINING/i.test(panelText)) {
      // Matches: "STOCK: 63 REMAINING", "63 REMAINING"
      stockStatus = "available";
      const match = panelText.match(/(\d+)\s*REMAINING/i);
      if (match) {
        stockCount = Number(match[1]);
      }
    } else if (/LAST FEW/i.test(panelText)) {
      // Matches: "LAST FEW: 31"
      stockStatus = "available";
      const match = panelText.match(/LAST FEW[:\s]+(\d+)/i);
      if (match) {
        stockCount = Number(match[1]);
      }
    }

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
        storeProductId: extractedStoreProductId,
        name: productName,
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