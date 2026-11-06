// Record observed Device Hub controls for the acceptance coordinator.
// Invoke only after reading current UI state or verifying the requested tap.
import fs from 'node:fs';
const [completedLabel='', ...labels]=process.argv.slice(2);
const root='/tmp/indichat-runtime-followup/cua-ui-queue';
const pending=()=>fs.readdirSync(root).filter(f=>f.endsWith('.request.json')&&!fs.existsSync(root+'/'+f.replace('.request.json','.result.json'))).sort();
let completed=false;
for(let i=0;i<12;i++){
 const f=pending()[0];
 if(!f){await new Promise(r=>setTimeout(r,150));continue;}
 const request=JSON.parse(fs.readFileSync(root+'/'+f));
 if(request.action==='state')fs.writeFileSync(root+'/'+f.replace('.request.json','.result.json'),JSON.stringify({ok:true,tree:labels.map(label=>`label: '${label}'`).join('\n')}));
 else if(request.action==='tap'&&request.label===completedLabel&&!completed){fs.writeFileSync(root+'/'+f.replace('.request.json','.result.json'),JSON.stringify({ok:true}));completed=true;if(process.env.ACTION_ONLY==='1')break;}
 else break;
 await new Promise(r=>setTimeout(r,150));
}
for(const f of pending())console.log(f,fs.readFileSync(root+'/'+f,'utf8'));
