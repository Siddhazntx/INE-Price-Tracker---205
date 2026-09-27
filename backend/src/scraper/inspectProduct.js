// const { chromium } = require("playwright");

// const PRODUCT_URL = "https://demo.inelabteamdev.com/item/2609";

// async function inspectProduct() {
//   const browser = await chromium.launch({
//     headless: false,
//     slowMo: 200,
//   });

//   const page = await browser.newPage();

//   try {
//     // =========================================================
//     // 1. OPEN PRODUCT
//     // =========================================================

//     console.log("\n=== OPENING PRODUCT PAGE ===");
//     console.log(PRODUCT_URL);

//     await page.goto(PRODUCT_URL, {
//       waitUntil: "domcontentloaded",
//       timeout: 30000,
//     });

//     console.log("Page loaded.");

//     await page.waitForTimeout(1500);

//     // =========================================================
//     // 2. COOKIE BANNER
//     // =========================================================

//     console.log("\n=== COOKIE BANNER ===");

//     const allowButton = page.getByRole("button", {
//       name: /allow/i,
//     });

//     if (await allowButton.count()) {
//       console.log("Cookie banner found — clicking Allow.");

//       await allowButton.click();

//       await page.waitForTimeout(500);
//     } else {
//       console.log("No cookie banner found.");
//     }

//     // =========================================================
//     // 3. BASIC PAGE INFORMATION
//     // =========================================================

//     console.log("\n=== PAGE TITLE ===");
//     console.log(await page.title());

//     console.log("\n=== PAGE URL ===");
//     console.log(page.url());

//     // =========================================================
//     // 4. PRODUCT OPTION DISCOVERY
//     // =========================================================

//     console.log("\n=== PRODUCT OPTIONS ===");

//     const options = page.locator("button.opt-chip");

//     const optionCount = await options.count();

//     console.log(`Found ${optionCount} option buttons.`);

//     for (let i = 0; i < optionCount; i++) {
//       const option = options.nth(i);

//       console.log(`\n--- Option ${i + 1} ---`);
//       console.log("Text:", await option.innerText());
//       console.log(
//         "outerHTML:",
//         await option.evaluate((el) => el.outerHTML)
//       );
//     }

//     // =========================================================
//     // 5. FIND OFFER PANEL
//     // =========================================================

//     console.log("\n=== OFFER PANEL DISCOVERY ===");

//     const offerPanel = page.locator(".offer-panel");

//     if (!(await offerPanel.count())) {
//       throw new Error("Could not find .offer-panel");
//     }

//     console.log("Offer panel found.");

//     console.log("\n=== BEFORE: OFFER PANEL OUTERHTML ===");

//     console.log(
//       await offerPanel.evaluate((el) => el.outerHTML)
//     );

//     // =========================================================
//     // 6. CHECK INITIAL LOCKED STATE
//     // =========================================================

//     console.log("\n=== INITIAL PRICE STATE ===");

//     const lockedMessage = page.getByText(/price locked/i).first();

//     if (await lockedMessage.count()) {
//       console.log('"Price locked" found.');

//       console.log(
//         "Locked message outerHTML:",
//         await lockedMessage.evaluate((el) => el.outerHTML)
//       );
//     } else {
//       console.log('"Price locked" not found.');
//     }

//     // =========================================================
//     // 7. FIND CHECK BUTTON
//     // =========================================================

//     console.log("\n=== CHECK PRICE BUTTON ===");

//     const checkButton = page.locator(
//       'button.ctl-main[aria-label="Check today’s price"]'
//     );

//     const checkButtonCount = await checkButton.count();

//     console.log(`Found ${checkButtonCount} Check Price button(s).`);

//     if (checkButtonCount === 0) {
//       throw new Error("Check Price button not found.");
//     }

//     console.log(
//       "Disabled attribute before hover:",
//       await checkButton.getAttribute("disabled")
//     );

//     // =========================================================
//     // 8. HOVER PRICE AREA
//     // =========================================================

//     console.log("\n=== HOVERING PRICE AREA ===");

//     if (await lockedMessage.count()) {
//       await lockedMessage.hover();

//       await page.waitForTimeout(1000);

//       console.log(
//         "Disabled attribute after hover:",
//         await checkButton.getAttribute("disabled")
//       );
//     } else {
//       console.log(
//         "Could not find Price locked element, so hover was skipped."
//       );
//     }

//     // =========================================================
//     // 9. FALLBACK RAW MOUSE MOVE
//     // =========================================================

//     if (await checkButton.isDisabled()) {
//       console.log(
//         "\nButton is still disabled. Trying mouse movement over price area..."
//       );

//       const box = await offerPanel.boundingBox();

//       if (box) {
//         await page.mouse.move(
//           box.x + box.width / 2,
//           box.y + box.height / 2,
//           {
//             steps: 10,
//           }
//         );

//         await page.waitForTimeout(1000);
//       }

//       console.log(
//         "Disabled attribute after mouse movement:",
//         await checkButton.getAttribute("disabled")
//       );
//     }

//     // =========================================================
//     // 10. CLICK CHECK PRICE
//     // =========================================================

