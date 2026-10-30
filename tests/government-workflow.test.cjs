'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const { spawn } = require('node:child_process');
const createWorkflow = require('../server/policy-workflow.cjs');
const createMatcher = require('../server/agent/pioneer-match.cjs');
const { docx } = require('../server/workbench.cjs');

async function harness(t, {seed=false}={}) {
  const socket = net.createServer(); await new Promise(r => socket.listen(0, '127.0.0.1', r));
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mincetong-gov-workflow-'));
  let child;
  async function start() {
    child = spawn(process.execPath, ['tests/fixtures/government-model.cjs'], { cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, PORT: String(port), MINCETONG_PORT: String(port), MINCETONG_DATA_DIR: dir, MINCETONG_CLOUD: 'false', RENDER: 'false', MINCETONG_SEED_PIONEERS: String(seed) }, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(Error('Test server startup timed out')), 10000);
      child.once('exit', code => { clearTimeout(timer); reject(Error('Test server exited: ' + code)); });
      child.stdout.on('data', data => { if (String(data).includes('Mincetong local:')) { clearTimeout(timer); resolve(); } }); });
  }
  async function stop() { if (child?.exitCode !== null) return; await new Promise(r => { child.once('exit', r); child.kill(); }); }
  await start();
  t.after(async () => { await stop(); assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep)); fs.rmSync(dir, { recursive: true, force: true }); });
  const base = 'http://127.0.0.1:' + port;
  async function request(route, data, token, method) {
    const response = await fetch(base + route, { method: method || (data === undefined ? 'GET' : 'POST'),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) });
    return { status: response.status, value: await response.json() };
  }
  async function upload(text) { const response = await fetch(base + '/api/files/convert', { method: 'POST', headers: { 'X-File-Name': encodeURIComponent('养老服务方案（虚构测试）.docx') }, body: await docx(text) }); assert.equal(response.status, 201); return response.json(); }
  async function ready(id) { for (let n = 0; n < 80; n++) { const result = await request('/api/government/workflow/' + id); if (!['pending', 'running'].includes(result.value.status)) return result.value; await new Promise(r => setTimeout(r, 10)); } throw Error('Matching did not settle'); }
  return { request, upload, ready, restart: async () => { await stop(); await start(); } };
}
const deadline = () => new Date(Date.now() + 7 * 86400000 + 8 * 3600000).toISOString().slice(0, 10);
const profile = (name, extra = {}) => ({ displayName: name, job: '退休人员', facts: { senior: 'yes', needCare: true }, topics: ['养老照护'], joined: true, proactive: false, ...extra });

