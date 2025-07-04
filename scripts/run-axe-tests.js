const { execSync } = require("node:child_process");
const fs = require("node:fs");
const { debugLog } = require("./utils");

const PR_BODY = process.env.PR_BODY || "";
const DEFAULT_URL = process.env.DEFAULT_URL || "";
const PATH_REGEX = /https:\/\/[^\s]+/g;

debugLog("Environment variables", {
  PR_BODY: PR_BODY.substring(0, 200) + (PR_BODY.length > 200 ? "..." : ""),
  DEFAULT_URL,
  GITHUB_EVENT_NAME: process.env.GITHUB_EVENT_NAME
});

const allUrls = PR_BODY.match(PATH_REGEX) || [];
debugLog("All URLs found in PR body", allUrls);

const rawPreviewUrl =
  allUrls.find(
    (url) =>
      url.includes("preview_theme_id=") || url.includes("shopifypreview.com")
  ) || "";

debugLog("Raw preview URL found", rawPreviewUrl);

let previewUrl = "";
if (rawPreviewUrl) {
  try {
    const parsed = new URL(rawPreviewUrl);
    const previewThemeId = parsed.searchParams.get("preview_theme_id");

    if (previewThemeId) {
      previewUrl = `${parsed.origin}?preview_theme_id=${previewThemeId}`;
    }
      } catch (err) {
      console.warn("Invalid preview URL:", rawPreviewUrl);
      debugLog("Error parsing preview URL", { error: err.message, url: rawPreviewUrl });
    }
  }

debugLog("Final preview URL", previewUrl);

const path = previewUrl ? new URL(previewUrl).pathname : "";

console.log("Preview URL:", previewUrl);
console.log("Default URL:", DEFAULT_URL);
console.log("Path:", path);

const urlsToTest = {};

debugLog("URL processing results", {
  previewUrl,
  defaultUrl: DEFAULT_URL,
  path,
  urlsToTest: Object.keys(urlsToTest)
});

const addUrlToTest = (url, key) => {
  if (url && !urlsToTest[key]) {
    urlsToTest[key] = url;
  }
};

if (previewUrl) {
  addUrlToTest(previewUrl, "preview");
}

if (DEFAULT_URL) {
  addUrlToTest(`${DEFAULT_URL}${path}`, "default");
}

if (Object.keys(urlsToTest).length === 0) {
  console.log("No valid URLs found for accessibility testing.");
  process.exit(0);
}

const urlEntries = Object.entries(urlsToTest)
  .map(([key, url]) => ({
    key,
    url,
  }));

// Get ChromeDriver path from browser-driver-manager
let chromedriverPath = "";
try {
  chromedriverPath = execSync("npx browser-driver-manager print chrome", { encoding: "utf8" }).trim();
  debugLog("ChromeDriver path", chromedriverPath);
} catch (err) {
  console.warn("Could not get ChromeDriver path from browser-driver-manager:", err.message);
  debugLog("ChromeDriver path error", { error: err.message });
}

for (const { key, url } of urlEntries) {
  console.log(`Running axe on ${key}: ${url}`);
  debugLog(`Starting axe test for ${key}`, { url, reportPath: `axe-report-${key}.json` });
  
  const reportPath = `axe-report-${key}.json`;
  try {
    const axeCommand = chromedriverPath 
      ? `axe ${url} --save ${reportPath} --chromedriver-path ${chromedriverPath}`
      : `axe ${url} --save ${reportPath}`;
    
    debugLog(`Executing axe command for ${key}`, { command: axeCommand });
    execSync(axeCommand, { stdio: "inherit" });
    console.log(`Saved: ${reportPath}`);
    debugLog(`Successfully completed axe test for ${key}`, { reportPath });
  } catch (err) {
    console.error(`❌ Error running axe on ${key}:`, err.message);
    debugLog(`Error running axe test for ${key}`, { error: err.message, url });
    fs.writeFileSync(
      reportPath,
      JSON.stringify({ error: err.message, url }, null, 2)
    );
  }
}
