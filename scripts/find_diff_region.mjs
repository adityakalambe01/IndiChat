import { spawn } from 'child_process';
import fs from 'fs';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9231;

async function run() {
  const p = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    'about:blank'
  ]);
  await new Promise(r => setTimeout(r, 1000));
  const newTabRes = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const send = (m, params = {}) => new Promise((resolve) => {
    const curId = id++;
    const handler = (ev) => {
      const d = JSON.parse(ev.data);
      if (d.id === curId) { ws.removeEventListener('message', handler); resolve(d.result); }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id: curId, method: m, params }));
  });
  await send('Page.enable');
  await send('Runtime.enable');

  const b0 = fs.readFileSync('release/android/verification/android_blur_level_0.png').toString('base64');
  const b40 = fs.readFileSync('release/android/verification/android_blur_level_40.png').toString('base64');
  const bSolid = fs.readFileSync('release/android/verification/android_blur_reduced_transparency.png').toString('base64');

  const script = `
    (async () => {
      try {
        const load = src => new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = (e) => reject(e);
          img.src = src;
        });
        const img0 = await load("data:image/png;base64,${b0}");
        const img40 = await load("data:image/png;base64,${b40}");
        const imgSolid = await load("data:image/png;base64,${bSolid}");

        const c = document.createElement("canvas");
        c.width = img0.width; c.height = img0.height;
        const ctx = c.getContext("2d");

        ctx.drawImage(img0, 0, 0);
        const d0 = ctx.getImageData(0, 0, c.width, c.height).data;
        ctx.clearRect(0,0,c.width,c.height);

        ctx.drawImage(img40, 0, 0);
        const d40 = ctx.getImageData(0, 0, c.width, c.height).data;
        ctx.clearRect(0,0,c.width,c.height);

        ctx.drawImage(imgSolid, 0, 0);
        const dSolid = ctx.getImageData(0, 0, c.width, c.height).data;

        let diff0_40_count = 0;
        let minY = 99999, maxY = 0;
        let minX = 99999, maxX = 0;

        const sliceH = 200;
        const slices = [];
        for (let y = 0; y < c.height; y += sliceH) {
          let count = 0;
          for (let sy = y; sy < Math.min(y + sliceH, c.height); sy++) {
            for (let x = 0; x < c.width; x++) {
              const idx = (sy * c.width + x) * 4;
              if (Math.abs(d0[idx] - d40[idx]) > 3 || Math.abs(d0[idx+1] - d40[idx+1]) > 3 || Math.abs(d0[idx+2] - d40[idx+2]) > 3) {
                count++;
                if (sy < minY) minY = sy;
                if (sy > maxY) maxY = sy;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
              }
            }
          }
          slices.push({ y, count });
          diff0_40_count += count;
        }

        // Sort slices to find the peak blur region
        slices.sort((a, b) => b.count - a.count);
        const peak = slices[0];

        // Crop the peak surface region: [x: 50, y: peak.y + 20, w: 980, h: 160]
        const cropY = peak.y + 20;
        const cropH = 160;
        const cropW = 980;
        const cropX = 50;

        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cropCtx = cropCanvas.getContext("2d");

        const analyzeCrop = (img) => {
          cropCtx.clearRect(0, 0, cropW, cropH);
          cropCtx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          const idata = cropCtx.getImageData(0, 0, cropW, cropH).data;

          const gray = new Float32Array(cropW * cropH);
          for (let p = 0; p < gray.length; p++) {
            gray[p] = 0.299 * idata[p*4] + 0.587 * idata[p*4+1] + 0.114 * idata[p*4+2];
          }

          let edgeSum = 0;
          let edgeCount = 0;
          for (let y = 1; y < cropH - 1; y++) {
            for (let x = 1; x < cropW - 1; x++) {
              const idx = y * cropW + x;
              const gx = gray[idx + 1] - gray[idx - 1];
              const gy = gray[idx + cropW] - gray[idx - cropW];
              edgeSum += Math.sqrt(gx * gx + gy * gy);
              edgeCount++;
            }
          }
          const sharpness = edgeSum / edgeCount;

          let sum = 0;
          for (let p = 0; p < gray.length; p++) sum += gray[p];
          const mean = sum / gray.length;
          let variance = 0;
          for (let p = 0; p < gray.length; p++) variance += (gray[p] - mean) ** 2;
          const stdDev = Math.sqrt(variance / gray.length);

          const base64 = cropCanvas.toDataURL("image/png").split(",")[1];
          return { sharpness, stdDev, base64 };
        };

        const res0 = analyzeCrop(img0);
        const res40 = analyzeCrop(img40);
        const resSolid = analyzeCrop(imgSolid);

        return {
          diff0_40_count,
          peakSlice: peak,
          cropCoords: { x: cropX, y: cropY, w: cropW, h: cropH },
          lvl0: { sharpness: res0.sharpness, stdDev: res0.stdDev, b64: res0.base64 },
          lvl40: { sharpness: res40.sharpness, stdDev: res40.stdDev, b64: res40.base64 },
          solid: { sharpness: resSolid.sharpness, stdDev: resSolid.stdDev, b64: resSolid.base64 }
        };
      } catch (err) {
        return { error: err.message };
      }
    })()
  `;
  const res = await send('Runtime.evaluate', { expression: script, awaitPromise: true, returnByValue: true });
  const val = res.result?.value;
  if (val) {
    console.log('Peak Slice:', val.peakSlice);
    console.log('Crop Coordinates:', val.cropCoords);
    console.log(`Blur Level 0:         Sharpness = ${val.lvl0.sharpness.toFixed(3)}, StdDev = ${val.lvl0.stdDev.toFixed(3)}`);
    console.log(`Blur Level 40:        Sharpness = ${val.lvl40.sharpness.toFixed(3)}, StdDev = ${val.lvl40.stdDev.toFixed(3)}`);
    console.log(`Reduced Transparency: Sharpness = ${val.solid.sharpness.toFixed(3)}, StdDev = ${val.solid.stdDev.toFixed(3)}`);

    fs.writeFileSync('release/android/verification/android_blur_crop_level_0.png', Buffer.from(val.lvl0.b64, 'base64'));
    fs.writeFileSync('release/android/verification/android_blur_crop_level_40.png', Buffer.from(val.lvl40.b64, 'base64'));
    fs.writeFileSync('release/android/verification/android_blur_crop_reduced_transparency.png', Buffer.from(val.solid.b64, 'base64'));
    console.log('✔ Successfully saved android_blur_crop_level_0.png, level_40.png, and reduced_transparency.png');
  } else {
    console.log('Error evaluating:', res);
  }
  ws.close();
  p.kill();
}
run();
