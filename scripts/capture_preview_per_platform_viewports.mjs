import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9225;
const PREVIEW_URL = `file://${path.resolve('preview/preview-liquid-glass.html')}`;

const ANDROID_OUT = path.resolve('release/preview_captures/android_411dp');
const IOS_OUT = path.resolve('release/preview_captures/ios_402pt');

fs.mkdirSync(ANDROID_OUT, { recursive: true });
fs.mkdirSync(IOS_OUT, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const SCREENS = [
  'auth',
  'auth_2fa',
  'auth_server',
  'chats',
  'calls',
  'updates',
  'communities',
  'conversation',
  'contacts',
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

async function main() {
  console.log('[Preview Viewports] Launching headless Chrome...');
  const chromeProc = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--window-size=1600,1200',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ]);

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch {
      await sleep(200);
    }
  }

  if (!versionData) {
    chromeProc.kill();
    throw new Error('Failed to connect to Chrome CDP');
  }

  console.log('[Preview Viewports] Connected to Chrome CDP:', versionData.Browser);

  const newTabRes = await fetch(
    `http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(PREVIEW_URL)}`,
    { method: 'PUT' }
  );
  const tabData = await newTabRes.json();
  const ws = new WebSocket(tabData.webSocketDebuggerUrl);

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

  await new Promise((resolve) => (ws.onopen = resolve));

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
  await sleep(1200);

  const PLATFORMS = [
    {
      name: 'Android',
      width: 411.43,
      height: 891,
      outDir: ANDROID_OUT,
    },
    {
      name: 'iOS',
      width: 402,
      height: 874,
      outDir: IOS_OUT,
    },
  ];

  for (const plat of PLATFORMS) {
    console.log(`\n=== Capturing for ${plat.name} (width: ${plat.width}px, height: ${plat.height}px) ===`);

    // Configure phone dimension & dark mode
    await send('Runtime.evaluate', {
      expression: `(() => {
        const phone = document.getElementById('phoneDevice');
        if (!phone) return;
        phone.style.width = '${plat.width}px';
        phone.style.minWidth = '${plat.width}px';
        phone.style.maxWidth = '${plat.width}px';
        phone.style.height = '${plat.height}px';
        phone.style.minHeight = '${plat.height}px';
        phone.style.maxHeight = '${plat.height}px';
        phone.style.border = 'none';
        phone.style.boxShadow = 'none';
        phone.style.borderRadius = '0px';
        userSettings.appearanceMode = 'dark';
        applyMaterialPreferences();
      })()`,
    });
    await sleep(400);

    // Get bounding box of phoneDevice
    const evalRect = await send('Runtime.evaluate', {
      expression: `(() => {
        const phone = document.getElementById('phoneDevice');
        const rect = phone.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      })()`,
      returnByValue: true,
    });
    const rect = evalRect.result.value;

    // Capture standard screens
    for (const screen of SCREENS) {
      await send('Runtime.evaluate', {
        expression: `navigateTo('${screen}');`,
      });
      await sleep(250);

      // Reset scroll
      await send('Runtime.evaluate', {
        expression: `(() => {
          const body = document.querySelector('.phone-body');
          if (body) body.scrollTop = 0;
        })()`,
      });
      await sleep(150);

      const shot = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 },
      });
      const topFile = path.join(plat.outDir, `preview_${screen}_top.png`);
      fs.writeFileSync(topFile, Buffer.from(shot.data, 'base64'));
      console.log(`  [${plat.name}] Saved top: preview_${screen}_top.png`);

      // Check if scrollable
      const canScrollRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const body = document.querySelector('.phone-body');
          if (!body) return false;
          return (body.scrollHeight - body.clientHeight) > 80;
        })()`,
        returnByValue: true,
      });

      if (canScrollRes.result?.value) {
        await send('Runtime.evaluate', {
          expression: `(() => {
            const body = document.querySelector('.phone-body');
            if (body) body.scrollTop = body.scrollHeight;
          })()`,
        });
        await sleep(200);

        const shotBottom = await send('Page.captureScreenshot', {
          format: 'png',
          clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 },
        });
        const bottomFile = path.join(plat.outDir, `preview_${screen}_bottom.png`);
        fs.writeFileSync(bottomFile, Buffer.from(shotBottom.data, 'base64'));
        console.log(`  [${plat.name}] Saved bottom: preview_${screen}_bottom.png`);
      }
    }

    // Capture Call Overlay simulation
    console.log(`  [${plat.name}] Capturing call overlay...`);
    await send('Runtime.evaluate', {
      expression: `(() => {
        navigateTo('chats');
        triggerCallSimulation();
      })()`,
    });
    await sleep(300);
    const shotCall = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 },
    });
    fs.writeFileSync(path.join(plat.outDir, 'preview_call_overlay.png'), Buffer.from(shotCall.data, 'base64'));

    // Capture Device Revocation simulation
    console.log(`  [${plat.name}] Capturing device revocation alert...`);
    await send('Runtime.evaluate', {
      expression: `(() => {
        document.querySelector('.dialog-overlay')?.remove();
        triggerRevocationAlert();
      })()`,
    });
    await sleep(300);
    const shotRevoke = await send('Page.captureScreenshot', {
      format: 'png',
      clip: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, scale: 1 },
    });
    fs.writeFileSync(path.join(plat.outDir, 'preview_revocation_alert.png'), Buffer.from(shotRevoke.data, 'base64'));

    // Clean up modal
    await send('Runtime.evaluate', {
      expression: `(() => {
        document.querySelector('.dialog-overlay')?.remove();
      })()`,
    });
  }

  ws.close();
  chromeProc.kill();
  console.log('\n[Preview Viewports] Complete! Captured previews for both Android (411.43dp) and iOS (402pt).');
}

main().catch((err) => {
  console.error('[Error]', err);
  process.exit(1);
});

