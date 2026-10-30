(function(root){
  'use strict';
  async function request(url,options){
    let response;
    try { response=await fetch(url,options); }
    catch(error){
      if(error.name==='AbortError')throw error;
      throw new Error('连接暂时中断，请检查网络后重试；如刚提交过，请先查看进度，避免重复操作。');
    }
    let data;
    try { data=await response.json(); }
    catch {
      throw Object.assign(new Error(response.ok?'服务返回内容不完整，请稍后重试。':'服务暂时不可用，请稍后重试；如刚提交过，请先查看进度。'),{status:response.status});
    }
    if(!response.ok)throw Object.assign(new Error(typeof data?.error==='string'?data.error:'操作未完成，请稍后重试。'),{status:response.status});
    if(!data||typeof data!=='object'||Array.isArray(data))throw Object.assign(new Error('服务返回格式异常，请稍后重试。'),{status:response.status});
    return data;
  }
  if(typeof module==='object'&&module.exports)module.exports={request};
  else root.MincetongApi={request};
})(globalThis);
