import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9222;
const PREVIEW_URL = `file://${path.resolve('preview/preview-liquid-glass.html')}`;
const OUT_DIR = path.resolve('release/preview_captures');

fs.mkdirSync(OUT_DIR, { recursive: true });

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('Launching headless Chrome...');
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1600,1200',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ]);

  chromeProc.stderr.on('data', (d) => {
    // console.log('[Chrome]', d.toString());
  });

  // Wait for Chrome port to be available
  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch (e) {
      await sleep(200);
    }
  }

  if (!versionData) {
    console.error('Failed to connect to Chrome CDP');
    chromeProc.kill();
    process.exit(1);
  }

  console.log('Connected to Chrome CDP:', versionData.Browser);

  // Create new target / page
  const newTabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(PREVIEW_URL)}`, { method: 'PUT' });
  const tabData = await newTabRes.json();
  const wsUrl = tabData.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);

  let msgId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await new Promise((resolve) => ws.onopen = resolve);

  function send(method, params = {}) {
    const id = msgId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  console.log('Waiting for preview to load...');
  await sleep(1500);

  // Screens to capture
  const screens = [
    'auth',
    'auth_2fa',
    'auth_server',
    'chats',
    'conversation',
    'contacts',
    'calls',
    'updates',
    'communities',
    'settings',
    'settings_profile',
    'settings_account',
    'settings_password',
    'settings_two_factor',
    'settings_phone',
    'settings_passkeys',
    'settings_delete',
    'settings_privacy',
    'settings_appearance',
    'settings_chats',
    'settings_backup',
    'settings_devices',
    'settings_link_code',
    'settings_notifications',
    'settings_language',
    'settings_server',
  ];

  for (const screen of screens) {
    console.log(`Navigating preview to: ${screen}...`);
    await send('Runtime.evaluate', {
      expression: `navigateTo('${screen}');`
    });
    await sleep(350);

    // Get bounding box of #phoneDevice
    const evalRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const el = document.getElementById('phoneDevice');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })()`,
      returnByValue: true
    });

    const rect = evalRes.result?.value;
    if (!rect) {
      console.warn(`Could not find #phoneDevice for screen: ${screen}`);
      continue;
    }

    // Capture top
    const shotTop = await send('Page.captureScreenshot', {
      format: 'png',
      clip: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        scale: 1
      }
    });

    const topPath = path.join(OUT_DIR, `preview_${screen}_top.png`);
    fs.writeFileSync(topPath, Buffer.from(shotTop.data, 'base64'));
    console.log(`Saved: ${topPath}`);

    // If screen is scrollable, scroll to bottom and capture bottom
    const scrollEval = await send('Runtime.evaluate', {
      expression: `(() => {
        const view = document.getElementById('phoneView');
        if (!view) return { canScroll: false };
        const maxScroll = view.scrollHeight - view.clientHeight;
        if (maxScroll > 100) {
          view.scrollTop = maxScroll;
          return { canScroll: true, maxScroll };
        }
        return { canScroll: false };
      })()`,
      returnByValue: true
    });

    if (scrollEval.result?.value?.canScroll) {
      await sleep(250);
      const shotBottom = await send('Page.captureScreenshot', {
        format: 'png',
        clip: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          scale: 1
        }
      });
      const bottomPath = path.join(OUT_DIR, `preview_${screen}_bottom.png`);
      fs.writeFileSync(bottomPath, Buffer.from(shotBottom.data, 'base64'));
      console.log(`Saved bottom: ${bottomPath}`);
    }
  }

  // Also capture Overlays / Dialogs:
  // 1. Discard dialog
  console.log('Capturing preview discard dialog...');
  await send('Runtime.evaluate', {
    expression: `showDialog('Discard Unsaved Changes?', 'You have unsaved edits on this page. Leaving will discard your modifications.', 'Discard & Leave', () => {}, true);`
  });
  await sleep(300);
  const rectDialog = (await send('Runtime.evaluate', {
    expression: `(() => {
      const el = document.getElementById('phoneDevice');
      const rect = el.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    })()`,
    returnByValue: true
  })).result?.value;
  if (rectDialog) {
    const shotDialog = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: rectDialog.x, y: rectDialog.y, width: rectDialog.width, height: rectDialog.height, scale: 1 }
    });
    fs.writeFileSync(path.join(OUT_DIR, 'preview_dialog_discard.png'), Buffer.from(shotDialog.data, 'base64'));
    console.log('Saved preview_dialog_discard.png');
  }

  // 2. Call Simulation
  console.log('Capturing preview incoming call overlay...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const diag = document.getElementById('dialogOverlay');
      if (diag) diag.remove();
      triggerCallSimulation();
    })()`
  });
  await sleep(300);
  if (rectDialog) {
    const shotCall = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: rectDialog.x, y: rectDialog.y, width: rectDialog.width, height: rectDialog.height, scale: 1 }
    });
    fs.writeFileSync(path.join(OUT_DIR, 'preview_call_overlay.png'), Buffer.from(shotCall.data, 'base64'));
    console.log('Saved preview_call_overlay.png');
  }

  // 3. Revocation Alert
  console.log('Capturing preview revocation alert...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const call = document.getElementById('incomingCallOverlay');
      if (call) call.remove();
      triggerRevocationAlert();
    })()`
  });
  await sleep(300);
  if (rectDialog) {
    const shotRevoke = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: rectDialog.x, y: rectDialog.y, width: rectDialog.width, height: rectDialog.height, scale: 1 }
    });
    fs.writeFileSync(path.join(OUT_DIR, 'preview_revocation_alert.png'), Buffer.from(shotRevoke.data, 'base64'));
    console.log('Saved preview_revocation_alert.png');
  }

  ws.close();
  chromeProc.kill();
  console.log('All preview captures successfully completed!');
}

main().catch(err => {
  console.error('Error running capture:', err);
  process.exit(1);
});
