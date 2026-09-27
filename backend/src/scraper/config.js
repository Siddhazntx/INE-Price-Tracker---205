module.exports = {
  baseUrl: process.env.INE_BASE_URL,

  selectors: {
    offerPanel: ".offer-panel",

    checkPriceButton:
      'button.ctl-main[aria-label="Check today’s price"]',

    priceLockedMessage: ".offer-msg",

    priceFailed:
      ".offer-panel.offer-failed",

    optionButton:
      "button.opt-chip",

    visiblePrice:
      '[data-price="true"]',

    stockText:
      ".offer-panel",
  },

  scraper: {
    resolutionTimeoutMs: 15000,
  },
};