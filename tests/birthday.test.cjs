'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {age,today,create}=require('../server/birthday.cjs');
test('birthday validation and age follow the China calendar',()=>{
 assert.equal(today(Date.parse('2026-10-26T16:00:00Z')),'2026-10-27');
 assert.equal(age('2000-10-27','2026-10-26'),25);assert.equal(age('2000-10-27','2026-10-27'),26);
 for(const value of ['2026-02-30','2027-01-01','2000-2-01','garbage'])assert.equal(age(value,'2026-10-27'),null);
 assert.equal(age('2000-02-29','2026-10-27'),26);
});
test('only birthdays generate, concurrent requests and reloads reuse a persisted greeting without sending private data',async()=>{
 let calls=0,saves=0;const provider={key:'test-only',model:'test-model',async response(input){calls++;assert.ok(!JSON.stringify(input).includes('1990-10-27'));return{output:[{type:'message',content:[{type:'output_text',text:'愿你今天被温暖围绕，生日快乐！'}]}]}}};
 const deps={provider,changed:()=>saves++,clock:()=>Date.parse('2026-10-27T01:00:00Z')},service=create(deps),r={id:'a',birthDate:'1990-10-27'};
 const [a,b]=await Promise.all([service.greeting(r),service.greeting(r)]);assert.equal(a.mode,'live-llm');assert.deepEqual(a,b);assert.equal(calls,1);assert.equal(saves,1);
 assert.deepEqual(await create(deps).greeting(JSON.parse(JSON.stringify(r))),a);assert.equal(calls,1);
 assert.equal((await service.greeting({id:'b',birthDate:'1990-10-28'})).status,'not_today');assert.equal(calls,1);
 assert.equal((await create({...deps,provider:{key:''}}).greeting({id:'c',birthDate:r.birthDate})).status,'not_configured');
});
