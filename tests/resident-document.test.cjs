'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),documents=require('../server/resident-document.cjs');
test('Word export is a real DOCX and retains policy text',async()=>{const buffer=await documents.docx('测试政策','第一条 原文保留。\n第二条 <文字> 不执行。');const value=await require('mammoth').extractRawText({buffer});assert.match(value.value,/第一条 原文保留/);assert.match(value.value,/<文字> 不执行/)});
test('consultation Word is restricted to its recipient',async()=>{const db={messages:[{id:'m',residentId:'a',policyId:'p'}],policies:[{id:'p',title:'草案',body:'完整草案'}]},handler=documents({db,resident:()=>({id:'b'}),catalog:[]});await assert.rejects(handler({}, {},new URL('http://localhost/api/resident-document?message=m')),e=>e.status===404)});
