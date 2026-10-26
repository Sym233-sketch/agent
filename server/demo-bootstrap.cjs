'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{seed,rank}=require('./pioneer-data.cjs');
function bootstrap(db){let changed=seed(db);db.agent={documents:[],...db.agent};db.policies||=[];db.messages||=[];db.requests||={};for(const source of require('./national-policy-sources.json')){
 const file=path.resolve(__dirname,'../resources/national-policies',source.key+'.json');if(!fs.existsSync(file))continue;
 const d=JSON.parse(fs.readFileSync(file,'utf8'));if(!db.agent.documents.some(x=>x.catalogKey===source.key)){db.agent.documents.push({id:crypto.randomUUID(),catalogKey:source.key,...d});changed++}
 if(db.policies.some(p=>p.catalogKey===source.key))continue;
 const p={id:crypto.randomUUID(),catalogKey:source.key,kind:'publication',domain:d.domain,title:d.title,body:d.summary+'\n\n发布机关：'+d.issuer+'\n成文/修正日期：'+d.issued+'\n适用范围：'+d.scope+'\n官方来源：'+d.url+'\n抓取时间：'+d.retrievedAt+'\n核验范围：'+d.verification+'\n\n以下为官方网页提取快照（含网页附带文字，非民策通新制定政策）：\n'+d.text,createdAt:new Date().toISOString(),audience:'matched',recipientIds:[],officialSource:d.url,sourceIssued:d.issued,sourceIssuer:d.issuer,sourceVerification:d.verification,sourceHash:d.sha256,syntheticDeliveryOnly:true};
 db.policies.push(p);for(const r of db.residents.filter(r=>r.synthetic&&r.proactive&&rank(r,p.title+' '+d.summary,p.domain).score>0))db.messages.push({id:crypto.randomUUID(),residentId:r.id,policyId:p.id,createdAt:p.createdAt,readAt:null,reason:rank(r,p.title+' '+d.summary,p.domain).reason+'；仅信息相关性推荐，资格待核实',replies:[]});changed++;
 }return changed;
}
module.exports={bootstrap};