test('reviewed publication preserves long text, automatically matches once, and only delivers after staff confirmation; receipts survive restart', async t => {
  const h = await harness(t);
  const resident = (await h.request('/api/residents', profile('养老参与者（虚构）'))).value;
  await h.request('/api/residents', profile('未参加（虚构）', { joined: false }));
  await h.request('/api/residents', profile('教育参与者（虚构）', { job: '教师', facts: { needStudy: true }, topics: ['教育服务'] }));
  const file = await h.upload('养老助餐服务方案（虚构）\n\n统一按排社区助餐。\n\n' + '老年服务内容，具体安排待核对。'.repeat(1800) + '\n\n长文末尾完整保留。');
  const missing = await h.request('/api/government/workflow/publish', { fileId: file.id, kind: 'consultation', domain: 'elder', deadline: deadline(), requestKey: 'no-review', reviewConfirmed: true });
  assert.equal(missing.status, 409);
  let report = (await h.request('/api/workbench/review', { fileIds: [file.id] })).value;
  const issue = report.issues.find(i => i.kind === 'wording'); assert.ok(issue);
  const fixed = (await h.request('/api/workbench/apply', { reportId: report.id, issueId: issue.id })).value;
  const stale = await h.request('/api/government/workflow/publish', { fileId: file.id, reportId: fixed.report.id, kind: 'consultation', domain: 'elder', deadline: deadline(), requestKey: 'stale', reviewConfirmed: true });
  assert.equal(stale.status, 409); assert.match(stale.value.error, /重新审核/);
  report = (await h.request('/api/workbench/review', { fileIds: [file.id] })).value;
  const input = { fileId: file.id, reportId: report.id, title: '社区养老助餐（虚构测试）', kind: 'consultation', domain: 'elder', deadline: deadline(), requestKey: 'publish-one', reviewConfirmed: true };
  assert.equal((await h.request('/api/government/workflow/publish', { ...input, reviewConfirmed: false })).status, 400);
  const published = await h.request('/api/government/workflow/publish', input); assert.equal(published.status, 201);
  const id = published.value.policy.id, result = await h.ready(id);
  assert.equal(result.status, 'ready'); assert.equal(result.candidates.length, 1); assert.equal(result.candidates[0].id, resident.id);
  assert.ok(result.policy.body.length > 20000); assert.ok(result.policy.body.endsWith('长文末尾完整保留。')); assert.ok(result.policy.body.includes('统一安排'));
  assert.equal(result.delivered, 3);
  const calls = (await h.request('/api/agent/status')).value.calls;
  assert.equal((await h.request('/api/government/workflow/publish', input)).value.duplicate, true);
  assert.equal((await h.request('/api/agent/status')).value.calls, calls);
  assert.equal((await h.request('/api/government/workflow/publish', { ...input, title: '更改标题' })).status, 409);
  const delivery = { confirm: true, requestKey: 'send-one', revision: result.revision, recipientIds: [resident.id] };
  assert.equal((await h.request('/api/government/workflow/' + id + '/deliver', { ...delivery, confirm: false })).status, 400);
  assert.equal((await h.request('/api/government/workflow/' + id + '/deliver', { ...delivery, recipientIds: ['invented'] })).status, 409);
  assert.equal((await h.request('/api/government/workflow/' + id + '/deliver', delivery)).value.delivered, 0);
  assert.equal((await h.request('/api/government/workflow/' + id + '/deliver', delivery)).value.duplicate, true);
  const inbox = (await h.request('/api/inbox', undefined, resident.token)).value.messages;
  const message = inbox.find(m => m.policyId === id); assert.ok(message); assert.equal('workflow' in message.policy, false);assert.equal('review' in message.policy,false);
  await h.request('/api/messages/' + message.id + '/read', {}, resident.token);
  await h.request('/api/messages/' + message.id + '/reply', { text: '虚构测试：建议增加助餐时间。', clientId: 'reply-one' }, resident.token);
  await h.restart();
  const after = (await h.request('/api/government')).value.policies.find(p => p.id === id);
  assert.equal(after.receipts.length, 3); const receipt = after.receipts.find(r => r.residentId === resident.id); assert.ok(receipt.readAt); assert.equal(receipt.replies.length, 1);
  const stored = (await h.request('/api/government/workflow/' + id)).value;
  assert.equal(stored.status, 'ready'); assert.equal(stored.policy.body, result.policy.body);
  await h.request('/api/residents/me', profile('养老参与者（虚构）', { joined: false }), resident.token, 'PUT');
  const revoked = (await h.request('/api/government/workflow/' + id)).value;
  assert.equal(revoked.status, 'stale'); assert.equal(revoked.candidates.length, 0);
  assert.equal((await h.request('/api/government/workflow/' + id + '/deliver', { ...delivery, requestKey: 'after-revocation' })).status, 409);
});

test('matching screens all authorised participants beyond 120 without duplicate or hallucinated IDs, and does not call a model for an empty set', async () => {
  const residents = Array.from({ length: 137 }, (_, i) => ({ id: String(i).padStart(4, '0'), displayName: '虚构' + i, joined: true, job: '退休人员', facts: { needCare: true }, topics: [] }));
  const text = '社区养老助餐服务面向有相关需求的居民，具体服务安排请核对。'; let calls = 0;
  const match = createMatcher({ db: { residents }, provider: { key: 'unit-only' }, eligible: () => ({ ok: true, reason: '养老标签' }), schema: () => ({}), run: async (_, config) => {
    calls++; assert.equal(config.input.candidates.length, 120);
    await config.execute('record_pioneer_matches', { matches: [{ id: residents[0].id, quote: text.slice(0, 15), reason: '虚构测试关联' }, { id: residents[0].id, quote: text.slice(0, 15), reason: '重复' }, { id: 'invented', quote: text, reason: '无效' }] }); return { answer: '已按片段核对' };
  } });
  const result = await match({ text, domain: 'elder' }); assert.equal(calls, 1); assert.equal(result.candidates.length, 137);
  assert.equal(new Set(result.candidates.map(c => c.id)).size, 137); assert.equal(result.reviewedCandidates, 120);
  assert.equal(result.candidates.filter(c => c.source === 'model').length, 1);assert.equal(result.candidates[0].reason,'虚构测试关联');
  const empty = createMatcher({ db: { residents: [] }, provider: { key: 'unit-only' }, eligible() {}, run() { throw Error('No credit should be used'); } });
  assert.equal((await empty({ text, domain: 'elder' })).candidates.length, 0);
});

