'use strict';
module.exports=async function body(req){
  const chunks=[];let bytes=0;
  for await(const chunk of req){
    bytes+=chunk.length;
    if(bytes>1000000)throw Object.assign(new Error('请求内容过大'),{status:413});
    chunks.push(chunk);
  }
  const text=Buffer.concat(chunks).toString('utf8');let value;
  try{value=text?JSON.parse(text):{}}catch{throw Object.assign(new Error('无效JSON'),{status:400})}
  if(!value||typeof value!=='object'||Array.isArray(value))throw Object.assign(new Error('请求内容必须是JSON对象'),{status:400});
  return value;
};
