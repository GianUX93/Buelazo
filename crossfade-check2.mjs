import { chromium } from "playwright";
(async () => {
  const browser = await chromium.launch();
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto("http://localhost:8080/", { waitUntil: "networkidle" });
  for (let i = 0; i < 14; i++) {
    await p.waitForTimeout(250);
    await p.screenshot({ path: `/tmp/seq-${String(i).padStart(2,"0")}.png`, clip: {x:96, y:180, width:650, height:170} });
  }
  await browser.close();
})();