test('model failures keep explicit rule candidates, and membership deleted during review is never returned', async () => {
  const text = '养老助餐相关服务安排，先征询参与者建议，具体条件由工作人员核对。';
  const db = { residents: [{ id: 'one', displayName: '虚构', joined: true, job: '退休人员', facts: { needCare: true }, topics: [] }] };
  const options = { db, provider: { key: 'unit-only' }, eligible: () => ({ ok: true, reason: '相关' }), schema: () => ({}) };
  const failed = await createMatcher({ ...options, run: async (_,config) => {await config.execute('record_pioneer_matches',{matches:[{id:'one',reason:'尚未完成的中间结果',quote:text.slice(0,10)}]});throw Error('offline failure');} })({ text, domain: 'elder' });
  assert.equal(failed.mode, 'rules-fallback'); assert.equal(failed.candidates.length, 1);assert.equal(failed.candidates[0].source,'rules');assert.notEqual(failed.candidates[0].reason,'尚未完成的中间结果');assert.match(failed.notice, /未完成/);
  const removed = await createMatcher({ ...options, run: async () => { db.residents.length = 0; return { answer: '测试期间退出' }; } })({ text, domain: 'elder' });
  assert.equal(removed.candidates.length, 0);
});

test('failed and restarted matching jobs stay recoverable and never deliver in the background', async () => {
  const p = { id: 'p', title: '虚构', body: '养老助餐服务仅作本地回归测试，尚未执行递送。', kind: 'consultation', domain: 'elder', deadline: deadline(), workflow: { status: 'running', candidates: [], deliveries: [] } };
  const db = { policies: [p], residents: [], messages: [], requests: {} }; let failMatch = true;
  const flow = createWorkflow({ db, changed() {}, agents: { match: async () => { if (failMatch) throw Error('offline failure'); return { mode: 'rules', candidates: [] }; } }, eligible: () => ({ ok: true }) });
  assert.equal(flow.status(p).status, 'interrupted'); await flow.start(p); assert.equal(flow.status(p).status, 'error');
  failMatch = false; await flow.start(p); assert.equal(flow.status(p).status, 'ready'); assert.equal(db.messages.length, 0);
});

test('deadlines reject impossible dates and expire at the end of the China calendar day', () => {
  const valid = createWorkflow.deadlineValid;
  assert.equal(valid('2026-02-31', Date.parse('2026-01-01')), false);
  assert.equal(valid('2026-10-28', Date.parse('2026-10-28T15:59:59Z')), true);
  assert.equal(valid('2026-10-28', Date.parse('2026-10-28T16:00:00Z')), false);
});


test('policy notifications require proactive permission, changed facts invalidate recipients, and reruns require a fresh revision', async t => {
  const h=await harness(t);
  const a=(await h.request('/api/residents',profile('已开消息（虚构）',{proactive:true}))).value;
  const b=(await h.request('/api/residents',profile('未开消息（虚构）',{proactive:false}))).value;
  const file=await h.upload('养老助餐服务通知（虚构）\n\n养老服务面向有相关需求的社区居民，仅作离线测试。');
  const report=(await h.request('/api/workbench/review',{fileIds:[file.id]})).value;
  const published=await h.request('/api/government/workflow/publish',{fileId:file.id,reportId:report.id,title:'养老服务通知（虚构）',kind:'publication',domain:'elder',deadline:deadline(),requestKey:'notification',reviewConfirmed:true});
  assert.equal(published.status,201);const id=published.value.policy.id,initial=await h.ready(id);
  assert.deepEqual(initial.candidates.map(c=>c.id),[a.id]);assert.equal(initial.delivered,0);
  const send={confirm:true,requestKey:'notification-delivery',revision:initial.revision,recipientIds:[a.id]};
  assert.equal((await h.request('/api/government/workflow/'+id+'/deliver',{...send,recipientIds:[b.id]})).status,409);
  await h.request('/api/residents/me',profile('已开消息（虚构）',{proactive:true,district:'测试社区'}),a.token,'PUT');
  const stale=(await h.request('/api/government/workflow/'+id)).value;assert.equal(stale.status,'stale');assert.deepEqual(stale.candidates,[]);
  assert.equal((await h.request('/api/government/workflow/'+id+'/deliver',send)).status,409);
  await h.request('/api/government/workflow/'+id+'/match',{force:true});const fresh=await h.ready(id);
  assert.equal(fresh.status,'ready');assert.notEqual(fresh.revision,initial.revision);
  assert.equal((await h.request('/api/government/workflow/'+id+'/deliver',send)).status,409);
  const valid={...send,revision:fresh.revision};assert.equal((await h.request('/api/government/workflow/'+id+'/deliver',valid)).value.delivered,1);
  assert.equal((await h.request('/api/government/workflow/'+id+'/deliver',{...valid,recipientIds:[b.id]})).status,409);
  assert.equal((await h.request('/api/government/workflow/'+id+'/deliver',{...valid,requestKey:'same-person-twice'})).value.delivered,0);
  assert.equal((await h.request('/api/inbox',undefined,b.token)).value.messages.length,0);
});


