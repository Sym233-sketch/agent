'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),reviewer=require('../server/agent/application-review.cjs'),create=require('../server/agent/virtual-applications.cjs'),demo=require('../server/demo-context.cjs');
const documents=require('../server/policy-discovery.cjs').loadCatalog(),field=(id,value,source='self-report')=>({id,value,source,evidence:'本人明确提供'});
test('student and parent are distinct people; official sources are retrieved without inventing an age limit',()=>{
 const c={facts:{},serviceContext:{matterId:'school-aftercare',subject:'family'}},r=reviewer.review({fields:[field('age','40'),field('applicantRole','家长代办'),field('beneficiaryAge','8'),field('beneficiaryGrade','二年级')],c,profile:{age:40},documents,day:'2026-10-27'});
 assert.equal(r.blocking.length,0);assert.match(r.checks.age.message,/不用于判断学生/);assert.ok(r.sources.some(s=>s.url.includes('gov.cn')));assert.equal(r.retrieval.mode,'local-policy-bm25');for(const s of r.sources){const doc=documents.find(d=>d.url===s.url);assert.ok(s.quotes.every(q=>doc.text.includes(q)))}
});
test('adult primary-school beneficiary is a blocking consistency conflict; unusual and unknown ages are review warnings',()=>{
 const c={facts:{},serviceContext:{matterId:'school-enrollment',subject:'family'}},run=age=>reviewer.review({fields:[field('age','40'),field('beneficiaryAge',age)],c,profile:{age:40},documents,day:'2026-10-27'});
 assert.equal(run('40').status,'blocked');assert.equal(run('5').blocking.length,0);assert.ok(run('5').warnings.some(x=>x.code==='school-age-check'));assert.ok(run(null).warnings.some(x=>x.code==='student-age-unknown'));assert.ok(!run('40').blocking[0].basis.includes('法定'));
 const self=reviewer.review({fields:[field('age','40'),field('applicantRole','本人办理')],c:{facts:{},serviceContext:{matterId:'school-enrollment',subject:'self'}},profile:{age:40},documents});assert.equal(self.status,'blocked');
});
test('chat extraction scopes ages to the correct person and ignores hypothetical or negative statements',()=>{
 const out=reviewer.extract('我今年四十岁，我儿子八岁，孩子上二年级。');assert.equal(out.find(x=>x.key==='applicantAge').value,'40');assert.equal(out.find(x=>x.key==='beneficiaryAge').value,'8');assert.equal(out.find(x=>x.key==='beneficiaryGrade').value,'二年级');assert.equal(reviewer.extract('假设我今年40岁，孩子是不是38岁？').filter(x=>/Age$/.test(x.key)).length,0);
});
test('table edits are persisted, rechecked and protected by revision and ownership; conflicts cannot be submitted',()=>{
 const profile={id:'r',age:40},c={id:'c',residentId:'r',facts:{},serviceContext:{title:'课后服务',matterId:'school-aftercare',subject:'family'}},data={applications:[]};demo.apply(c);const apps=create({data,changed(){},redact:s=>s.replace(/\d{11,}/g,'[号码]'),getResident:()=>profile,getDocuments:()=>documents}),initial=apps.prepare(profile,c);assert.equal(initial.status,'ready');assert.equal(initial.fields.find(f=>f.id==='age').value,'40');
 const conflict=apps.edit(profile,initial.id,{revision:initial.revision,confirm:true,fieldId:'beneficiaryAge',value:'40'},c);assert.equal(conflict.status,'needs_review');assert.equal(conflict.review.blocking[0].code,'school-age-conflict');
 assert.throws(()=>apps.submit(profile,conflict.id,{revision:conflict.revision,userConfirmed:true},c),/填写冲突/);assert.throws(()=>apps.edit(profile,conflict.id,{revision:initial.revision,confirm:true,fieldId:'beneficiaryAge',value:'8'},c),/已更新/);assert.throws(()=>apps.edit({id:'other'},conflict.id,{revision:conflict.revision,confirm:true,fieldId:'beneficiaryAge',value:'8'},c),/不存在/);
 const fixed=apps.edit(profile,conflict.id,{revision:conflict.revision,confirm:true,fieldId:'beneficiaryAge',value:'8'},c);assert.equal(fixed.review.blocking.length,0);assert.equal(fixed.fields.find(f=>f.id==='beneficiaryAge').source,'user-edit');assert.equal(apps.submit(profile,fixed.id,{revision:fixed.revision,userConfirmed:true},c).application.status,'submitted');assert.throws(()=>apps.edit(profile,fixed.id,{revision:fixed.revision,confirm:true,fieldId:'beneficiaryAge',value:'9'},c),/不能修改/);
});
test('school reminder entries also receive consistency checks',()=>{assert.equal(reviewer.isSchool({facts:{},serviceContext:{title:'义务教育报名'}}),true)});
test('an edited applicant age cannot override a contradictory registered birthday',()=>{
 const c={facts:{},serviceContext:{},formOverrides:{age:field('age','9','user-edit')}},r=reviewer.review({fields:[field('age','9','user-edit')],c,profile:{birthDate:'1986-01-01'},documents,day:'2026-10-27'});assert.ok(r.blocking.some(x=>x.code==='birthday-mismatch'));
});
