'use strict';
const FIELDS={district:'所在市区',needs:'希望获得的帮助',service:'要办理的事项',income:'收入情况',occupation:'职业',insurance:'参保情况',household:'家庭安排'};
const ALIASES={district:'地区|市区|所在地|地址',income:'收入|费用情况',occupation:'职业|工作身份',insurance:'医保|参保|保险',household:'家庭情况|家庭安排'};
function state(c,message){
 const declined=new Set();for(const m of [...c.messages.filter(m=>m.role==='user').slice(-16),{text:message}])for(const [key,label]of Object.entries(FIELDS)){const name='(?:'+label+'|'+key+'|'+(ALIASES[key]||label)+')';if(new RegExp(name+'.{0,8}(?:不想说|不提供|删除|跳过)|(?:不想说|不提供|跳过).{0,8}'+name).test(m.text))declined.add(key)}
 for(const [key,f]of Object.entries(c.facts))if(f.value&&f.source==='self-report'&&f.evidence&&message.includes(f.evidence)&&!/不想说|不提供|跳过|删除/.test(f.evidence))declined.delete(key);
 const explainOnly=/只(?:想|是)?(?:了解|问问|咨询)|暂时不办|先不办|不用申请/.test(message),pause=/先停|暂停|不聊了|暂时不用|到这里/.test(message),correct=/改成|填错|更正|删除|不对/.test(message),prepare=/准备.*(?:资料|材料)|帮我.*(?:办理|提交)|直接提交/.test(message);
 const missing=(c.application?.missing||[]).map(f=>f.id),needsLocal=!!(c.recommendations||c.serviceContext),next=missing.find(key=>!declined.has(key))||(!explainOnly&&!pause&&needsLocal&&!c.facts.district&&!declined.has('district')?'district':null);
 return{mode:pause?'pause':explainOnly?'explain':correct?'correct':prepare?'prepare':'help',tone:/难受|焦虑|抑郁|担心|撑不住|失眠|没钱|交不起/.test(message)?'gentle-and-practical':'direct-and-friendly',knownFields:Object.keys(c.facts),declinedFields:[...declined],nextQuestion:next?{field:next,label:FIELDS[next]||next}:null,questionLimit:pause||explainOnly?0:1,avoidRepeating:c.messages.filter(m=>m.role==='assistant').slice(-2).map(m=>(m.text.match(/[^。！!?\n]*[?？]/g)||[m.text.slice(0,180)]).slice(-2).join(' ').slice(0,280)),instruction:'先回应眼前需要，再说一个已实际完成或可以立即进行的动作；下一问仅用于当前必要缺口，未知的非必填项留空。'};
}
module.exports={state};
