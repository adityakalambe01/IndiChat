import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const adb=path.join(process.env.HOME,'Library/Android/sdk/platform-tools/adb');
const out='/tmp/indichat-runtime-followup';
const a=(...args)=>execFileSync(adb,['-s','emulator-5554',...args],{encoding:'utf8',timeout:15000});
const state=()=>a('shell','am','instrument','-w','com.indichat.acceptancedriver/.Driver');
async function waitSaved(){const end=Date.now()+8000;while(Date.now()<end){if(!state().includes('content-desc="Save"'))return;await new Promise(r=>setTimeout(r,100));}throw Error('Save action did not finish');}
async function ready(){const end=Date.now()+8000;while(Date.now()<end){const s=state();if(s.includes('content-desc="🚫 On"'))return s;await new Promise(r=>setTimeout(r,100));}throw Error('Appearance screen did not load');}
const nodes=s=>s.match(/<node\b[^>]*>/g)||[];
function tap(label,last=false){const matches=nodes(state()).filter(n=>n.includes(`content-desc="${label}"`));const n=last?matches.at(-1):matches[0];assert.ok(n,label);const [,x,y,r,b]=n.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/);a('shell','input','tap',String((+x + +r)/2|0),String((+y + +b)/2|0));}
function selected(s,label){return nodes(s).some(n=>n.includes(`content-desc="${label}"`)&&n.includes('selected="true"'));}
function open(){a('shell',"am start -a android.intent.action.VIEW -d 'indichat://settings/appearance' -p com.indichat.app");}
open();let before=await ready();fs.writeFileSync(path.join(out,'motion-android-original.xml'),before);
assert.ok(selected(before,'⚙️ System'),'precondition: saved motion preference is system');
tap('🚫 On');const immediate=state();assert.ok(selected(immediate,'🚫 On'),'staged preference changes immediately');fs.writeFileSync(path.join(out,'motion-android-immediate.xml'),immediate);tap('Save Changes');await waitSaved();
a('shell','am','force-stop','com.indichat.app');open();const restored=await ready();assert.ok(selected(restored,'🚫 On'),'saved motion preference persists after force-stop/relaunch');fs.writeFileSync(path.join(out,'motion-android-restored.xml'),restored);
// Restore the original preference through the same public settings UI.
tap('⚙️ System',true);tap('Save Changes');await waitSaved();open();await ready();assert.ok(selected(state(),'⚙️ System'));console.log('PASS immediate Reduced Motion selection, persisted On after relaunch, restored original System preference');