//     console.log("\n=== CLICKING CHECK PRICE ===");

//     if (await checkButton.isDisabled()) {
//       throw new Error(
//         "Check Price button is still disabled. Price could not be triggered."
//       );
//     }

//     await checkButton.click();

//     console.log("Check Price clicked.");

//     // =========================================================
//     // 11. WAIT FOR REAL PRICE RESOLUTION
//     // =========================================================

//     console.log("\n=== WAITING FOR PRICE RESOLUTION ===");

//     await page.waitForFunction(
//       () => {
//         const panel = document.querySelector(".offer-panel");

//         if (!panel) {
//           return false;
//         }

//         return !panel.classList.contains("offer-locked");
//       },
//       {
//         timeout: 15000,
//       }
//     );

//     console.log("Price panel is no longer locked.");

//     // Give the DOM a tiny amount of time to settle.
//     await page.waitForTimeout(500);

//     // =========================================================
//     // 12. RESOLVED OFFER PANEL
//     // =========================================================

//     console.log("\n=== AFTER: OFFER PANEL OUTERHTML ===");

//     console.log(
//       await offerPanel.evaluate((el) => el.outerHTML)
//     );

//     // =========================================================
//     // 13. VISIBILITY AUDIT
//     // =========================================================

//     console.log(
//       "\n=== VISIBILITY AUDIT OF EVERY CHILD ELEMENT ==="
//     );

//     const visibilityReport = await offerPanel.evaluate((panel) => {
//       return Array.from(panel.querySelectorAll("*")).map((el) => {
//         const style = window.getComputedStyle(el);
//         const box = el.getBoundingClientRect();

//         const visible =
//           box.width > 0 &&
//           box.height > 0 &&
//           style.display !== "none" &&
//           style.visibility !== "hidden" &&
//           style.opacity !== "0" &&
//           el.getAttribute("aria-hidden") !== "true";

//         return {
//           tag: el.tagName,
//           class: el.className,
//           text: el.textContent.trim().slice(0, 100),
//           ariaHidden: el.getAttribute("aria-hidden"),
//           dataPrice: el.getAttribute("data-price"),
//           display: style.display,
//           visibility: style.visibility,
//           opacity: style.opacity,
//           visible,
//         };
//       });
//     });

//     console.log(
//       JSON.stringify(visibilityReport, null, 2)
//     );

//     // =========================================================
//     // 14. VISIBLE PRICE CANDIDATES
//     // =========================================================

//     console.log("\n=== VISIBLE PRICE CANDIDATES ===");

//     const visiblePriceCandidates = await offerPanel.evaluate(
//       (panel) => {
//         return Array.from(
//           panel.querySelectorAll('[data-price="true"], .price-value, .amount')
//         )
//           .filter((el) => {
//             const style = window.getComputedStyle(el);
//             const box = el.getBoundingClientRect();

//             return (
//               box.width > 0 &&
//               box.height > 0 &&
//               style.display !== "none" &&
//               style.visibility !== "hidden" &&
//               style.opacity !== "0" &&
//               el.getAttribute("aria-hidden") !== "true"
//             );
//           })
//           .map((el) => ({
//             tag: el.tagName,
//             class: el.className,
//             text: el.textContent.trim(),
//             dataPrice: el.getAttribute("data-price"),
//             ariaHidden: el.getAttribute("aria-hidden"),
//             outerHTML: el.outerHTML,
//           }));
//       }
//     );

//     console.log(
//       JSON.stringify(visiblePriceCandidates, null, 2)
//     );

//     // =========================================================
//     // 15. STOCK CANDIDATES
//     // =========================================================

//     console.log("\n=== STOCK CANDIDATES ===");

//     const stockCandidates = await page.locator(
//       "text=/UNITS AVAILABLE/i"
//     ).all();

//     console.log(
//       `Found ${stockCandidates.length} stock candidate(s).`
//     );

//     for (let i = 0; i < stockCandidates.length; i++) {
//       const element = stockCandidates[i];

//       console.log(`\n--- Stock Candidate ${i + 1} ---`);

//       console.log(
//         "Text:",
//         await element.innerText()
//       );

//       console.log(
//         "outerHTML:",
//         await element.evaluate((el) => el.outerHTML)
//       );
//     }

//     // =========================================================
//     // 16. FINAL PAGE TEXT
//     // =========================================================

//     console.log("\n=== FINAL OFFER PANEL TEXT ===");

//     console.log(
//       await offerPanel.innerText()
//     );

//     // =========================================================
//     // 17. KEEP BROWSER OPEN
//     // =========================================================

//     console.log("\n=== DISCOVERY COMPLETE ===");
//     console.log(
//       "Browser will remain open for 30 seconds."
//     );

//     await page.waitForTimeout(30000);
//   } catch (error) {
//     console.error("\n=== DISCOVERY ERROR ===");
//     console.error(error);
//   } finally {
//     await browser.close();
//   }
// }

// inspectProduct();

const { chromium } = require("playwright");

const PRODUCT_URL = "https://demo.inelabteamdev.com/item/2609";

