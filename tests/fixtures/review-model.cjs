'use strict';
process.env.DEEPSEEK_API_KEY='browser-test-only-never-live';process.env.MINCETONG_FICTIONAL_DEMO='false';
global.fetch=async(url,options)=>{
 if(!String(url).startsWith('https://api.deepseek.com/'))throw Error('Review regression blocks external requests');
 const body=JSON.parse(options.body),input=JSON.parse(body.input[0].content);if(!input.file)throw Error('Unexpected paid-model path in browser fixture');
 if(body.input.some(x=>x.type==='function_call_output'))return{ok:true,json:async()=>({output:[{type:'message',content:[{type:'output_text',text:'已按原文件位置核查本段；补助金额的改变需要另行核实。'}]}]})};
 const edits=[];if(input.text.includes('事项清淅'))edits.push({quote:'事项清淅',replacement:'事项清晰',reason:'同一句重复时，仅更正最后一处错字',offset:input.text.lastIndexOf('事项清淅')});if(input.text.includes('每人100元'))edits.push({quote:'每人100元',replacement:'每人1000元',reason:'金额改动需要核实依据',offset:input.text.indexOf('每人100元')});
 return{ok:true,json:async()=>({output:[{type:'function_call',name:'record_edit_suggestions',arguments:JSON.stringify({edits}),call_id:'review-fixture',id:'review-fixture'}]})};
};
require('../../server/index.cjs');
