const test = require("node:test");
const assert = require("node:assert");
const { normalizePrice, toAbsoluteUrl, dedupe, parseBookPage, parseCataloguePage } = require("../src/parser");
const { BookSchema } = require("../src/schema");

const bookHtml = (priceBlock, descriptionBlock) => `
<article class="product_page">
  <div class="row">
    <div class="col-sm-6 product_main">
      <h1>  A Light in the Attic  </h1>
      ${priceBlock}
      <p class="instock availability">
        <i class="icon-ok"></i>
        In stock (22 available)
      </p>
      <p class="star-rating Three"></p>
    </div>
  </div>
  ${descriptionBlock}
</article>`;

const PRICE = '<p class="price_color">£51.77</p>';
const DESCRIPTION =
  '<div id="product_description" class="sub-header"><h2>Product Description</h2></div><p>It\'s hard to imagine a world without A Light in the Attic.</p>';

test("price normalization turns £51.77 into the number 51.77", () => {
  assert.strictEqual(normalizePrice("£51.77"), 51.77);
  assert.strictEqual(normalizePrice("not a price"), null);
});

test("relative links become absolute URLs", () => {
  const page = "https://books.toscrape.com/catalogue/page-1.html";
  assert.strictEqual(
    toAbsoluteUrl("a-light-in-the-attic_1000/index.html", page),
    "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html"
  );
  assert.strictEqual(
    toAbsoluteUrl("../book-name/index.html", "https://books.toscrape.com/catalogue/category/page.html"),
    "https://books.toscrape.com/catalogue/book-name/index.html"
  );
});

test("a missing description becomes null and extra whitespace is cleaned", () => {
  const record = parseBookPage(bookHtml(PRICE, ""), "https://books.toscrape.com/catalogue/x_1/index.html");
  assert.strictEqual(record.description, null);
  assert.strictEqual(record.title, "A Light in the Attic");
  assert.strictEqual(record.availability_text, "In stock (22 available)");
  assert.strictEqual(record.rating_text, "Three");
  const withText = parseBookPage(bookHtml(PRICE, DESCRIPTION), "https://books.toscrape.com/catalogue/x_1/index.html");
  assert.ok(withText.description.startsWith("It's hard to imagine"));
});

test("duplicate URLs are removed", () => {
  const urls = ["https://a.test/1", "https://a.test/2", "https://a.test/1"];
  assert.deepStrictEqual(dedupe(urls), ["https://a.test/1", "https://a.test/2"]);
});

test("a malformed page (no price) fails schema validation", () => {
  const raw = parseBookPage(bookHtml("", DESCRIPTION), "https://books.toscrape.com/catalogue/x_1/index.html");
  const candidate = {
    ...raw,
    price_gbp: normalizePrice(raw.price_text),
    source_page: "https://books.toscrape.com/catalogue/page-1.html",
    fetched_at: new Date().toISOString(),
  };
  assert.strictEqual(BookSchema.safeParse(candidate).success, false);
});

test("the catalogue parser finds book links and the next link", () => {
  const html = `
    <article class="product_pod"><h3><a href="one_1/index.html">One</a></h3></article>
    <article class="product_pod"><h3><a href="two_2/index.html">Two</a></h3></article>
    <ul class="pager"><li class="next"><a href="page-2.html">next</a></li></ul>`;
  const { bookUrls, nextUrl } = parseCataloguePage(html, "https://books.toscrape.com/catalogue/page-1.html");
  assert.strictEqual(bookUrls.length, 2);
  assert.strictEqual(bookUrls[0], "https://books.toscrape.com/catalogue/one_1/index.html");
  assert.strictEqual(nextUrl, "https://books.toscrape.com/catalogue/page-2.html");
});
