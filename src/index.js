const fs = require("fs/promises");
const path = require("path");
const config = require("./config");
const { getPage } = require("./fetcher");
const { parseCataloguePage, parseBookPage, normalizePrice, dedupe } = require("./parser");
const { BookSchema } = require("./schema");

const slugFromUrl = (url) => {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  const slug = parts[parts.length - 2] || "page";
  return slug.replace(/[^a-zA-Z0-9_-]/g, "_") + ".html";
};

async function writeJson(name, data) {
  await fs.mkdir(config.OUTPUT_DIR, { recursive: true });
  await fs.writeFile(path.join(config.OUTPUT_DIR, name), JSON.stringify(data, null, 2) + "\n");
}

async function main() {
  const startedAt = new Date();
  const stats = { pagesFetched: 0, cacheHits: 0, failedPages: [] };
  const withFake = process.argv.includes("--with-fake"); // proves a bad page cannot kill the run

  // ---- Stage 2: discover the catalogue pages, following the site's own "next" link
  const discovered = [];
  let cataloguePages = 0;
  let pageUrl = config.START_URL;
  for (let n = 1; n <= config.MAX_CATALOGUE_PAGES && pageUrl; n++) {
    try {
      const page = await getPage(pageUrl, path.join(config.CACHE_DIR, "catalogue-page-" + n + ".html"), stats);
      const { bookUrls, nextUrl } = parseCataloguePage(page.html, pageUrl);
      cataloguePages++;
      for (const url of bookUrls) discovered.push({ url, source_page: pageUrl });
      pageUrl = nextUrl;
    } catch (err) {
      stats.failedPages.push({ url: pageUrl, reason: err.message });
      console.log("FAILED     " + pageUrl + " (" + err.message + ")");
      break;
    }
  }

  // Remove duplicate links (first sighting wins)
  const uniqueUrls = dedupe(discovered.map((d) => d.url));
  const sourceOf = new Map();
  for (const d of discovered) if (!sourceOf.has(d.url)) sourceOf.set(d.url, d.source_page);
  const targets = uniqueUrls.map((url) => ({ url, source_page: sourceOf.get(url) }));
  if (withFake) targets.push({ url: config.FAKE_URL, source_page: config.START_URL });

  // ---- Stage 3: raw records. Each page is handled on its own.
  const rawRecords = [];
  for (const target of targets) {
    try {
      const page = await getPage(target.url, path.join(config.CACHE_DIR, slugFromUrl(target.url)), stats);
      const raw = parseBookPage(page.html, target.url);
      rawRecords.push({ ...raw, source_page: target.source_page, fetched_at: page.fetchedAt });
    } catch (err) {
      stats.failedPages.push({ url: target.url, reason: err.message });
      console.log("FAILED     " + target.url + " (" + err.message + ")");
    }
  }

  // ---- Stage 4: normalize, validate, store. The product URL is the identity.
  const valid = new Map();
  const errors = [];
  for (const raw of rawRecords) {
    const candidate = {
      title: raw.title,
      product_url: raw.product_url,
      price_text: raw.price_text,
      price_gbp: normalizePrice(raw.price_text),
      availability_text: raw.availability_text,
      rating_text: raw.rating_text,
      description: raw.description,
      source_page: raw.source_page,
      fetched_at: raw.fetched_at,
    };
    const result = BookSchema.safeParse(candidate);
    if (result.success) {
      valid.set(result.data.product_url, result.data); // same URL twice counts once
    } else {
      errors.push({
        product_url: raw.product_url,
        reason: result.error.issues.map((i) => i.path.join(".") + ": " + i.message),
      });
    }
  }

  const books = [...valid.values()];
  await writeJson("books.json", books);
  await writeJson("errors.json", errors);

  // ---- Stage 5: an honest report
  const report = {
    started_at: startedAt.toISOString(),
    duration_seconds: Number(((Date.now() - startedAt.getTime()) / 1000).toFixed(1)),
    catalogue_pages: cataloguePages,
    discovered_urls: discovered.length,
    unique_urls: uniqueUrls.length,
    pages_fetched: stats.pagesFetched,
    cache_hits: stats.cacheHits,
    valid_records: books.length,
    invalid_records: errors.length,
    failed_pages: stats.failedPages.length,
    failures: stats.failedPages,
  };
  await writeJson("run-report.json", report);

  console.log("");
  console.log("catalogue_pages=" + cataloguePages + " discovered=" + discovered.length + " unique_urls=" + uniqueUrls.length);
  console.log("detail_pages=" + rawRecords.length);
  if (rawRecords[0]) console.log("one raw record: " + JSON.stringify(rawRecords[0]));
  console.log("valid=" + books.length + " invalid=" + errors.length + " failed_pages=" + stats.failedPages.length);
  console.log("pages_fetched=" + stats.pagesFetched + " cache_hits=" + stats.cacheHits + " duration=" + report.duration_seconds + "s");
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
