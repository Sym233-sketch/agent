'use strict';
process.env.DEEPSEEK_API_KEY = 'government-test-only-never-live';
process.env.MINCETONG_FICTIONAL_DEMO = 'false';
global.fetch = async (url, options) => {
  if (!String(url).startsWith('https://api.deepseek.com/')) throw Error('Government tests block external requests');
  const body = JSON.parse(options.body);
  if (body.input.some(item => item.type === 'function_call_output')) return { ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: '离线夹具核对完成。' }] }] }) };
  const input = JSON.parse(body.input[0].content);
  if (input.document) return {ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:'这份文件涉及社区服务，具体条件仍需核实。'}]}]})};
  const name = input.file ? 'record_edit_suggestions' : 'record_pioneer_matches';
  if (!input.file && !Array.isArray(input.candidates)) throw Error('Unexpected model path in government fixture');
  const args = input.file ? { edits: [] } : { matches: input.candidates.length ? [
    { id: input.candidates[0].id, reason: '已表达养老服务参与意愿，原文涉及助餐。', quote: input.policy.slice(0, 20) },
    { id: input.candidates[0].id, reason: '同一候选重复工具输出。', quote: input.policy.slice(0, 20) },
    { id: 'invented-person', reason: '不得采纳的虚构ID', quote: input.policy.slice(0, 20) }
  ] : [] };
  return { ok: true, json: async () => ({ output: [{ type: 'function_call', name, arguments: JSON.stringify(args), call_id: 'government-fixture', id: 'government-fixture' }] }) };
};
require('../../server/index.cjs');
