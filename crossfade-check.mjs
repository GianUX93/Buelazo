import { chromium } from "playwright";
(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto("http://localhost:8080/", { waitUntil: "networkidle" });
  await p.waitForTimeout(3300);
  await p.screenshot({ path: "/tmp/cf-before.png" });
  await p.waitForTimeout(150);
  await p.screenshot({ path: "/tmp/cf-out.png" });
  await p.waitForTimeout(500);
  await p.screenshot({ path: "/tmp/cf-mid.png" });
  await p.waitForTimeout(400);
  await p.screenshot({ path: "/tmp/cf-in.png" });
  await browser.close();
})();
