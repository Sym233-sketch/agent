'use strict';
const crypto = require('node:crypto');
const {matchProfile} = require('./pioneer-data.cjs');
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
function deadlineValid(value, now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(value + 'T00:00:00+08:00');
  return Number.isFinite(+date) && new Date(+date + 8 * 3600000).toISOString().slice(0, 10) === value && +new Date(value + 'T23:59:59.999+08:00') >= now;
}

module.exports = function createPolicyWorkflow({ db, changed, agents, workbench, eligible, send, body }) {
  const running = new Map();
  const publicPolicy = p => ({ id: p.id, title: p.title, body: p.body, kind: p.kind, domain: p.domain, deadline: p.deadline, createdAt: p.createdAt, review: p.review });
  const allowed = (r, p) => r.joined === true && eligible(r, { ...p, audience: 'matched', recipientIds: [] }).ok;
  const fingerprint = () => hash(db.residents.filter(r => r.joined).map(r => ({id:r.id,...matchProfile(r)})).sort((a, b) => a.id.localeCompare(b.id)));
  for (const p of db.policies) if (p.workflow?.status === 'running') {
    p.workflow.status = 'interrupted'; p.workflow.error = '服务重启中断了检索，请重新检索；未执行递送。';
  }
  function find(id) {
    const p = db.policies.find(p => p.id === id && p.workflow);
    if (!p) fail(404, '发布任务不存在');
    return p;
  }
  function status(p) {
    const w = p.workflow;
    const stale = w.status === 'ready' && w.fingerprint !== fingerprint();
    return { policy: publicPolicy(p), status: stale ? 'stale' : w.status, error: stale ? '居民档案或参与授权已变化，请重新检索后确认递送。' : w.error || null,
      revision: w.revision, mode: w.mode || null, notice: w.notice || '', coverage: w.coverage || null,
      candidates: w.status === 'ready' && !stale ? (w.candidates || []).filter(c => db.residents.some(r => r.id === c.id && allowed(r, p))) : [],
      delivered: db.messages.filter(m => m.policyId === p.id).length, updatedAt: w.updatedAt };
  }
  function start(p) {
    if (running.has(p.id)) return running.get(p.id);
    Object.assign(p.workflow, { status: 'running', candidates: [], error: null, mode: null, notice: '', coverage: null, revision: crypto.randomUUID(), updatedAt: new Date().toISOString() });
    changed();
    const before = fingerprint();
    const task = (async () => {
      await Promise.resolve();
      try {
        const result = await agents.match({ text: p.body, domain: p.domain, deadline: p.deadline, kind: p.kind });
        const candidates = [...new Map((result.candidates || []).filter(c => db.residents.some(r => r.id === c.id && allowed(r, p))).map(c => [c.id, { id: c.id, name: c.name, role: c.role, reason: c.reason, quote: c.quote, source: c.source || 'rules' }])).values()];
        Object.assign(p.workflow, { status: before === fingerprint() ? 'ready' : 'stale', candidates, fingerprint: before,
          mode: result.mode, notice: result.notice || result.explanation || '',
          coverage: { totalCandidates: result.totalCandidates ?? db.residents.filter(r => r.joined).length, eligibleCandidates: result.eligibleCandidates ?? candidates.length,
            reviewedCandidates: result.reviewedCandidates || 0, policyCharactersReviewed: result.policyCharactersReviewed || 0, policyCharactersTotal: p.body.length },
          updatedAt: new Date().toISOString() });
      } catch (e) {
        Object.assign(p.workflow, { status: 'error', candidates: [], error: '自动检索未完成：' + e.message, updatedAt: new Date().toISOString() });
      } finally { running.delete(p.id); changed(); }
    })();
    running.set(p.id, task); return task;
  }
  function publish(input) {
    const key = typeof input.requestKey === 'string' ? input.requestKey.trim() : '';
    if (!key || key.length > 100) fail(400, '缺少有效的发布请求编号');
    const requestHash = hash({ fileId: input.fileId, reportId: input.reportId, title: input.title, kind: input.kind, domain: input.domain, deadline: input.deadline, reviewConfirmed: input.reviewConfirmed });
    if (Object.hasOwn(db.requests, key)) {
      const old = db.policies.find(p => p.id === db.requests[key]);
      if (!old?.workflow || old.workflow.requestHash !== requestHash) fail(409, '同一请求编号的发布内容已变化，请重新确认');
      return { ...status(old), duplicate: true };
    }
    if (!['consultation', 'publication'].includes(input.kind) || !['education', 'elder', 'employment', 'general'].includes(input.domain)) fail(400, '请选择文件类型和政策领域');
    if (!deadlineValid(input.deadline)) fail(400, '请设置有效且尚未截止的征询日期（北京时间）');
    const snapshot = workbench.publicationSnapshot(input);
    const title = String(input.title || snapshot.title).trim();
    if (!title || title.length > 200) fail(400, '政策标题须为1至200个字符');
    const p = { id: crypto.randomUUID(), ...snapshot, title, kind: input.kind, domain: input.domain, deadline: input.deadline,
      audience: 'selected', recipientIds: [], createdAt: new Date().toISOString(), requestKey: key,
      workflow: { status: 'pending', requestHash, candidates: [], deliveries: [] } };
    db.policies.push(p); Object.defineProperty(db.requests, key, { value: p.id, enumerable: true, writable: true, configurable: true });
    if (p.kind === 'consultation') for (const r of db.residents.filter(r => !r.synthetic)) {
      db.messages.push({ id: crypto.randomUUID(), residentId: r.id, policyId: p.id, createdAt: new Date().toISOString(), readAt: null, reason: '测试直送，无需筛查', replies: [], deliverySource: 'test-direct' });
    }
    changed();
    start(p); // Matching starts after saving the reviewed publication; this never sends a message.
    return status(p);
  }
  function deliver(p, input) {
    if (input.confirm !== true) fail(400, '请确认选定的人选后再递送');
    if (typeof input.requestKey !== 'string' || !input.requestKey.trim() || input.requestKey.length > 100) fail(400, '缺少有效的递送请求编号');
    if (!Array.isArray(input.recipientIds) || !input.recipientIds.length || input.recipientIds.length > 5000 || input.recipientIds.some(id => typeof id !== 'string')) fail(400, '请至少选择一位检索结果中的先行者');
    const ids = [...new Set(input.recipientIds)].sort(), requestHash = hash({ ids, revision: input.revision });
    const previous = p.workflow.deliveries.find(d => d.requestKey === input.requestKey);
    if (previous) {
      if (previous.requestHash !== requestHash) fail(409, '同一请求编号的人选已变化，请重新确认');
      return { delivered: previous.delivered, duplicate: true, totalDelivered: db.messages.filter(m => m.policyId === p.id).length };
    }
    if (status(p).status !== 'ready' || input.revision !== p.workflow.revision) fail(409, '检索结果已变化或尚未完成，请重新检索并核对');
    if (!deadlineValid(p.deadline)) fail(409, '本次征询已截止，未执行递送');
    const candidates = new Set(p.workflow.candidates.map(c => c.id));
    if (ids.some(id => !candidates.has(id) || !db.residents.some(r => r.id === id && allowed(r, p)))) fail(409, '人选已退出计划、撤回消息授权或不在当前检索结果中，请重新核对');
    let delivered = 0;
    for (const id of ids) {
      if (db.messages.some(m => m.policyId === p.id && m.residentId === id)) continue;
      const candidate = p.workflow.candidates.find(c => c.id === id);
      db.messages.push({ id: crypto.randomUUID(), residentId: id, policyId: p.id, createdAt: new Date().toISOString(), readAt: null,
        reason: candidate.reason, replies: [], deliverySource: 'staff-confirmed-pioneer-match' });
      delivered++;
    }
    p.recipientIds = [...new Set(p.recipientIds.concat(ids))];
    p.workflow.deliveries.push({ requestKey: input.requestKey, requestHash, delivered, at: new Date().toISOString() });
    changed();
    return { delivered, totalDelivered: db.messages.filter(m => m.policyId === p.id).length, duplicate: false };
  }
  async function handle(req, res, u) {
    if (!u.pathname.startsWith('/api/government/workflow/')) return false;
    if (u.pathname === '/api/government/workflow/publish' && req.method === 'POST') { const result = publish(await body(req)); send(res, result.duplicate ? 200 : 201, result); return true; }
    const match = u.pathname.match(/^\/api\/government\/workflow\/([a-f0-9-]+)(?:\/(match|deliver))?$/);
    if (!match) fail(404, '发布任务接口不存在');
    const p = find(match[1]);
    if (!match[2] && req.method === 'GET') { send(res, 200, status(p)); return true; }
    if (match[2] === 'match' && req.method === 'POST') {
      const input = await body(req);
      if (!deadlineValid(p.deadline)) fail(409, '征询已截止，请建立新任务');
      if (input.force === true || status(p).status !== 'ready') start(p);
      send(res, 200, status(p)); return true;
    }
    if (match[2] === 'deliver' && req.method === 'POST') { send(res, 200, deliver(p, await body(req))); return true; }
    fail(405, '不支持的方法');
  }
  return { handle, publish, status, deliver, start };
};
module.exports.deadlineValid = deadlineValid;
