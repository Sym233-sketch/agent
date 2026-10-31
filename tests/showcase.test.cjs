'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),profiles=require('../resources/showcase/resident-profiles.json'),sources=require('../server/national-policy-sources.json');
test('official snapshots and eight fictional registrations produce distinct policy recommendations',async t=>{
 const keys=['elder-meals-action','employment-public-service-2025','youth-employment-2026'];
 for(const key of keys){const source=sources.find(s=>s.key===key),record=JSON.parse(fs.readFileSync(path.join(root,'resources/national-policies',key+'.json')));assert.equal(record.url,source.url);assert.ok(record.text.length>3000);assert.equal(require('node:crypto').createHash('sha256').update(record.text).digest('hex'),record.sha256)}
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mincetong-showcase-'));
 const server=spawn(process.execPath,['server/index.cjs'],{cwd:root,env:{...process.env,PORT:String(port),MINCETONG_DATA_DIR:dir,MINCETONG_SEED_PIONEERS:'false',DEEPSEEK_API_KEY:''},stdio:['ignore','pipe','pipe']});
 t.after(()=>{server.kill();fs.rmSync(dir,{recursive:true,force:true})});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('showcase server timeout')),10000);server.once('exit',code=>{clearTimeout(timer);reject(Error('showcase server exited '+code))});server.stdout.on('data',data=>{if(String(data).includes('Mincetong local:')){clearTimeout(timer);resolve()}})});
 for(const profile of profiles){const response=await fetch('http://127.0.0.1:'+port+'/api/residents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(profile)});assert.equal(response.status,201,profile.id);const resident=await response.json();const result=await(await fetch('http://127.0.0.1:'+port+'/api/policy-recommendations',{headers:{Authorization:'Bearer '+resident.token}})).json();assert.ok(result.items.some(item=>item.key===profile.expectKey&&item.category===profile.expectCategory),profile.id+' missing '+profile.expectKey)}
});
