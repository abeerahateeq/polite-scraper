// Pure functions: HTML in, data out. No network, so they are easy to test.
const cheerio = require("cheerio");

const clean = (text) => text.replace(/\s+/g, " ").trim();

// Relative to absolute, always with the URL tools (never string gluing)
function toAbsoluteUrl(href, baseUrl) {
  return new URL(href, baseUrl).href;
}

// "£51.77" -> 51.77 ; anything unreadable -> null
function normalizePrice(text) {
  if (typeof text !== "string") return null;
  const digits = text.replace(/[^0-9.]/g, "");
  if (digits === "") return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

function dedupe(urls) {
  return [...new Set(urls)];
}

// Catalogue page -> absolute book links + the catalogue's own "next" link
function parseCataloguePage(html, pageUrl) {
  const $ = cheerio.load(html);
  const bookUrls = $("article.product_pod h3 a")
    .map((_, el) => $(el).attr("href"))
    .get()
    .filter(Boolean)
    .map((href) => toAbsoluteUrl(href, pageUrl));
  const nextHref = $("li.next a").attr("href");
  return { bookUrls, nextUrl: nextHref ? toAbsoluteUrl(nextHref, pageUrl) : null };
}

// Book page -> raw record. Selectors are aimed at the product area only.
function parseBookPage(html, productUrl) {
  const $ = cheerio.load(html);
  const article = $("article.product_page");
  const product = article.find(".product_main");

  const ratingClass = (product.find("p.star-rating").first().attr("class") || "")
    .split(/\s+/)
    .find((c) => c && c !== "star-rating");

  // The description paragraph sits right after the "Product Description" header
  const descriptionNode = article.find("#product_description").next("p");
  const descriptionText = descriptionNode.length ? clean(descriptionNode.text()) : "";

  return {
    title: clean(product.find("h1").first().text()),
    product_url: productUrl,
    price_text: clean(product.find("p.price_color").first().text()),
    availability_text: clean(product.find("p.availability").first().text()),
    rating_text: ratingClass || "",
    description: descriptionText === "" ? null : descriptionText, // never invent text
  };
}

module.exports = { toAbsoluteUrl, normalizePrice, dedupe, parseCataloguePage, parseBookPage };
