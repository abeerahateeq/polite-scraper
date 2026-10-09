// Stage 0: ask for robots.txt ONCE and write down what happened.
const fs = require("fs/promises");
const path = require("path");
const { ROBOTS_URL, USER_AGENT, TIMEOUT_MS, CACHE_DIR } = require("./config");

(async () => {
  try {
    const response = await fetch(ROBOTS_URL, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    console.log("robots.txt status: " + response.status);
    if (response.status === 200) {
      const text = await response.text();
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(path.join(CACHE_DIR, "robots.txt"), text);
      console.log("--- robots.txt (" + text.length + " bytes) ---");
      console.log(text);
    } else if (response.status === 404) {
      console.log("no robots file found (a missing file is not permission, it is just a missing file)");
    }
  } catch (err) {
    console.log("could not request robots.txt: " + err.message);
  }
})();