async function inspectProduct() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 200,
  });

  const page = await browser.newPage();

  try {
    console.log("\n=== OPENING PRODUCT PAGE ===");
    console.log(PRODUCT_URL);

    await page.goto(PRODUCT_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    console.log("Page loaded.");
    await page.waitForTimeout(1500);

    // ---------------------------------------------------------
    // COOKIE
    // ---------------------------------------------------------

    const allowButton = page.getByRole("button", {
      name: /allow/i,
    });

    if (await allowButton.count()) {
      console.log("Cookie banner found — clicking Allow.");
      await allowButton.click();
      await page.waitForTimeout(500);
    } else {
      console.log("No cookie banner found.");
    }

    // ---------------------------------------------------------
    // OPTION
    // ---------------------------------------------------------

    console.log("\n=== SELECTING WARM WHITE ===");

    const warmWhite = page.getByRole("button", {
      name: "Warm white",
      exact: true,
    });

    console.log(
      "Warm white count:",
      await warmWhite.count()
    );

    console.log(
      "Warm white before click:",
      await warmWhite.evaluate((el) => el.outerHTML)
    );

    await warmWhite.click();

    console.log("Warm white clicked.");

    await page.waitForTimeout(500);

    console.log(
      "Warm white after click:",
      await warmWhite.evaluate((el) => el.outerHTML)
    );

    // ---------------------------------------------------------
    // OFFER PANEL
    // ---------------------------------------------------------

    const offerPanel = page.locator(".offer-panel");

    console.log("\n=== OFFER PANEL AFTER OPTION SELECTION ===");

    console.log(
      await offerPanel.evaluate((el) => el.outerHTML)
    );

    // ---------------------------------------------------------
    // CHECK BUTTON
    // ---------------------------------------------------------

    const checkButton = page.locator(
      'button.ctl-main[aria-label="Check today’s price"]'
    );

    console.log("\n=== CHECK BUTTON AFTER OPTION SELECTION ===");

    console.log(
      await checkButton.evaluate((el) => el.outerHTML)
    );

    console.log(
      "Disabled:",
      await checkButton.isDisabled()
    );

    // ---------------------------------------------------------
    // PRICE LOCKED MESSAGE
    // ---------------------------------------------------------

    const lockedMessage = page.getByText(
      /price locked/i
    ).first();

    console.log("\n=== PRICE LOCKED MESSAGE ===");

    console.log(
      "Count:",
      await lockedMessage.count()
    );

    if (await lockedMessage.count()) {
      console.log(
        await lockedMessage.evaluate((el) => el.outerHTML)
      );
    }

    // ---------------------------------------------------------
    // HOVER
    // ---------------------------------------------------------

    console.log("\n=== HOVERING PRICE LOCKED MESSAGE ===");

    if (await lockedMessage.count()) {
      await lockedMessage.hover();
    }

    await page.waitForTimeout(500);

    console.log(
      "Button after hover:"
    );

    console.log(
      await checkButton.evaluate((el) => el.outerHTML)
    );

    console.log(
      "Disabled after hover:",
      await checkButton.isDisabled()
    );

    // ---------------------------------------------------------
    // WAIT 1 SECOND
    // ---------------------------------------------------------

    console.log("\n=== WAITING ANOTHER 1 SECOND ===");

    await page.waitForTimeout(1000);

    console.log(
      "Button after additional 1 second:"
    );

    console.log(
      await checkButton.evaluate((el) => el.outerHTML)
    );

    console.log(
      "Disabled:",
      await checkButton.isDisabled()
    );

    // ---------------------------------------------------------
    // RAW MOUSE MOVEMENT
    // ---------------------------------------------------------

    if (await checkButton.isDisabled()) {
      console.log(
        "\n=== STEPPED MOUSE MOVEMENT ==="
      );

      const box = await lockedMessage.boundingBox();

      console.log("Price message box:", box);

      if (box) {
        await page.mouse.move(
          box.x,
          box.y
        );

        await page.mouse.move(
          box.x + box.width / 2,
          box.y + box.height / 2,
          {
            steps: 20,
          }
        );
      }

      await page.waitForTimeout(1000);

      console.log(
        "Button after stepped mouse:"
      );

      console.log(
        await checkButton.evaluate((el) => el.outerHTML)
      );

      console.log(
        "Disabled:",
        await checkButton.isDisabled()
      );
    }

    // ---------------------------------------------------------
    // SCREENSHOT
    // ---------------------------------------------------------

    await page.screenshot({
      path: "option-hover-debug.png",
      fullPage: true,
    });

    console.log(
      "\nScreenshot saved: option-hover-debug.png"
    );

    console.log(
      "\n=== DIAGNOSTIC COMPLETE ==="
    );

    console.log(
      "Browser will remain open for 30 seconds."
    );

    await page.waitForTimeout(30000);

  } catch (error) {
    console.error(
      "\n=== DIAGNOSTIC ERROR ==="
    );

    console.error(error);

    await page.screenshot({
      path: "option-hover-error.png",
      fullPage: true,
    }).catch(() => {});

  } finally {
    await browser.close();
  }
}

inspectProduct();