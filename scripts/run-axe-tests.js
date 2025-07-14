const { execSync } = require("node:child_process");
const fs = require("node:fs");
const { debugLog } = require("./utils");

const PR_BODY = process.env.PR_BODY || "";
const DEFAULT_URL = process.env.DEFAULT_URL || "";
const PATH_REGEX = /https:\/\/[^\s]+/g;

debugLog("Environment variables", {
  PR_BODY: PR_BODY.substring(0, 200) + (PR_BODY.length > 200 ? "..." : ""),
  DEFAULT_URL,
  GITHUB_EVENT_NAME: process.env.GITHUB_EVENT_NAME,
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
    debugLog("Error parsing preview URL", {
      error: err.message,
      url: rawPreviewUrl,
    });
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
  urlsToTest: Object.keys(urlsToTest),
});

const addUrlToTest = (url, key) => {
  if (url?.trim() && !urlsToTest[key]) {
    let cleanUrl = url.trim();
    cleanUrl = cleanUrl.replace(/[),]$/, "");

    const separator = cleanUrl.includes("?") ? "&" : "?";
    const urlWithPb = `${cleanUrl}${separator}pb=0`;
    urlsToTest[key] = urlWithPb;
    debugLog(`Added URL to test - ${key}`, {
      originalUrl: url,
      cleanUrl,
      finalUrl: urlWithPb,
    });
  } else {
    const reason = !url || !url.trim() ? "empty" : "already exists";
    debugLog(`Skipping URL for ${key}`, { url, reason });
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

const urlEntries = Object.entries(urlsToTest).map(([key, url]) => ({
  key,
  url,
}));

// Get ChromeDriver path from browser-driver-manager
let chromedriverPath = "";
try {
  const browserDriverOutput = process.env.BROWSER_DRIVER_OUTPUT || "";

  if (browserDriverOutput) {
    // Parse the CHROMEDRIVER_TEST_PATH from the output
    const chromedriverMatch = browserDriverOutput.match(
      /CHROMEDRIVER_TEST_PATH="([^"]+)"/
    );
    if (chromedriverMatch) {
      chromedriverPath = chromedriverMatch[1];
      debugLog(
        "ChromeDriver path from browser-driver-manager output",
        chromedriverPath
      );
    } else {
      debugLog("CHROMEDRIVER_TEST_PATH not found in output", {
        output: browserDriverOutput.substring(0, 500),
      });
    }
  } else {
    debugLog("BROWSER_DRIVER_OUTPUT environment variable not set");
  }
} catch (err) {
  console.warn(
    "Could not get ChromeDriver path from browser-driver-manager:",
    err.message
  );
  debugLog("ChromeDriver path error", { error: err.message });
}

for (const { key, url } of urlEntries) {
  console.log(`Running axe on ${key}: ${url}`);
  debugLog(`Starting axe test for ${key}`, {
    url,
    reportPath: `axe-report-${key}.json`,
  });

  const reportPath = `axe-report-${key}.json`;
  try {
    const axeCommand = chromedriverPath
      ? `axe "${url}" --save ${reportPath} --chromedriver-path ${chromedriverPath}`
      : `axe "${url}" --save ${reportPath}`;

    debugLog(`Executing axe command for ${key}`, { command: axeCommand });

    // Check if report file exists before running axe
    const reportExistsBefore = fs.existsSync(reportPath);
    debugLog("Report file exists before axe execution", {
      reportPath,
      exists: reportExistsBefore,
    });

    execSync(axeCommand, { stdio: "inherit" });

    // Check if report file exists after running axe
    const reportExistsAfter = fs.existsSync(reportPath);
    debugLog("Report file exists after axe execution", {
      reportPath,
      exists: reportExistsAfter,
    });

    if (reportExistsAfter) {
      const reportContent = fs.readFileSync(reportPath, "utf8");
      debugLog("Report file content length", {
        reportPath,
        contentLength: reportContent.length,
      });
      console.log(`Saved: ${reportPath}`);
      debugLog(`Successfully completed axe test for ${key}`, { reportPath });
    } else {
      console.error(`❌ Report file not created: ${reportPath}`);
      debugLog("Report file not found after axe execution", { reportPath });
    }
  } catch (err) {
    console.error(`❌ Error running axe on ${key}:`, err.message);
    debugLog(`Error running axe test for ${key}`, { error: err.message, url });

    // Check if report file was created despite the error
    const reportExistsAfterError = fs.existsSync(reportPath);
    debugLog("Report file exists after error", {
      reportPath,
      exists: reportExistsAfterError,
    });

    fs.writeFileSync(
      reportPath,
      JSON.stringify({ error: err.message, url }, null, 2)
    );
  }
}
