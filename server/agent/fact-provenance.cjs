'use strict';
// A matching substring is necessary but not enough to establish an applicant fact.
const entities=require('./life-events.cjs');
const PERSONAL=new Set(['occupation','income','insurance','employment']);
function validate({key,value,evidence}){
 if(!value)return;evidence=entities.relevantClause(evidence,value);
 if(/^(?:未知|不清楚|不知道|待核实|未提供|暂未提供|暂无资料|未确认)$/.test(value))throw Error('未知事实应保留为空，不能当作已核实的填写值');
 if(/假如|假设|举例|例如.*(?:收入|职业|医保)|要是|如果我(?:是|有|收入|住)/.test(evidence)&&key!=='needs'&&key!=='service')throw Error('假设或举例只能作为咨询内容，不能填为本人事实');
 if(['applicantAge','beneficiaryAge'].includes(key)){if(!/^\d{1,3}$/.test(value)||Number(value)>130||require('./application-review.cjs').ageFromEvidence(key,evidence)!==Number(value))throw Error('年龄需要明确对应本人或服务对象的原话依据');}
 if(PERSONAL.has(key)){
  if((entities.subjectAt(evidence,evidence.lastIndexOf(value))?.role!=='self'&&/(?:儿子|女儿|孩子|父亲|母亲|父母|爸爸|妈妈|妻子|丈夫|朋友|同事|邻居)/.test(evidence))||/以为|猜测|好像|听说/.test(evidence))throw Error('家属或他人的情况不能填为申报人本人的事实');
  if(/[?？]|(?:吗|呢)$|是不是|能不能|是否符合|可不可以|要不要|怎么填|如何填/.test(evidence))throw Error('提问不等于本人事实；先核实再填写');
 }
 const correction=evidence.match(/改成|更正为|实际是|应改为/);if(correction&&evidence.indexOf(value)<correction.index&&evidence.indexOf(value,correction.index)<0)throw Error('本人已经更正，不能继续使用更正前的值');
}
module.exports={validate};
