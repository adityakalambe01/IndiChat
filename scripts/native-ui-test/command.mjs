import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const [device,action,label]=process.argv.slice(2);
const container=execFileSync('xcrun',['simctl','get_app_container',device,'com.indichat.runtime-ui-tests.xctrunner','data'],{encoding:'utf8'}).trim();
const root=path.join(container,'Documents/IndiChatAcceptance');
const id=Date.now()+'.request.json';
const file=path.join(root,id);
fs.writeFileSync(file,JSON.stringify({action,label}));
const deadline=Date.now()+20000;
while(Date.now()<deadline){
 const result=file.replace('.request.json','.result.json');
 if(fs.existsSync(result)){console.log(fs.readFileSync(result,'utf8'));process.exit(0);}
 await new Promise(r=>setTimeout(r,200));
}
throw Error(`Native UI command timeout: ${action} ${label}`);
