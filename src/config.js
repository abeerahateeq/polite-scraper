const path = require("path");

module.exports = {
  START_URL: "https://books.toscrape.com/catalogue/page-1.html",
  ROBOTS_URL: "https://books.toscrape.com/robots.txt",
  FAKE_URL: "https://books.toscrape.com/catalogue/this-book-does-not-exist_999/index.html",
  MAX_CATALOGUE_PAGES: 3,
  // Politeness rules
  USER_AGENT: "FlyRankInternshipA9/1.0 (+https://github.com/abeerahateeq/polite-scraper)",
  TIMEOUT_MS: 10000,
  DELAY_MS: 600,
  RETRY_WAIT_MS: 1500,
  // Folders
  CACHE_DIR: path.join(__dirname, "..", "cache"),
  OUTPUT_DIR: path.join(__dirname, "..", "output"),
};
