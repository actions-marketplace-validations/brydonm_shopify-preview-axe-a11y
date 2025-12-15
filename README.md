# 🧪 Shopify Preview Axe A11y Report

---

Automatically run [Axe](https://www.deque.com/axe/) tests on preview URLs mentioned in your PR description --- and post the results as a comment!

## ✅ Features

- 🔍 Extracts Shopify preview URL from PR body (no special formatting needed)
- 🧪 Runs Axe CLI tests
- 💬 Comments the test results directly on the PR
- 📊 Provides a detailed report of accessibility issues including analysis of net new issues

## 🚀 Usage

Add this to your workflow in any repo:

```yaml
name: Shopify Axe A11y Report

on:
  pull_request:
    types: [opened, edited, synchronize]

permissions:
  contents: write
  pull-requests: write

jobs:
  axe-shopify-report:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - uses: brydonm/shopify-preview-axe-a11y@v1
```

## 📝 PR Description Format

Include a preview URL **anywhere** in the PR body with the `preview_theme_id` parameter:

- https://your-site.com/?preview_theme_id=123456789
- https://your-site.com/products/item?preview_theme_id=123456789

The action will automatically find and test the first matching URL that contains `preview_theme_id`.

## 🛡️ Security

- Use GitHub Secrets to store sensitive credentials.
- This action uses the GitHub token to comment on PRs securely.
