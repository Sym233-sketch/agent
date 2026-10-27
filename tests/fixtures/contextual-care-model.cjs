'use strict';
process.env.MINCETONG_FICTIONAL_DEMO||='false';
process.env.DEEPSEEK_API_KEY='test-only-no-live-credit';
const url='https://www.gov.cn/test-only-care-services';
require('../../server/agent/documents.cjs').retrieve=async target=>{if(target!==url)throw Error('测试禁止外部读取');return{url,title:'社区帮办与探访服务（测试夹具）',text:'测试服务说明：请向所在社区核实服务辖区、服务费用与可预约时间。此页面只用于自动测试。',retrievedAt:new Date().toISOString()}};
global.fetch=async(target,options)=>{
 if(!String(target).startsWith('https://api.deepseek.com/'))throw Error('测试禁止外部请求');
 if(String(target).endsWith('/tools/search'))return{ok:true,json:async()=>({results:[{url,title:'社区服务（测试夹具）'}]})};
 const input=JSON.parse(JSON.parse(options.body).input[0].content);
 return{ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:input.possibleSupportNeeds?.length?'我先帮你理清材料。也可以看看旁边的帮办支持，是否需要由你决定。':'我们先把这份材料理清楚。'}]}]})};
};
require('../../server/index.cjs');