test('legacy policy ingestion keeps a large Chinese JSON body intact and rejects over-limit text rather than truncating it', async t => {
  const h=await harness(t),text='社区养老助餐'.repeat(24000)+'末尾不截短。';
  const input={title:'大正文传输（虚构测试）',body:text,kind:'publication',domain:'elder',audience:'matched',requestKey:'legacy-long-body'};
  const saved=await h.request('/api/policies',input);assert.equal(saved.status,201);assert.equal(saved.value.policy.body,text);
  const over=await h.request('/api/policies',{...input,body:'政'.repeat(150001),requestKey:'overlong-body'});assert.equal(over.status,400);assert.match(over.value.error,/不会截短/);
});

test('reviewed files and reports survive restart before publication, with visible government delivery receipts',async t=>{
const h=await harness(t),resident=(await h.request('/api/residents',profile('回执测试'))).value;
const file=await h.upload('社区养老服务草案。拟完善老年人社区助餐与照护服务，欢迎先行者提出建议。');
const report=(await h.request('/api/workbench/review',{fileIds:[file.id]})).value;
await h.restart();
const published=await h.request('/api/government/workflow/publish',{fileId:file.id,reportId:report.id,kind:'consultation',domain:'elder',deadline:deadline(),requestKey:'restart-publish',reviewConfirmed:true});assert.equal(published.status,201,JSON.stringify(published.value));
const inbox=(await h.request('/api/inbox',undefined,resident.token)).value;const message=inbox.messages.find(m=>m.policy.id===published.value.policy.id);assert.ok(message);
await h.request('/api/messages/'+message.id+'/read',{},resident.token);
await h.request('/api/messages/'+message.id+'/reply',{text:'建议增加晚间服务。',clientId:'receipt-reply'},resident.token);
const policy=(await h.request('/api/government')).value.policies.find(p=>p.id===published.value.policy.id);assert.ok(policy.receipts[0].readAt);assert.equal(policy.receipts[0].replies[0].text,'建议增加晚间服务。');
});
test('enabled synthetic population is restored idempotently and participates in automatic matching',async t=>{
const h=await harness(t,{seed:true});let catalog=(await h.request('/api/catalog')).value;assert.equal(catalog.syntheticResidents,3000);
const result=(await h.request('/api/agent/match',{text:'社区养老照护服务面向老年群体，征询服务改进建议。',kind:'consultation',domain:'elder',deadline:deadline()})).value;
assert.equal(result.totalCandidates,3000);assert.ok(result.candidates.some(c=>c.name.includes('虚构')));
await h.restart();catalog=(await h.request('/api/catalog')).value;assert.equal(catalog.syntheticResidents,3000);
});

test('government policy notices remain visible in the recipient inbox instead of being dropped by catalog filtering',async t=>{
const h=await harness(t),r=(await h.request('/api/residents',profile('通知接收者',{proactive:true}))).value;
const posted=await h.request('/api/policies',{title:'社区养老服务通知',body:'社区养老服务通知，面向相关居民提供照护咨询，请核实办理条件。',kind:'publication',domain:'elder',audience:'all',requestKey:'notice-visible'});assert.equal(posted.status,201);
const inbox=(await h.request('/api/inbox',undefined,r.token)).value;const m=inbox.messages.find(m=>m.policy.id===posted.value.policy.id);assert.ok(m,'staff-authored publication must not be filtered as a non-catalog policy');
const summary=await h.request('/api/resident-document?message='+m.id+'&format=agent',{} ,r.token);assert.equal(summary.status,200);assert.equal(summary.value.offer,'需要我帮您填写吗？');
});
