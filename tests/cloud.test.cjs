'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const http = require('node:http'), net = require('node:net'), os = require('node:os');
const fs = require('node:fs'), path = require('node:path'), {spawn} = require('node:child_process');
const createAccess = require('../server/cloud-access.cjs');
const fixturePassword = 'unit-test-only-team-password';

test('cloud startup fails closed without a strong password and HTTPS origin', () => {
  assert.equal(createAccess({}).cloud, false);
  assert.throws(() => createAccess({MINCETONG_CLOUD:'true',MINCETONG_TEAM_AUTH:'true'}), /PASSWORD/);
  for (const origin of ['http://example.test','https://example.test/sub','https://u:p@example.test','https://example.test/?x=1']) {
    assert.throws(() => createAccess({MINCETONG_CLOUD:'true',MINCETONG_TEAM_PASSWORD:fixturePassword,MINCETONG_PUBLIC_ORIGIN:origin}));
  }
  assert.equal(createAccess({RENDER:'true',MINCETONG_TEAM_PASSWORD:fixturePassword,RENDER_EXTERNAL_URL:'https://example.test'}).cloud,true);
});

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function start(dir, password = fixturePassword, requirePassword = true) {
  const port = await freePort();
  const child = spawn(process.execPath,['server/index.cjs'],{cwd:path.resolve(__dirname,'..'),env:{...process.env,
    PORT:String(port),MINCETONG_CLOUD:'true',MINCETONG_TEAM_AUTH:String(requirePassword),MINCETONG_PUBLIC_ORIGIN:'https://team.example.test',
    MINCETONG_TEAM_PASSWORD:password,MINCETONG_DATA_DIR:dir,RENDER_GIT_COMMIT:'e324005',RENDER_GIT_BRANCH:'main',
    OPENAI_API_KEY:'',DEEPSEEK_API_KEY:''},stdio:['ignore','pipe','pipe']});
  try {
    await new Promise((resolve,reject) => {
      const timeout = setTimeout(() => reject(Error('Startup timed out')),10000);
      child.once('error',error => {clearTimeout(timeout);reject(error)});
      child.once('exit',code => {clearTimeout(timeout);reject(Error('Server exited: '+code))});
      child.stdout.on('data',data => {if(data.toString().includes('team cloud:')){clearTimeout(timeout);resolve()}});
    });
  } catch (error) { child.kill(); throw error; }
  async function stop() {
    if (child.exitCode !== null) return;
    await new Promise(resolve => {child.once('exit',resolve);child.kill('SIGTERM')});
  }
  function request(target, {method='GET',headers={},body} = {}) {
    return new Promise((resolve,reject) => {
      const req = http.request({hostname:'127.0.0.1',port,path:target,method,headers:{host:'team.example.test',...headers}},res => {
        let text='';res.setEncoding('utf8');res.on('data',chunk => text+=chunk);
        res.on('end',() => resolve({status:res.statusCode,headers:res.headers,text,json:() => JSON.parse(text)}));
      });
      req.setTimeout(5000,() => req.destroy(Error('Request timed out')));req.on('error',reject);req.end(body);
    });
  }
  return {request,stop,port};
}
async function login(server) {
  const response = await server.request('/team-login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded',origin:'https://team.example.test'},body:new URLSearchParams({password:fixturePassword}).toString()});
  assert.equal(response.status,303);
  const cookie = response.headers['set-cookie'][0];
  for (const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/']) assert.ok(cookie.includes(flag));
  return cookie.split(';')[0];
}

test('public cloud opens pages and government APIs without a team cookie while retaining resident identity and origin checks', {timeout:15000}, async t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'mincetong-public-'));
  const server=await start(dir,fixturePassword,false);
  t.after(async()=>{await server.stop();fs.rmSync(dir,{recursive:true,force:true})});
  for(const target of ['/','/user.html','/agent-settings.html','/team.html']){
    const response=await server.request(target);assert.equal(response.status,200);assert.ok(!response.text.includes('id="password"'));
  }
  assert.equal((await server.request('/api/government')).status,200);
  assert.equal((await server.request('/',{headers:{'sec-fetch-site':'cross-site'}})).status,200);
  assert.equal((await server.request('/api/version')).status,200);
  assert.equal((await server.request('/api/inbox')).status,401);
  assert.equal((await server.request('/api/government',{headers:{origin:'https://untrusted.test'}})).status,403);
});

test('optional cloud team login protects files and APIs, preserves resident tokens, and persists shared state across deploys', {timeout:30000}, async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(),'mincetong-cloud-'));
  let server;
  t.after(async () => {await server?.stop();fs.rmSync(dir,{recursive:true,force:true})});
  server = await start(dir);
  assert.equal((await server.request('/healthz',{headers:{host:'internal-render-health'}})).status,200);
  assert.equal((await server.request('/healthz',{method:'HEAD'})).text,'');
  for (const target of ['/api/government','/api/agent/settings','/api/version','/api/inbox']) {
    assert.equal((await server.request(target)).status,401);
  }
  for (const target of ['/','/user.html','/agent-settings.html','/workbench.js']) {
    const response = await server.request(target); assert.match(response.text,/共创口令/); assert.ok(!response.text.includes('DEEPSEEK_API_KEY'));
  }
  assert.equal((await server.request('/team-login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'password=wrong'})).status,401);
  const cookie = await login(server), headers = {cookie};
  for (const target of ['/','/user.html','/agent-settings.html','/team.html']) assert.equal((await server.request(target,{headers})).status,200);
  assert.equal((await server.request('/api/version',{headers})).json().commit,'e324005');
  assert.equal((await server.request('/api/government',{headers:{cookie,host:'untrusted.test'}})).status,403);
  assert.equal((await server.request('/api/government',{headers:{cookie,origin:'https://untrusted.test'}})).status,403);
  assert.equal((await server.request('/api/government',{headers:{cookie,'sec-fetch-site':'cross-site'}})).status,403);
  assert.equal((await server.request('/api/government',{headers:{cookie:cookie+'tampered'}})).status,401);
  const registered = await server.request('/api/residents',{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({displayName:'测试居民',proactive:true})});
  assert.equal(registered.status,201);const resident = registered.json();
  assert.equal((await server.request('/api/inbox',{headers:{cookie,authorization:'Bearer '+resident.token}})).status,200);
  assert.equal((await server.request('/api/inbox',{headers:{cookie,authorization:'Bearer wrong'}})).status,401);
  await server.stop();server = await start(dir);
  assert.equal((await server.request('/api/government',{headers})).json().residents.find(r=>r.id===resident.id).id,resident.id);
  assert.equal((await server.request('/api/inbox',{headers:{cookie,authorization:'Bearer '+resident.token}})).status,200);
  const logout = await server.request('/team-logout',{method:'POST',headers});
  assert.equal(logout.status,303);assert.match(logout.headers['set-cookie'][0],/Max-Age=0/);
  // Rotating the team password invalidates existing sessions.
  await server.stop();server = await start(dir,'replacement-unit-test-password');
  assert.equal((await server.request('/api/government',{headers})).status,401);
  for (let i=0;i<30;i++) await server.request('/team-login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'password=wrong'});
  assert.equal((await server.request('/team-login',{method:'POST'})).status,429);
});
