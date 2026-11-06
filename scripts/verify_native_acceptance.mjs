/** Actual web application's call UI against installed native release builds.
 * Chrome capture is synthetic; call signaling/media/lifecycle logic is unmodified.
 * Native controls use Android UIAutomator or the separate XCTest UI driver.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, execFileSync} from 'node:child_process';
import WebSocket from 'ws';
const platform=process.env.NATIVE_PLATFORM || 'android';
const device=process.env.IOS_SIMULATOR_UDID;
const nativeUser=process.env.NATIVE_USER || (platform==='ios'?'bob':'alice');
const peerUser=process.env.PEER_USER || (platform==='ios'?'charlie':'bob');
const nativeName=platform==='ios'?'Bob Dylan':'Alice Cooper';
const adb=path.join(os.homedir(),'Library/Android/sdk/platform-tools/adb');
const out=path.resolve(process.env.EVIDENCE_DIR || `/tmp/indichat-runtime-followup/acceptance-${platform}`);
fs.mkdirSync(out,{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){const v=await fn();if(v)return v;await delay(300);}throw Error(`Timed out: ${label}`);}
const a=(...args)=>execFileSync(adb,['-s','emulator-5554',...args],{encoding:'utf8',timeout:15000});
let iosRoot,seq=0;
if(platform==='ios' && process.env.IOS_UI_DRIVER!=='cua'){
 assert.ok(device,'Set IOS_SIMULATOR_UDID explicitly');
 const container=execFileSync('xcrun',['simctl','get_app_container',device,'com.indichat.runtime-ui-tests.xctrunner','data'],{encoding:'utf8'}).trim();
 iosRoot=path.join(container,'Documents/IndiChatAcceptance');
}
async function ui(action,extra={}){
 if(platform==='ios' && process.env.IOS_UI_DRIVER==='cua') {
  if(action==='screenshot'){execFileSync('xcrun',['simctl','io',device,'screenshot',path.join(out,extra.name+'.png')]);return;}
  if(action==='assertPresent'||action==='assertAbsent'){const tree=String(await ui('state'));assert.equal(tree.includes("label: '"+extra.label+"'"),action==='assertPresent',extra.label);return;}
  const root='/tmp/indichat-runtime-followup/cua-ui-queue';fs.mkdirSync(root,{recursive:true});
  const file=path.join(root,String(Date.now())+'-'+String(++seq).padStart(4,'0')+'.request.json');fs.writeFileSync(file,JSON.stringify({action,...extra}));
  const result=await until(()=>{try{return JSON.parse(fs.readFileSync(file.replace('.request.json','.result.json'),'utf8'));}catch{return null;}},`Device Hub ${action} ${extra.label||''}`,90000);
  assert.ok(result.ok,'Native UI action must be observed');return result.tree||result;
 }
 if(platform==='ios'){
  if(action==='tap') {
   // Resolve the visible frame once. XCTest's label locator may disappear
   // during its internal quiescence wait; coordinate injection avoids a stale
   // second lookup while retaining explicit label/frame assertions here.
   const tree=String(await ui('state'));
   const line=tree.split('\n').find(line=>line.includes("label: '"+extra.label+"'"));
   assert.ok(line,`Visible native control ${extra.label}`);
   const frame=line.match(/\{\{([\d.-]+), ([\d.-]+)\}, \{([\d.-]+), ([\d.-]+)\}\}/);
   const window=tree.match(/Window \(Main\).*?\{\{[\d.-]+, [\d.-]+\}, \{([\d.-]+), ([\d.-]+)\}\}/);
   assert.ok(frame&&window,'Native control and window frames required');
   const x=(+frame[1]+ +frame[3]/2)/+window[1], y=(+frame[2]+ +frame[4]/2)/+window[2];
   assert.ok(x>0&&x<1&&y>0&&y<1,'Native target must be onscreen');
   action='point';extra={...extra,x,y};
  }
  const id=String(Date.now())+'-'+String(++seq).padStart(4,'0');
  const file=path.join(iosRoot,id+'.request.json');
  fs.writeFileSync(file,JSON.stringify({action,...extra}));
  const result=await until(()=>{try{return JSON.parse(fs.readFileSync(file.replace('.request.json','.result.json'),'utf8'));}catch{return null;}},`XCTest ${action} ${extra.label||''}`,20000);
  if(action==='screenshot')fs.copyFileSync(result.path,path.join(out,extra.name+'.png'));
  return result.tree||result;
 }
 if(action==='state') { const value=a('shell','am','instrument','-w','com.indichat.acceptancedriver/.Driver'); const tree=value.match(/<hierarchy>[\s\S]*<\/hierarchy>/)?.[0]; assert.ok(tree,'Native instrumentation must return a current hierarchy'); return tree; }
 if(action==='tap') {
  const tree=await until(async()=>{const value=await ui('state');return value.includes(extra.label)?value:null;},`native control ${extra.label}`,10000);
  const nodes=tree.match(/<node\b[^>]*>/g)||[];
  const node=nodes.find(n=>n.includes(`content-desc="${extra.label}"`)||n.includes(`text="${extra.label}"`));
  assert.ok(node,`Missing native control: ${extra.label}`);
  const [,x1,y1,x2,y2]=node.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);
  a('shell','input','tap',String((+x1 + +x2)/2|0),String((+y1 + +y2)/2|0));
 }
 if(action==='assertPresent') assert.ok((await ui('state')).includes(extra.label),`Missing ${extra.label}`);
 if(action==='assertAbsent') assert.ok(!(await ui('state')).includes(`content-desc="${extra.label}"`),`Unexpected ${extra.label}`);
 if(action==='screenshot') fs.writeFileSync(path.join(out,extra.name+'.png'),execFileSync(adb,['-s','emulator-5554','exec-out','screencap','-p']));
}
let chrome,ws,cdpId=0;
async function cdp(method,params={}){const id=++cdpId;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{ws.off('message',handler);reject(Error(`CDP timeout ${method}`));},20000);const handler=raw=>{const m=JSON.parse(raw);if(m.id===id){clearTimeout(timer);ws.off('message',handler);if(m.error||m.result?.exceptionDetails)reject(Error(JSON.stringify(m.error||m.result.exceptionDetails)));else resolve(m.result);}};ws.on('message',handler);ws.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){return (await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result?.value;}
async function clickWeb(title){await until(()=>evaluate(`!!Array.from(document.querySelectorAll('button')).find(b=>b.title===${JSON.stringify(title)} || b.getAttribute('aria-label')===${JSON.stringify(title)} || b.textContent.trim()===${JSON.stringify(title)})`),`web button ${title}`);await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.title===${JSON.stringify(title)} || b.getAttribute('aria-label')===${JSON.stringify(title)} || b.textContent.trim()===${JSON.stringify(title)}).click()`);}
async function state(name){fs.writeFileSync(path.join(out,name+'.native.txt'),String(await ui('state')));fs.writeFileSync(path.join(out,name+'.web.txt'),await evaluate('document.body.innerText'));await ui('screenshot',{name});const shot=await cdp('Page.captureScreenshot');fs.writeFileSync(path.join(out,name+'.web.png'),Buffer.from(shot.data,'base64'));}
async function metrics(){return evaluate(`(async()=>{const pc=window.__acceptancePeers.at(-1);if(!pc)return null;const stats=[...(await pc.getStats()).values()];return {state:pc.connectionState,rtp:stats.filter(s=>['inbound-rtp','outbound-rtp'].includes(s.type)).map(s=>({type:s.type,kind:s.kind,packets:s.packetsReceived??s.packetsSent,bytes:s.bytesReceived??s.bytesSent,frames:s.framesDecoded??s.framesEncoded,energy:s.totalAudioEnergy})),videos:Array.from(document.querySelectorAll('video')).map(v=>({class:v.className,width:v.videoWidth,height:v.videoHeight,time:v.currentTime,ready:v.readyState})),tracks:pc.getSenders().map(s=>({kind:s.track?.kind,state:s.track?.readyState,enabled:s.track?.enabled}))}})()`);}
async function connected(video,name){
 let last;
 let m;
 try {
  m=await until(async()=>{
   const v=await metrics();last=v;
   return v?.state==='connected' && ['audio',...(video?['video']:[])].every(kind=>['inbound-rtp','outbound-rtp'].every(type=>v.rtp.some(s=>s.type===type&&s.kind===kind&&s.packets>0)))?v:null;
  },`bidirectional ${video?'audio/video':'audio'} RTP`,25000);
 } catch(error) {
  fs.writeFileSync(path.join(out,name+'.last-metrics.json'),JSON.stringify(last,null,2));
  console.error('Failed RTP evidence:',JSON.stringify(last));
  throw error;
 }
 if(video)assert.ok(m.videos.some(v=>v.class.includes('remote')&&v.width>0&&v.ready>=2),'actual web remote video decoded');
 console.log(name,JSON.stringify(m));fs.writeFileSync(path.join(out,name+'.rtp.json'),JSON.stringify(m,null,2));await state(name);
}

async function ended(name){await until(()=>evaluate(`!document.querySelector('.call-dialog,.call-dialog-video')`),'web call dismissed');await until(async()=>{const tree=String(await ui('state'));return !tree.includes(platform==='ios'?"label: 'End Call'":'content-desc="End Call"');},'native call dismissed',8000);const trackStates=await evaluate(`window.__acceptanceTracks.map(t=>({kind:t.kind,state:t.readyState}))`);assert.ok(trackStates.every(t=>t.state==='ended'),'all web capture tracks released');const peers=await evaluate(`window.__acceptancePeers.map(p=>p.connectionState)`);assert.ok(peers.every(s=>s==='closed'),'all web peer connections closed');await state(name);if(platform==='android'){fs.writeFileSync(path.join(out,name+'.audio.txt'),a('shell','dumpsys','audio'));fs.writeFileSync(path.join(out,name+'.camera.txt'),a('shell','dumpsys','media.camera'));}console.log(name,'browser peers/tracks released; native call UI dismissed');}
async function openCall(video){
 let tree=String(await ui('state'));
 if(platform==='ios' && process.env.IOS_UI_DRIVER==='cua'){
  assert.ok(tree.includes(peer.displayName),'Native conversation must match intended peer');
 } else if(platform==='ios'){
  if(tree.includes("label: 'Audio Call'")){
   await ui('tap',{label:'Back'});
   tree=await until(async()=>{const current=String(await ui('state'));return current.includes("label: 'Settings and Profile'")&&!current.includes("label: 'Audio Call'")?current:null;},'native conversation list after Back',12000);
  }
  if(!tree.includes("label: 'Audio Call'")){
   const line=tree.split('\n').find(line=>line.includes("label: '")&&line.includes(peer.displayName));
   assert.ok(line,'Native existing conversation row must exist');
   const label=line.match(/label: '(.*)'/)?.[1];
   await ui('tap',{label});
   const opened=String(await ui('state'));
   assert.ok(opened.includes("label: '"+peer.displayName+"'"),'Native header must match the intended peer');
  }
 } else if(!tree.includes('content-desc="Audio Call"')) await ui('tap',{label:peer.displayName});
 await ui('tap',{label:video?'Video Call':'Audio Call'});
}

let peer,conversation;
async function run(){
 console.log('Actual web/native acceptance',platform,nativeUser,'peer',peerUser);
 const auth=await fetch('http://localhost:8080/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({usernameOrEmail:peerUser,password:'Password123!'})}).then(r=>r.json());assert.ok(auth.tokens?.accessToken,'test peer auth');peer=auth.user;
 const headers={Authorization:`Bearer ${auth.tokens.accessToken}`};const native=(await fetch(`http://localhost:8080/api/v1/users/search?q=${nativeUser}`,{headers}).then(r=>r.json())).find(u=>u.username===nativeUser);assert.ok(native);
 const conversations=await fetch('http://localhost:8080/api/v1/conversations',{headers}).then(r=>r.json());conversation=conversations.find(c=>c.type==='DIRECT'&&c.members.some(m=>m.userId===native.id));assert.ok(conversation,'use existing direct conversation');
 console.log('Existing conversation resolved');
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'indichat-actual-web-'));
 chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new',`--user-data-dir=${profile}`,'--remote-debugging-port=0','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required','about:blank'],{stdio:'ignore'});
 const port=await until(()=>{try{return fs.readFileSync(path.join(profile,'DevToolsActivePort'),'utf8').split('\n')[0];}catch{return null;}},'Chrome start');const tabs=await fetch(`http://127.0.0.1:${port}/json`).then(r=>r.json());ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.once('open',r);ws.once('error',j);});
 await cdp('Page.enable');await cdp('Page.addScriptToEvaluateOnNewDocument',{source:`window.__acceptancePeers=[];window.__acceptanceTracks=[];const Peer=window.RTCPeerConnection;window.RTCPeerConnection=class extends Peer{constructor(...a){super(...a);window.__acceptancePeers.push(this)}};const gum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async(...args)=>{const stream=await gum(...args);window.__acceptanceTracks.push(...stream.getTracks());return stream;};`});await cdp('Page.navigate',{url:'http://localhost:5174'});await clickWeb(peerUser==='bob'?'Bob':'Charlie');await until(()=>evaluate(`!!document.querySelector('.conversation-item')`),'web login');
 if(await evaluate(`!!Array.from(document.querySelectorAll('button')).find(b=>b.textContent.trim()==='Not Now')`))await clickWeb('Not Now');
 await evaluate(`Array.from(document.querySelectorAll('.conversation-item')).find(e=>e.textContent.includes(${JSON.stringify(nativeName)})).click()`);
 console.log('Actual web UI signed in and conversation open');
 const requested=process.env.CALL_CASES?.split(',');
 assert.ok(!requested||requested.every(c=>['outgoing-audio','incoming-audio','outgoing-video','incoming-video','controls'].includes(c)),'Unknown acceptance case');
 const cases=[['outgoing',false],['incoming',false],['outgoing',true],['incoming',true]].filter(([direction,video])=>!requested||requested.includes(`${direction}-${video?'video':'audio'}`));
 for(const [direction,video] of cases){
  const name=`${direction}-${video?'video':'audio'}`;
  if(direction==='outgoing'){await openCall(video);await clickWeb('Answer Call');}else{await clickWeb(video?'Video Call':'Audio Call');await ui('tap',{label:'Accept Call'});}
  await connected(video,name);
  await ui('tap',{label:'Mute Microphone'});await ui('assertPresent',{label:'Unmute Microphone'});assert.equal((await metrics()).state,'connected');await ui('tap',{label:'Unmute Microphone'});
  if(video){await ui('tap',{label:'Switch Camera'});await ui('tap',{label:'Turn Camera Off'});await ui('assertPresent',{label:'Turn Camera On'});await ui('tap',{label:'Turn Camera On'});}
  const tree=String(await ui('state'));const speaker=tree.includes('Switch to Speakerphone')?'Switch to Speakerphone':'Switch to Earpiece';await ui('tap',{label:speaker});await state(name+'-route');
  if(platform==='android')fs.writeFileSync(path.join(out,name+'.route-audio.txt'),a('shell','dumpsys','audio'));
  await ui('tap',{label:'End Call'});await ended(name+'-ended');
 }
 await openCall(false);await clickWeb('Decline');await ended('web-declined');
 await clickWeb('Audio Call');await ui('tap',{label:'Decline Call'});await ended('native-declined');
 await openCall(false);await ui('tap',{label:'End Call'});await ended('native-cancelled');
 console.log(`PASS selected actual web/native cases: ${cases.map(([d,v])=>d+'-'+(v?'video':'audio')).join(', ')||'controls only'}; decline/cancel checks complete. Inspect native rendering/route evidence separately.`);
}
try{await run();}catch(e){try{await state('failure');}catch{}console.error(e);process.exitCode=1;}finally{try{if(ws?.readyState===1){const has=await evaluate(`!!document.querySelector('button[title="End Call"]')`);if(has)await clickWeb('End Call');}}catch{}ws?.close();chrome?.kill();}
