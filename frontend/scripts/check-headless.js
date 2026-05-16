const playwright = require('playwright');

(async () => {
  const base = process.env.FRONTEND_URL || 'http://localhost:3000';
  const routes = [
    '/',
    '/conferences',
    '/conference',
    '/staff/dashboard',
    '/login',
    '/register',
  ];

  const fs = require('fs');
  // Try to use system Chrome/Chromium if available to avoid downloading browsers
  let launchOptions = { headless: true };
  const possiblePaths = [];
  if (process.platform === 'win32') {
    possiblePaths.push('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
    possiblePaths.push('C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe');
  } else if (process.platform === 'darwin') {
    possiblePaths.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  } else {
    possiblePaths.push('/usr/bin/google-chrome-stable');
    possiblePaths.push('/usr/bin/google-chrome');
    possiblePaths.push('/usr/bin/chromium-browser');
    possiblePaths.push('/usr/bin/chromium');
  }

  const exe = possiblePaths.find((p) => fs.existsSync(p));
  if (exe) {
    launchOptions.executablePath = exe;
    console.log('Using system Chrome at', exe);
  } else {
    console.log('No system Chrome found; attempting Playwright bundled browser (may require install)');
  }

  const browser = await playwright.chromium.launch(launchOptions);
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      results.push({ type: 'console', text: msg.text() });
    }
  });

  page.on('pageerror', (err) => {
    results.push({ type: 'pageerror', text: err.message });
  });

  page.on('requestfailed', (req) => {
    results.push({ type: 'requestfailed', url: req.url(), failure: req.failure()?.errorText });
  });

  for (const r of routes) {
    const url = new URL(r, base).toString();
    console.log(`Visiting ${url}`);
    try {
      const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 }).catch(e => null);
      const status = resp ? resp.status() : 'no-response';
      console.log(`  status: ${status}`);
      await page.waitForTimeout(500);
    } catch (e) {
      results.push({ type: 'navigation', route: r, error: e.message });
    }
  }

  await browser.close();

  if (results.length === 0) {
    console.log('No console errors or failed requests detected.');
    process.exit(0);
  }

  console.log('\nDetected issues:');
  results.forEach((it, i) => console.log(i + 1 + '. ', it));

  process.exit(1);
})();
