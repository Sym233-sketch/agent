'use strict';
const crypto=require('crypto');
const heading=s=>s.replace(/^[一二三四五六七八九十\d]+[、.．]\s*/,'').replace(/（(?:征求意见稿|草案|附件)）|\((?:draft|attachment)\)/gi,'').trim();
function claims(documents){const all=[];for(const d of documents){const lines=String(d.text||'').split('\n'),title=heading(lines.find(s=>s.trim())||d.name||d.id||'正文');let offset=0,scope=title;for(const line of lines){const trimmed=line.trim(),explicit=trimmed.match(/^(?:事项|项目|服务)名称[：:]\s*(.{2,60})/);if(explicit)scope=explicit[1].trim();
 const section=trimmed.match(/^[一二三四五六七八九十\d]+[、.．]\s*(.{2,30})$/);if(section&&!/服务对象|申请对象|适用范围|申报条件|办理材料|申报材料|申请要求|总则|经费安排|收费标准|费用标准|办理流程|附则|资金管理|工作要求/.test(section[1]))scope=title+' / '+section[1];
 for(const m of line.matchAll(/(?:服务对象|申请对象|申请人|适用对象|补贴对象)[^。；;\n]{0,18}?(?:年满|年龄(?:为|在)?|满)\s*(\d{1,3})\s*(?:周)?岁(?:及?以上|以下)?/g)){const qualifiers=(m[0].match(/独居|失能|残疾|低保|困难/g)||[]).sort().join('、');all.push({type:/以下/.test(m[0])?'maximum-age':'minimum-age',scope,qualifiers,value:Number(m[1]),quote:m[0],fileId:d.id,fileName:d.name,offset:offset+m.index})}
 const materials=line.match(/(?:申请材料|所需材料|须提交材料|材料清单)[：:]\s*([^。\n]{2,160})/);if(materials)all.push({type:'materials',scope,qualifiers:'',value:materials[1].split(/[、，,；;]/).map(s=>s.trim()).filter(Boolean).sort().join('、'),quote:materials[0],fileId:d.id,fileName:d.name,offset:offset+materials.index});
 const fees=line.match(/(?:收费标准|费用标准|收费方式)[：:]\s*([^。\n]{2,80})/);if(fees)all.push({type:'fee-description',scope,qualifiers:'',value:fees[1].trim(),quote:fees[0],fileId:d.id,fileName:d.name,offset:offset+fees.index});offset+=line.length+1;
 }}return all;}
function analyze(documents){const all=claims(documents),groups=new Map(),issues=[],comparisons=[];for(const c of all){const key=JSON.stringify([c.scope,c.type,c.qualifiers]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c)}
 for(const group of groups.values()){for(let i=1;i<group.length;i++){const a=group[0],b=group[i];if(a.value===b.value||a.fileId===b.fileId&&a.offset===b.offset)continue;const label=/-age$/.test(a.type)?'年龄门槛':a.type==='materials'?'材料清单':'收费表述';comparisons.push({scope:a.scope,attribute:a.type,equal:false});issues.push({id:crypto.randomUUID(),kind:'cross_policy',severity:'warning',reason:'同一事项的'+label+'表述不同，请核对是否存在例外、补充或版本差异。',quote:a.quote,source:{fileId:a.fileId,fileName:a.fileName,offset:a.offset},evidence:[a,b],requiresVerification:'仅提示可能的不一致，不作资格或合法性结论',fix:null})}}
 return{issues,claims:all,comparisons,scope:'按明确同名事项和相同条件分组比对跨章节、跨文件原句；不同事项或特殊人群不直接视作矛盾。'};
}
module.exports={analyze,claims};
