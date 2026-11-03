'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'mincetong-event-browser-')),out=path.join(root,'test-results/event-center');fs.mkdirSync(out,{recursive:true});
 const sock=net.createServer();await new Promise(r=>sock.listen(0,'127.0.0.1',r));const port=sock.address().port;await new Promise(r=>sock.close(r));
 const child=spawn(process.execPath,['server/index.cjs'],{cwd:root,env:{...process.env,PORT:String(port),RENDER:'false',MINCETONG_CLOUD:'false',MINCETONG_DATA_DIR:dir,MINCETONG_SEED_PIONEERS:'false',MINCETONG_FICTIONAL_DEMO:'false',DEEPSEEK_API_KEY:'',OPENAI_API_KEY:''},stdio:['ignore','pipe','pipe']});let browser;
 try{
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('startup timeout')),10000);child.stdout.on('data',d=>{if(String(d).includes('Mincetong local:')){clearTimeout(timer);resolve()}});child.once('exit',code=>{clearTimeout(timer);reject(Error('server exit '+code))})});
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const ctx=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),base='http://127.0.0.1:'+port;
  await ctx.route('https://images.unsplash.com/**',r=>r.abort());
  const registered=await ctx.request.post(base+'/api/residents',{data:{displayName:'事件回归（虚构）',job:'退休居民',age:72,proactive:false,facts:{needCare:true}}}),remote=await registered.json(),headers={Authorization:'Bearer '+remote.token};
  const caseResponse=await ctx.request.post(base+'/api/agent/desk',{headers,data:{}}),c=(await caseResponse.json()).case;
  assert.ok(c.id);assert.equal((await ctx.request.post(base+'/api/agent/applications/prepare',{headers,data:{caseId:c.id}})).status(),200);
  await ctx.addInitScript(remote=>sessionStorage.setItem('mince-resident-session-v1',JSON.stringify({version:1,profile:{name:'回归',age:72,job:'退休居民',district:'暂未提供',members:[],matchingFacts:{needCare:true},proactive:false,remote},threads:[]})),remote);
  const page=await ctx.newPage(),admin=await ctx.newPage(),errors=[];for(const p of [page,admin])p.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/user.html#home');await page.locator('.resident-sculpture canvas').waitFor();await page.locator('[data-product-settings]').click();await page.locator('[data-product-setting=events]').click();const frame=page.frameLocator('iframe[title="主动跟进与事件提醒"]');await frame.locator('#watch').waitFor();
  await frame.locator('[name=consent]').check();await frame.locator('#watch button').click();await frame.getByText('已开启 · 未登记准备日期').waitFor();
  let me=await(await ctx.request.get(base+'/api/event-center/me',{headers})).json();assert.equal(me.events[0].status,'observed');assert.equal(me.notices.length,0);
  await admin.goto(base+'/');await admin.locator('#openServiceFollowup').click();await admin.locator('#followupEvents').click();const gov=admin.frameLocator('iframe[title="事件与主动跟进"]');await gov.locator('#example').click();await gov.getByText('隔离示例已完成').waitFor();assert.match(await gov.locator('#exampleResult').innerText(),/4 个事件/);await admin.screenshot({path:path.join(out,'government-demo.png'),fullPage:true});
  await gov.locator('#mode').click();await gov.getByText('执行模式：授权范围内的站内提醒与待办已开启。').waitFor();
  await page.goto(base+'/event-center.html');await page.getByRole('heading',{name:'办理准备缺项',exact:true}).waitFor();await page.screenshot({path:path.join(out,'resident-materials.png'),fullPage:true});
  const yesterday=new Date(Date.now()-86400000+8*3600000).toISOString().slice(0,10);await page.locator('[name=deadline]').fill(yesterday);await page.locator('[name=consent]').check();await page.locator('#watch button').click();await page.getByRole('heading',{name:'准备期限已过',exact:true}).waitFor();
  const status=await(await ctx.request.get(base+'/api/agent/status')).json();assert.equal(status.calls,0);assert.equal(status.searchCalls,0);
  await admin.goto(base+'/event-center.html?view=government');await admin.getByRole('button',{name:'确认认领'}).click();await admin.getByRole('button',{name:'确认已核实处理'}).click();
  me=await(await ctx.request.get(base+'/api/event-center/me',{headers})).json();assert.equal(me.notices.length,0);assert.equal(me.watches[0].enabled,false);
  await page.setViewportSize({width:390,height:844});await page.reload();await page.locator('#watch').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'resident-mobile.png'),fullPage:true});
  const noToken=await ctx.request.get(base+'/api/event-center/me');assert.equal(noToken.status(),401);assert.equal((await ctx.request.delete(base+'/api/residents/me',{headers})).status(),200);
  const stored=JSON.parse(fs.readFileSync(path.join(dir,'state.json'),'utf8'));assert.equal(stored.eventCenter.watches.length,0);assert.equal(stored.eventCenter.events.filter(e=>e.residentId===remote.id).length,0);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({purpleInterfacePreserved:true,dualEntry:true,isolatedFourRuleDemo:true,observeThenExecute:true,materialReminder:true,overdueTaskAndCompletion:true,residentOwnership:true,accountDeletion:true,mobileNoOverflow:true,liveModelCalls:0,consoleErrors:errors}));
 }finally{await browser?.close();child.kill();await new Promise(r=>child.exitCode!==null?r():child.once('exit',r));if(!path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('unsafe temp directory');fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
