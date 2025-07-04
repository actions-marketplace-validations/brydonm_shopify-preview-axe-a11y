const fs = require("node:fs");
const { sortByImpact, debugLog } = require("./utils");

const readReport = (filename) => {
  if (!fs.existsSync(filename)) return null;
  const data = JSON.parse(fs.readFileSync(filename, "utf8"));
  return Array.isArray(data.violations)
    ? data
    : Array.isArray(data)
    ? data[0]
    : null;
};

const impactEmojis = {
  critical: "❗️",
  serious: "⚠️",
  moderate: "🔶",
  minor: "🔷",
  info: "ℹ️",
};

const currentReport = readReport("axe-report-preview.json");
const previousReport = readReport("axe-report-default.json");

debugLog("Report files status", {
  currentReportExists: !!currentReport,
  previousReportExists: !!previousReport,
  currentReportUrl: currentReport?.url,
  previousReportUrl: previousReport?.url
});

let output = "### 🧪 Axe Accessibility Report\n\n";

if (!currentReport) {
  console.error("❌ No axe-report-preview.json file found");

  output += "Preview report was not generated.\n";
  output += "- ❌ Preview report\n";
  output += "  - Ensure a preview URL was included in the PR body\n";
  output += "  - Try rerunning the action\n";
  output += "  - Try making the preview URL more prominent (removing markdown)\n";
  output += "  - Check the action logs for more details\n";

  if (!previousReport) {
    output += "- ❌ Live report\n";
    output += "  - Ensure the `default_url` was passed into the action\n";
    output += "  - Try rerunning the action\n";
    output += "  - Check the action logs for more details\n";
  }

  fs.writeFileSync("axe-comment.md", output);
  console.log("✅ axe-comment.md generated");
  debugLog("Generated comment for missing preview report", { outputLength: output.length });
} else {
  const currentViolations = currentReport?.violations
    ? currentReport.violations.flatMap((v) =>
        v.nodes.map((n) => ({
          ...v,
          ...n,
        }))
      )
    : [];

  if (previousReport) {
    // Both reports exist - compare them
    const previousViolations = previousReport?.violations
      ? previousReport.violations.flatMap((v) =>
          v.nodes.map((n) => ({
            ...v,
            ...n,
          }))
        )
      : [];

    const newViolations = currentViolations.filter(
      (v) => !previousViolations.some((pv) => pv.id === v.id)
    );

    output += `- ${newViolations.length} new violations found compared to live\n`;
    output += `- ${
      currentViolations.length
    } violations found on the preview url (\`${
      currentReport?.url || "unknown"
    }\`)\n`;
    output += `- ${
      previousViolations.length
    } violations found on the live url (\`${
      previousReport?.url || "unknown"
    }\`)\n`;

    const buildViolationsTable = ({ title, violations }) => {
      if (violations.length === 0) return "";

      let table = "<details>";
      table += `<summary>${title}</summary>\n\n`;
      table += "| Issue | Target | Summary |\n";
      table += "|-------|--------|---------|\n";

      for (const n of violations) {
        const impact = n.impact || "n/a";
        const help = `[${n.help}](${n.helpUrl})`;
        const target = Array.isArray(n.target) ? n.target.join(", ") : "n/a";
        const failureSummary = n.any.map((a) => `- ${a.message}`).join("<br>");

        table += `| ${impactEmojis[impact]} ${help} | \`${target}\` | ${failureSummary} |\n`;
      };

      table += "</details>\n\n";
      return table;
    };

    output += buildViolationsTable({
      title: "⚠️ New violations compared to live",
      violations: sortByImpact(newViolations),
    });

    output += buildViolationsTable({
      title: "🔗 All preview link violations",
      violations: sortByImpact(currentViolations),
    });

    output += buildViolationsTable({
      title: "🧪 All live violations",
      violations: sortByImpact(previousViolations),
    });
  } else {
    // Only preview report exists - show just preview violations
    output += `- ${
      currentViolations.length
    } violations found on the preview url (\`${
      currentReport?.url || "unknown"
    }\`)\n`;
    output += "- No live report available for comparison (no `default_url` provided)\n\n";

    const buildViolationsTable = ({ title, violations }) => {
      if (violations.length === 0) return "";

      let table = "<details>";
      table += `<summary>${title}</summary>\n\n`;
      table += "| Issue | Target | Summary |\n";
      table += "|-------|--------|---------|\n";

      for (const n of violations) {
        const impact = n.impact || "n/a";
        const help = `[${n.help}](${n.helpUrl})`;
        const target = Array.isArray(n.target) ? n.target.join(", ") : "n/a";
        const failureSummary = n.any.map((a) => `- ${a.message}`).join("<br>");

        table += `| ${impactEmojis[impact]} ${help} | \`${target}\` | ${failureSummary} |\n`;
      };

      table += "</details>\n\n";
      return table;
    };

    output += buildViolationsTable({
      title: "🔗 All preview violations",
      violations: sortByImpact(currentViolations),
    });
  }

  fs.writeFileSync("axe-comment.md", output);
  console.log("✅ axe-comment.md generated");
  debugLog("Generated comment for preview report", { 
    outputLength: output.length,
    currentViolationsCount: currentViolations.length,
    hasPreviousReport: !!previousReport
  });
}
