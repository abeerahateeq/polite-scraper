# Polite Scraper

A small scraping pipeline built with Node.js. It downloads the first three catalogue pages of Books to Scrape, visits all 60 book pages, turns messy HTML into clean, schema-checked JSON, survives a broken page, and ends every run with a report.

Pipeline: classify, fetch, extract, normalize, validate, store, report.

## Target classification
- **Site:** https://books.toscrape.com (part of toscrape.com)
- **Why it is allowed:** toscrape.com describes itself as a sandbox, a site built so people can practise scraping on it. That is the permission, and a site like this is the only kind this project touches.
- **How much:** the first 3 catalogue pages only, plus the 60 book pages they link to.
- **What I collect:** title, product URL, price, availability text, star rating text and description of each book. No personal data.
- **robots.txt result:** `<WRITE WHAT YOU SAW AFTER RUNNING npm run robots, e.g. "status 404, no robots file found">`
- I will not reuse this code on another site without checking its rules and terms first.

## Setup and run
Requires Node.js 20 or newer.
```bash
npm install
npm start
```
This processes exactly 3 catalogue pages, discovers 60 unique book URLs, and writes the results to `output/`.

Other commands:
| Command | What it does |
|---------|--------------|
| `npm run robots` | Requests robots.txt once and prints the result |
| `npm run start:fake` | Same run, plus one made-up book URL to prove a bad page cannot kill the run |
| `npm test` | Runs the parser unit tests (no network needed) |

The first run takes about a minute because it waits between real requests. Later runs read the saved copies in `cache/` and finish in about a second.

## Output files
| File | Content |
|------|---------|
| `output/books.json` | Exactly 60 validated, unique records |
| `output/errors.json` | Records that failed validation, each with a reason |
| `output/run-report.json` | Counts and timing for the run |

## Record schema
| Field | Type | Notes |
|-------|------|-------|
| title | string | required |
| product_url | string | absolute `https://` URL, used as the record's identity |
| price_text | string | original text, e.g. `£51.77` |
| price_gbp | number | clean value, e.g. `51.77` |
| availability_text | string | e.g. `In stock (22 available)` |
| rating_text | string | e.g. `Three` |
| description | string or null | `null` when the page has none, never invented |
| source_page | string | catalogue page where the book was found (provenance) |
| fetched_at | string | when the page was downloaded (provenance) |

The schema is written with Zod in `src/schema.js`. A record that fails goes to `errors.json` and never reaches `books.json`.

## Politeness rules
- **User-agent:** every real request sends `FlyRankInternshipA9/1.0 (+https://github.com/abeerahateeq/polite-scraper)`.
- **Delay:** at least 600 ms between real requests. Cached pages need no delay.
- **Timeout:** 10 seconds, then the request gives up.
- **Status check:** only `200` counts as a page.
- **Cache:** pages are saved to `cache/` and reused. Reruns read from disk.
- **Retries:** one retry for a timeout or a 5xx error. No retry for 404 or 403.

## Idempotency
Running the scraper twice gives the same 60 records, not 120. Records are keyed by their canonical product URL, and `fetched_at` comes from the cache file's timestamp, so it stays the same on reruns.

## Run report
```json
<PASTE YOUR REAL output/run-report.json HERE>
```

## Why no browser was needed
The data is already in the HTML the server sends, so a browser would only add cost.

## Ethics note
<WRITE 3 SHORT SENTENCES IN YOUR OWN WORDS: use an official API when one exists, never bypass logins, paywalls or blocks, and collect only what you need>

## Limitation
<WRITE ONE HONEST LIMITATION, for example: the selectors depend on this site's current HTML, so a redesign would break the scraper until they are updated>
