const fs = require("fs/promises");
const path = require("path");
const { USER_AGENT, TIMEOUT_MS, DELAY_MS, RETRY_WAIT_MS } = require("./config");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class FetchError extends Error {
  constructor(message, status, retryable) {
    super(message);
    this.status = status;
    this.retryable = retryable;
  }
}

// Politeness: never send two real requests closer than DELAY_MS apart
let lastRequestAt = 0;
async function politeWait() {
  const wait = lastRequestAt + DELAY_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function requestOnce(url) {
  await politeWait();
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS), // never wait forever
    });
    if (response.status !== 200) {
      // 5xx = server trouble (worth one retry). 404, 403 and the rest are final.
      throw new FetchError("HTTP " + response.status, response.status, response.status >= 500);
    }
    return await response.text();
  } catch (err) {
    if (err instanceof FetchError) throw err;
    // timeout or network failure: worth one retry
    throw new FetchError("network error (" + err.name + ")", null, true);
  }
}

// One retry for timeouts and 5xx. Never retry a 404 or a 403.
async function fetchWithRetry(url) {
  try {
    return await requestOnce(url);
  } catch (err) {
    if (!err.retryable) throw err;
    console.log("RETRY      " + url + " (" + err.message + ")");
    await sleep(RETRY_WAIT_MS);
    return await requestOnce(url);
  }
}

// Cache first. Only goes to the site when the saved copy does not exist.
async function getPage(url, cacheFile, stats) {
  try {
    const [html, info] = await Promise.all([fs.readFile(cacheFile, "utf8"), fs.stat(cacheFile)]);
    stats.cacheHits++;
    console.log("CACHE HIT  " + html.length + " bytes  " + url);
    // fetched_at = when the page was really downloaded (stable across reruns)
    return { html, fetchedAt: info.mtime.toISOString(), fromCache: true };
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  const html = await fetchWithRetry(url);
  await fs.mkdir(path.dirname(cacheFile), { recursive: true });
  await fs.writeFile(cacheFile, html);
  const info = await fs.stat(cacheFile);
  stats.pagesFetched++;
  console.log("FETCH      " + html.length + " bytes  " + url);
  return { html, fetchedAt: info.mtime.toISOString(), fromCache: false };
}

module.exports = { getPage };
