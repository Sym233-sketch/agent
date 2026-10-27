'use strict';
const SUBJECT=/(我本人|我自己|本人|我(?:的)?儿子|我(?:的)?女儿|我(?:的)?孩子|我家(?:孩子|小孩)?|我们家(?:孩子|小孩)|父亲|母亲|父母|爸爸|妈妈|爸妈|儿子|女儿|孩子|小孩|我)/g;
const roleOf=word=>/儿子|女儿|孩子|小孩|我家/.test(word)?'child':/父|母|爸|妈/.test(word)?'parent':'self';
function clauses(message){let offset=0;return String(message||'').split(/([，,。；;！？!?\n]|但是|不过)/).flatMap(text=>{const start=offset;offset+=text.length;return text.trim()&&!/^[，,。；;！？!?\n]$|^(?:但是|不过)$/.test(text)?[{text,start}]:[]})}
function subjectAt(text,position=text.length){const matches=[...String(text).matchAll(SUBJECT)].filter(m=>m.index<=position);const last=matches.at(-1);return last?{role:roleOf(last[0]),label:last[0],start:last.index}:null}
function relevantClause(evidence,value){const candidates=clauses(evidence).filter(c=>c.text.includes(value));return candidates.at(-1)?.text||evidence}
function detectAll(message){
 const text=String(message||''),events=[];let previous=null;
 for(const c of clauses(text)){
  const s=c.text;if(/假如|假设|如果|要是|举个例子|代码|测试用例|小说|提示词/.test(s))continue;
  const subject=subjectAt(s)||previous;if(subject)previous=subject;
  if(/朋友|邻居|同事|别人|没有.*(?:孩子|儿子|女儿)/.test(s))continue;
  let event=null,phase;
  if(/小学|一年级|幼升小/.test(s)&&!/小学老师|小学教师/.test(s)&&!/不(?:再)?上小学|不是.*小学|未到.*(?:上小学|入学)|(?:小学毕业|上初中|读初中)/.test(s)){
   event='primary-school';const upcoming=/(?:准备|打算|明年|下学期|即将|将要|还没|尚未|要上|快上).{0,10}(?:小学|入学)|幼升小|入学报名/.test(s),already=/已经.*(?:上小学|入学)|在上小学|上小学了/.test(s)&&!/(?:准备|明年|下学期|即将|将要|快要|快|要)上小学了/.test(s);phase=upcoming&&!already?'planned':'enrolled';
  }else if(/失业了|刚失业|最近待业|想找工作|找不到工作|工作没了|被裁员|求职.*(?:政策|推荐)|就业.*(?:政策|推荐)/.test(s)&&!/没(?:有)?失业|不是失业|并未失业|已找到工作|不想找工作|不再找工作|不需要就业/.test(s))event='employment';
  else if(/退休了|刚退休|(?:父母|母亲|父亲|爸妈|老人).*(?:独居|没人照顾|需要照护)|(?:养老|老人).*(?:什么政策|办理|推荐)/.test(s)&&!/没有退休|并未退休|不再独居|没有独居|不是独居|不需要照护/.test(s))event='eldercare';
  else if(/(?:我|本人|儿子|女儿|孩子).*(?:抑郁|情绪低落|心理困扰)|(?:心理支持|心理咨询).*(?:推荐|政策|办理)/.test(s)&&!/没有抑郁|并未抑郁|不是抑郁|不需要心理/.test(s))event='mental-support';
  if(event)events.push({event,phase,subject:subject&&subject.role!=='self'?'family':subject?'self':'unspecified',subjectRole:subject?.role||'unspecified',yearOffset:/明年/.test(s)?1:0,requestedYear:Number(s.match(/(20\d{2})年.{0,6}(?:小学|入学)/)?.[1])||null,evidence:s.trim().slice(0,600),evidenceStart:c.start,priority:/政策|推荐|怎么办|办理/.test(s)?2:1});
 }
 return events;
}
function detect(message){const events=detectAll(message);if(!events.length)return null;const primary=[...events].sort((a,b)=>b.priority-a.priority||a.evidenceStart-b.evidenceStart)[0];const {priority,...result}=primary;return{...result,relatedEvents:events.filter(e=>e!==primary).map(({event,subject,subjectRole,phase})=>({event,subject,subjectRole,phase}))}}
module.exports={clauses,subjectAt,relevantClause,detect,detectAll};
