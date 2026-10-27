'use strict';
const retrieval=require('../policy-retrieval.cjs'),profileAge=require('../profile-age.cjs');
const isSchool=c=>/^school-/.test(c.serviceContext?.matterId||'')||c.recommendations?.event==='primary-school'||/小学|课后服务|学籍/.test(c.facts?.service?.value||c.serviceContext?.title||'');
function numeric(value){if(value==null||value==='')return null;if(value==='未满1周岁')return 0;return /^\d{1,3}$/.test(String(value))?Number(value):NaN}
const AGE_TOKEN='(\\d{1,3}|[零〇一二两三四五六七八九十百]{1,6})';
function ageNumber(value){if(/^\d{1,3}$/.test(value))return Number(value);if(!/^(?:[零〇一二两三四五六七八九]|[一二两三四五六七八九]?十[一二两三四五六七八九]?|一百(?:[零〇][一二两三四五六七八九]|[一二两三四五六七八九]十[一二两三四五六七八九]?)?)$/.test(value))return NaN;const digits={'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};if(value==='零'||value==='〇')return 0;const clean=value.replace(/[零〇]/g,'');if(/[一二两三四五六七八九]{2}/.test(clean))return NaN;let total=0,digit=0;for(const ch of clean){if(ch==='十'||ch==='百'){total+=(digit||1)*(ch==='十'?10:100);digit=0}else if(Object.hasOwn(digits,ch))digit=digits[ch];else return NaN}return total+digit}
function ageFromEvidence(key,evidence){const subject=key==='applicantAge'?'(?:我本人|我自己|本人|我)':'(?:我(?:的)?(?:儿子|女儿|孩子)|孩子|儿子|女儿|服务对象|学生)',m=String(evidence).match(new RegExp(subject+'(?:今年|现在|已经|刚满|年满)?\\s*'+AGE_TOKEN+'\\s*岁'));return m?ageNumber(m[1]):NaN}
function extract(message){
 const updates=[];for(const clause of String(message).split(/[，,。；;\n]/)){if(/如果|假设|举例|是不是|是否|[?？]|不满|不到|不是/.test(clause))continue;
 for(const [key,subject]of [['beneficiaryAge','(?:我(?:的)?(?:儿子|女儿|孩子)|孩子|儿子|女儿|服务对象|学生)'],['applicantAge','(?:我本人|我自己|本人|我)']])for(const m of clause.matchAll(new RegExp(subject+'(?:今年|现在|已经|刚满|年满)?\\s*'+AGE_TOKEN+'\\s*岁','g'))){const age=ageNumber(m[1]);if(Number.isInteger(age)&&age<=130)updates.push({key,value:String(age),evidence:m[0]})}
 const grade=clause.match(/(?:孩子|儿子|女儿|学生|服务对象).{0,8}?([一二三四五六1-6])年级/);if(grade)updates.push({key:'beneficiaryGrade',value:grade[1]+'年级',evidence:grade[0]});
 if(/给我(?:的)?(?:孩子|儿子|女儿)|我(?:的)?(?:儿子|女儿|孩子)/.test(clause))updates.push({key:'applicantRole',value:'家长代办',evidence:clause.trim(),derived:true});
 if(/我本人办理|我自己办理|我是学生本人/.test(clause))updates.push({key:'applicantRole',value:'本人办理',evidence:clause.trim(),derived:true});
 }return updates;
}
function review({fields,c,profile,documents=[],day}){
 const get=id=>fields.find(f=>f.id===id),school=isSchool(c),role=get('applicantRole')?.value||'',selfRole=/^(?:本人|学生本人|本人办理|学生本人办理)$/.test(role),family=!selfRole&&(c.serviceContext?.subject==='family'||c.recommendations?.subject==='family'||/家长|代办|亲属|父亲|母亲|监护人/.test(role)),issues=[],checks={};
 const add=(field,severity,code,message,basis='逻辑一致性检查，不是政策资格认定')=>{issues.push({field,severity,code,message,basis});checks[field]={status:severity==='error'?'conflict':'attention',message}};
 for(const f of fields)checks[f.id]={status:f.value==null?'empty':f.source==='demo'?'demo':'grounded',message:f.value==null?'未提供，保持空白':f.source==='demo'?'虚构演示值，与本人事实分开标注':'已有资料来源；不代表外部核验通过'};
 for(const id of ['age','beneficiaryAge']){const age=numeric(get(id)?.value);if(age!==null&&(!Number.isInteger(age)||age<0||age>130))add(id,'error','invalid-age','年龄必须为0—130之间的整数周岁，未知应留空。')}
 const stated=numeric(get('age')?.value),registered=profileAge.value(profile,day);if(profile.birthDate&&stated!==null&&registered!==null&&stated!==registered)add('age','error','birthday-mismatch','申报人年龄与已登记生日计算的周岁不一致，请更正年龄或生日。');
 if(school){
  const age=numeric(get('beneficiaryAge')?.value),own=!family&&(selfRole||c.serviceContext?.subject==='self'),target=age??(own?stated:null),field=age===null?'age':'beneficiaryAge';
  if(own&&age!==null&&stated!==null&&age!==stated)add('beneficiaryAge','error','self-age-mismatch','选择本人办理时，服务对象年龄应与申报人年龄一致；不要混用两个人的资料。');
  if(family){checks.age=issues.some(i=>i.field==='age')?checks.age:{status:stated===null?'empty':'grounded',message:'这是家长/代办人年龄，不用于判断学生是否适合本事项。'}}
  if(target!==null&&Number.isFinite(target)&&(target>=18||target<3))add(field,'error','school-age-conflict','小学服务对象的年龄与事项明显不一致。请核对是否把家长年龄填成学生年龄，或选错了服务事项。');
  else if(target!==null&&target<6)add(field,'warning','school-age-check','服务对象年龄低于通常入学起点，需要核实特殊安排；不会自动改成6岁。','全国法律入学起点参考；具体条件与例外仍需核实');
  else if(target===null)add('beneficiaryAge','warning','student-age-unknown','学生年龄未提供，无法完成年龄与事项核对；不会复制申报人年龄。');
  const g=String(get('beneficiaryGrade')?.value||'').match(/[一二三四五六1-6]/),grade=g?(/[1-6]/.test(g[0])?Number(g[0]):'一二三四五六'.indexOf(g[0])+1):null;
  if(grade&&target!==null&&Number.isFinite(target)&&Math.abs(target-(grade+5))>4)add('beneficiaryGrade','warning','grade-age-check','年级与年龄相差较大，请核对。延迟入学、留级等情况需要人工解释，不能据此直接拒绝。');
  if(!family&&!own)add('applicantRole','warning','role-unknown','尚未明确是学生本人还是家长代办，请区分两个人的年龄。');
 }
 const query=school?'小学 入学 六周岁 课后服务 自愿 家长':String(get('service')?.value||'');
 const sources=retrieval.indexFor(documents).search(query,{limit:3}).map(hit=>({title:hit.document.title,url:hit.document.url,sha256:hit.document.sha256,scope:'全国背景参考，不代表虚构地区资格条件',quotes:hit.passages.map(p=>p.text.slice(0,450)).filter(q=>hit.document.text.includes(q))})).filter(s=>s.quotes.length);
 return{status:issues.some(i=>i.severity==='error')?'blocked':issues.length?'needs_review':'consistent',blocking:issues.filter(i=>i.severity==='error'),warnings:issues.filter(i=>i.severity!=='error'),checks,sources,retrieval:{mode:'local-policy-bm25',query,documentsSearched:documents.length},notice:'自动核对资料来源、服务对象与年龄/年级的一致性。逻辑异常不等于法律资格不符，未核实内容不自动补造。'};
}
module.exports={review,extract,isSchool,numeric,ageFromEvidence};
