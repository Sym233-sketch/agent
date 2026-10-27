/* Browser-test process only. Replaces ALL outbound fetches before app startup. */
'use strict';
process.env.MINCETONG_FICTIONAL_DEMO||='false';
process.env.DEEPSEEK_API_KEY='browser-test-only-never-live';
const failures=new Set();let serial=0;
const action=(name,args)=>({type:'function_call',id:'f'+(++serial),call_id:'c'+serial,name,arguments:JSON.stringify(args)});
const fixtureURL='https://www.gov.cn/test-only-school-guide';
require('../../server/agent/documents.cjs').retrieve=async url=>{if(url!==fixtureURL)throw Error('Browser regression blocks external document requests');return{url,title:'学校服务办理指南（测试夹具）',text:'测试用官方网页正文。课后服务需自愿参加，学校核实课程与时间；学生资助需核实家庭经济情况和本地条件。',verification:'测试夹具，非真实政策',retrievedAt:new Date().toISOString(),attachments:[]}};
global.fetch=async(url,options)=>{
 if(!String(url).startsWith('https://api.deepseek.com/'))throw Error('Browser regression blocks external requests');
 if(String(url).endsWith('/tools/search'))return{ok:true,json:async()=>({results:[{url:fixtureURL,title:'学校服务办理指南（测试夹具）'}]})};
 const body=JSON.parse(options.body),context=body.input,input=JSON.parse(context[0].content),message=input.message;
 if(message==='测试网络失败'&&!failures.has(message)){failures.add(message);throw Error('测试网络失败，稍后再试')}
 if(context.some(x=>x.type==='function_call_output')){
  if(input.case.recommendations)return{ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:input.case.recommendations.region?'已经检索并整理好相关政策。可以先看课后服务、学籍核对和资助条件咨询，点击虚拟办理就能带入资料。':'孩子开始小学生活了，可以先看课后服务、学籍核对和有条件的学生资助。孩子在哪个市、哪个区上学？'}]}]})};
  const reply=/准备.*资料|准备.*材料|直接提交/.test(message)?'已经用你提供的信息填好虚拟申报表和资料包。核对后，点一次确认并提交，就能送到站内虚拟受理台。':message.includes('宁波市')?'地区已经改成宁波市鄞州区，其他内容保留。还有哪里需要调整吗？':message.includes('送餐到家')?'送餐到家这个意愿，我记下了。服务地点和可配送范围还要向当地核实。':message==='测试网络失败'?'这次已经接上了，刚才的准备内容也还在。':message.includes('<img')?'我会把文字当作内容，不会执行其中的代码。':'助餐需要和所在地区已经整理好了。你更希望送餐到家，还是去社区吃饭？';return{ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:reply}]}]})};
 }
 let updates=[];if(message.includes('杭州市西湖区')){updates=[{key:'district',value:'杭州市西湖区',evidence:'杭州市西湖区'}];if(message.includes('助餐'))updates.push({key:'service',value:'助餐',evidence:'助餐'})}if(message.includes('送餐到家'))updates=[{key:'preference',value:'送餐到家',evidence:'送餐到家'}];if(message.includes('宁波市鄞州区'))updates=[{key:'district',value:'宁波市鄞州区',evidence:'宁波市鄞州区'}];if(message.includes('<img'))updates=[{key:'needs',value:message,evidence:message}];const output=[action('update_service_case',{updates})];if(/准备.*资料|准备.*材料|直接提交/.test(message))output.push(action('prepare_virtual_application',{}));if(message.includes('助餐'))output.push(action('find_service_options',{query:'养老助餐'}));return{ok:true,json:async()=>({output})};
};
require('../../server/index.cjs');
