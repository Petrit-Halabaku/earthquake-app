/**
 * Headless verification harness — drives Chrome via the DevTools Protocol to:
 *   - load the app, collect console errors / page exceptions
 *   - capture a full-page screenshot (desktop or mobile)
 *   - optionally exercise UI (click a range pill, move the mag slider)
 *
 * Usage: node scripts/verify.mjs <url> <outfile> [mobile] [interact]
 * Requires a Chrome already launched with --remote-debugging-port=9222.
 */
const [, , url, outfile, ...flags] = process.argv;
const mobile = flags.includes("mobile");
const interact = flags.includes("interact");
const PORT = 9222;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpTargets() {
  const res = await fetch(`http://localhost:${PORT}/json`);
  return res.json();
}

async function run() {
  // Open a fresh tab.
  const newTab = await (await fetch(`http://localhost:${PORT}/json/new?about:blank`, { method: "PUT" })).json()
    .catch(async () => (await fetch(`http://localhost:${PORT}/json/new?about:blank`)).json());
  const wsUrl = newTab.webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => (ws.onopen = res));

  let id = 0;
  const pending = new Map();
  const events = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    } else if (msg.method) {
      events.push(msg);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const myId = ++id;
      pending.set(myId, res);
      ws.send(JSON.stringify({ id: myId, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");

  const width = mobile ? 390 : 1440;
  const height = mobile ? 844 : 900;
  await send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: mobile ? 3 : 1, mobile,
  });

  const errors = [];
  const log = (msg) => {
    if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
      errors.push("console.error: " + msg.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
    }
    if (msg.method === "Runtime.exceptionThrown") {
      errors.push("exception: " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    }
    if (msg.method === "Log.entryAdded" && msg.params.entry.level === "error") {
      errors.push("log: " + msg.params.entry.text);
    }
  };
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
    else if (msg.method) log(msg);
  };

  await send("Page.navigate", { url });
  await sleep(6000); // allow USGS fetch + render

  // Scroll through the page so ScrollTrigger reveals fire, as a real user would.
  await send("Runtime.evaluate", {
    expression: `(async () => {
      const h = document.body.scrollHeight;
      for (let y = 0; y <= h; y += window.innerHeight * 0.6) {
        window.scrollTo(0, y);
        await new Promise(r => setTimeout(r, 250));
      }
      window.scrollTo(0, 0);
    })()`,
    awaitPromise: true,
  });
  await sleep(800);

  if (interact) {
    // Click "7 days" pill, then nudge the magnitude slider.
    await send("Runtime.evaluate", {
      expression: `document.querySelector('[data-range="week"]').click()`,
    });
    await sleep(3500);
    await send("Runtime.evaluate", {
      expression: `(() => { const s = document.getElementById('mag-slider'); s.value = '4'; s.dispatchEvent(new Event('input', {bubbles:true})); })()`,
    });
    await sleep(800);
  }

  // Read a few key DOM values for a sanity assertion.
  const probe = await send("Runtime.evaluate", {
    expression: `JSON.stringify({
      count: document.getElementById('filtered-count').textContent,
      rows: document.querySelectorAll('#quake-tbody tr').length,
      live: document.querySelector('.live-text').textContent,
      magChartCanvas: !!document.querySelector('#chart-mag canvas'),
      freqChartCanvas: !!document.querySelector('#chart-freq canvas'),
      statusHidden: document.getElementById('data-status').hidden,
      statusText: document.getElementById('data-status-text').textContent,
      deckOpacity: getComputedStyle(document.querySelector('.control-deck')).opacity,
    })`,
    returnByValue: true,
  });

  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
    clip: undefined,
  });
  const { writeFileSync } = await import("node:fs");
  writeFileSync(outfile, Buffer.from(shot.data, "base64"));

  console.log("PROBE:", probe.result.value);
  console.log("ERRORS:", errors.length ? JSON.stringify(errors, null, 2) : "none");

  ws.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
