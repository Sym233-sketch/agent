const test=require('node:test'),assert=require('node:assert/strict');
const body=require('../server/json-body.cjs'),{request}=require('../public/api-response.js');
async function* input(s){yield Buffer.from(s)}
test('JSON body rejects malformed and non-object values',async()=>{
  for(const value of ['null','[]','1','true','"text"','{'])await assert.rejects(body(input(value)),{status:400});
  assert.deepEqual(await body(input('')) ,{});
  assert.deepEqual(await body(input('{"message":"你好"}')),{message:'你好'});
  await assert.rejects(body(input(' '.repeat(1000001))),{status:413});
});
test('both clients preserve status and report network and non-JSON failures',async t=>{
  const mock=t.mock.method(globalThis,'fetch');
  mock.mock.mockImplementation(async()=>new Response('<html>unavailable</html>',{status:502}));
  await assert.rejects(request('/api/example'),e=>e.status===502&&/暂时不可用/.test(e.message));
  mock.mock.mockImplementation(async()=>new Response('{"error":"请先登记"}',{status:401}));
  await assert.rejects(request('/api/example'),{status:401,message:'请先登记'});
  mock.mock.mockImplementation(async()=>{throw new TypeError('Failed to fetch')});
  await assert.rejects(request('/api/example'),/查看进度/);
  mock.mock.mockImplementation(async()=>new Response('null'));
  await assert.rejects(request('/api/example'),/格式异常/);
  mock.mock.mockImplementation(async()=>new Response('{"ok":true}'));
  assert.deepEqual(await request('/api/example'),{ok:true});
});
