'use strict';
// Local lexical retrieval: Chinese terms + BM25 + reciprocal rank fusion.
// No embedding API, generated policies, or inferred resident eligibility.
const segmenter=new Intl.Segmenter('zh-CN',{granularity:'word'});
const matching=require('../public/policy-matching.js'),guidance=require('./policy-guidance.cjs');
const STOP=new Set('的 了 吗 呢 吧 啊 我 你 他 她 您 我们 什么 怎么 如何 有 什么 哪些 可以 需要 想 要 请 帮忙 一下 一个 这 那 和 与 及 或 是 在 为 对 将 关于 政策 规定 通知 文件 办理 推荐 了解'.split(' '));
const INTENTS=[
 {pattern:/课后|放学|接孩子|接小孩|没人接|托管/,terms:['课后服务','学校','自愿']},
 {pattern:/上小学|幼升小|入学|学区|报名/,terms:['小学','入学','招生']},
 {pattern:/学籍|转学|学生信息/,terms:['学籍','学校']},
 {pattern:/助学|学生资助|上学.*(?:费用|钱|困难)|学费.*(?:困难|交不起)|孩子.*(?:补助|补贴)/,terms:['学生','资助','补助','家庭经济困难']},
 {pattern:/助餐|老人.*吃饭|送饭|做不了饭/,terms:['养老','助餐','居家']},
 {pattern:/照顾老人|照护|探访|独居.*(?:父母|老人)|爸妈.*(?:照顾|养老)/,terms:['基本养老服务','照护','探访']},
 {pattern:/抑郁|焦虑|心理|心情不好|情绪低落|失眠|睡不着|找人说说/,terms:['心理','心理健康服务','精神卫生','睡眠门诊']},
 {pattern:/失业|找工作|求职|工作没了|被裁|再就业/,terms:['就业','公共就业服务','职业培训']},
 {pattern:/看病.*(?:钱|费用)|报销|医保|医疗救助/,terms:['医保','医疗','救助']},
 {pattern:/法律援助|打官司.*(?:钱|律师)|请不起律师/,terms:['法律援助','法律']}
];
const normalized=s=>String(s||'').normalize('NFKC').toLowerCase();
function tokens(value){const out=[];for(const seg of segmenter.segment(normalized(value))){if(!seg.isWordLike||STOP.has(seg.segment))continue;const w=seg.segment;if(/^[\p{Script=Han}]+$/u.test(w)){if(w.length>=2)out.push(w);if(w.length>2)for(let i=0;i<w.length-1;i++)out.push(w.slice(i,i+2))}else if(w.length>=2)out.push(w)}return out}
function expansion(query){const clauses=String(query).split(/[，,。；;！？!?\n]|但是|不过|但/),terms=[];for(const rule of INTENTS)if(clauses.some(c=>!/(不想|不需要|无需|不是|没有|并未|已找到)/.test(c)&&rule.pattern.test(c)))terms.push(...rule.terms);return[...new Set(terms)]}
function passages(text,query,{limit=2,budget=1300}={}){
 text=String(text||'');const terms=[...new Set([...tokens(query),...expansion(query).flatMap(tokens)])];if(!text||!terms.length)return[];
 const ranges=[];let start=0;for(const line of text.split('\n')){if(line.trim()){for(let off=0;off<line.length;off+=700){const end=Math.min(line.length,off+850),value=line.slice(off,end),lower=normalized(value),hits=terms.filter(t=>lower.includes(t));if(hits.length)ranges.push({start:start+off,end:start+end,text:value,score:hits.length+hits.reduce((n,t)=>n+(t.length>2?1:0),0)})}}start+=line.length+1}
 ranges.sort((a,b)=>b.score-a.score||a.start-b.start);const picked=[];let used=0;for(const p of ranges){if(picked.length>=limit||used>=budget)break;if(picked.some(x=>p.start<x.end&&p.end>x.start))continue;const size=Math.min(p.text.length,budget-used);picked.push({start:p.start,end:p.start+size,text:p.text.slice(0,size)});used+=size}return picked.sort((a,b)=>a.start-b.start);
}
class PolicyIndex{
 constructor(documents){this.documents=documents;this.postings=new Map();this.lengths=[];this.metadata=[];let total=0;for(let i=0;i<documents.length;i++){const d=documents[i],body=tokens(d.text),head=tokens([d.title,d.summary,d.issuer,d.number].filter(Boolean).join(' ')),counts=new Map();for(const t of body)counts.set(t,(counts.get(t)||0)+1);for(const t of head)counts.set(t,(counts.get(t)||0)+4);this.lengths[i]=body.length+head.length;total+=this.lengths[i];this.metadata[i]=normalized([d.title,d.summary,d.number].filter(Boolean).join(' '));for(const [term,count]of counts){let rows=this.postings.get(term);if(!rows)this.postings.set(term,rows=[]);rows.push(i,count)}}this.average=total/Math.max(1,documents.length);this.stats={documents:documents.length,terms:this.postings.size,algorithm:'chinese-bm25-rrf-v1',embeddings:false};}
 search(query,{limit=20,offset=0,category,region='',asOf='',accept=()=>true}={}){
  limit=Math.max(1,Math.min(1000,Math.trunc(limit)||20));offset=Math.max(0,Math.trunc(offset)||0);
  const original=String(query||'').trim();if(!original){const all=this.documents.filter(d=>(!category||d.category===category||d.domain===category)&&accept(d)),out=all.slice(offset,offset+limit).map(document=>({document,score:1,matchedTerms:[],passages:[]}));out.total=all.length;return out}
  const base=[...new Set(tokens(original))],expanded=[...new Set(expansion(original).flatMap(tokens))],all=[...new Set([...base,...expanded])];if(!all.length)return[];
  const scores=new Map(),hits=new Map(),n=this.documents.length;
  for(const term of all){const list=this.postings.get(term);if(!list)continue;const idf=Math.log(1+(n-list.length/2+.5)/(list.length/2+.5)),weight=base.includes(term)?1:.55;for(let p=0;p<list.length;p+=2){const i=list[p],tf=list[p+1],norm=1.2*(.25+.75*this.lengths[i]/Math.max(1,this.average)),value=idf*tf*2.2/(tf+norm)*weight;scores.set(i,(scores.get(i)||0)+value);if(!hits.has(i))hits.set(i,new Set());hits.get(i).add(term)}}
  const allowed=i=>{const d=this.documents[i];return(!category||d.category===category||d.domain===category)&&(!asOf||!d.issued||d.issued<=asOf)&&accept(d)};
  const lexical=[...scores].filter(([i])=>allowed(i)).sort((a,b)=>b[1]-a[1]||a[0]-b[0]),phrases=[...scores].filter(([i])=>allowed(i)).map(([i])=>{let score=0;for(const t of [...base,...expansion(original)])if(this.metadata[i].includes(normalized(t)))score+=t.length>2?3:1;if(this.metadata[i].includes(normalized(original)))score+=12;return[i,score]}).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]||a[0]-b[0]);
  const fusion=new Map();for(const [ranking,weight]of [[lexical,1],[phrases,1.15]])ranking.forEach(([i],rank)=>fusion.set(i,(fusion.get(i)||0)+weight/(40+rank+1)));
  const strong=expansion(original).filter(t=>t.length>=3),intent=[...scores].filter(([i])=>allowed(i)).map(([i])=>[i,strong.reduce((n,t)=>n+(this.metadata[i].includes(normalized(t))?1:0),0)]).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]||a[0]-b[0]);intent.forEach(([i],rank)=>fusion.set(i,(fusion.get(i)||0)+1.1/(40+rank+1)));
  const categories=new Set(INTENTS.filter(rule=>expansion(original).some(t=>rule.terms.includes(t))).map(rule=>rule.terms.includes('心理')?'mental':rule.terms.includes('就业')?'employment':rule.terms.includes('法律援助')?'legal':rule.terms.some(t=>/养老/.test(t))?'elder':rule.terms.some(t=>/学|课后|招生/.test(t))?'education':'general'));
  const ranked=[...fusion].map(([i,score])=>{const d=this.documents[i],matchedTerms=[...(hits.get(i)||[])],primary=base.filter(t=>matchedTerms.includes(t)).length,relevant=categories.has(matching.category(d)),boost=relevant?1.25+Math.min(4,guidance(d).priority)*.04:1;return{document:d,score:score*(1+Math.min(primary,8)*.025)*boost,matchedTerms,region:region&&String(d.scope||'').includes(region)?'mentioned-not-verified':'not-verified'}}).sort((a,b)=>b.score-a.score||String(a.document.key).localeCompare(String(b.document.key))),out=ranked.slice(offset,offset+limit).map(r=>({...r,score:Math.round(r.score*1e6)/1e6,passages:passages(r.document.text,original)}));out.total=ranked.length;return out;
 }
}
const indexes=new WeakMap();function indexFor(documents){let entry=indexes.get(documents);if(!entry||entry.size!==documents.length){entry={size:documents.length,index:new PolicyIndex(documents)};indexes.set(documents,entry)}return entry.index}
module.exports={PolicyIndex,indexFor,tokens,expansion,passages};
