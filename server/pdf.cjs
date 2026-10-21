'use strict';
const path=require('node:path');
async function extract(buffer){
 if(!Buffer.from(buffer).subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('文件不是有效的 PDF');
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs'),root=path.dirname(require.resolve('pdfjs-dist/package.json'));
 const task=pdfjs.getDocument({data:new Uint8Array(buffer),isEvalSupported:false,useSystemFonts:true,disableFontFace:true,useWasm:false,cMapUrl:root.replace(/\\/g,'/')+'/cmaps/',cMapPacked:true,standardFontDataUrl:root.replace(/\\/g,'/')+'/standard_fonts/',verbosity:0});
 let doc;try{doc=await task.promise;if(doc.numPages>100)throw Error('PDF 超过100页，请拆分文件');const pages=[];let text='';
 for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n),content=await page.getTextContent();let line='',y=null;const lines=[];for(const item of content.items){if(typeof item.str!=='string')continue;const nextY=item.transform?.[5];if(y!==null&&Math.abs(nextY-y)>3&&line){lines.push(line.trimEnd());line=''}if(line&&!/\s$/.test(line)&&!/^[\s，。；：、！？）]/.test(item.str))line+=' ';line+=item.str;y=nextY;if(item.hasEOL){lines.push(line.trimEnd());line='';y=null}}if(line)lines.push(line.trimEnd());const value=lines.join('\n').replace(/\u0000/g,'').trim();if(n>1)text+='\n\n';const start=text.length;text+=value;pages.push({number:n,text:value,start,end:text.length});page.cleanup();if(text.length>150000)throw Error('PDF 正文超过15万字符，请拆分文件')}
 if(!pages.some(p=>p.text))throw Error('PDF 没有可提取的文字，可能是扫描件；请先做 OCR 后重新上传');
 return{text,pages,pageCount:doc.numPages,warnings:['PDF 已转换为可审查正文，保留原页码；表格按文字读取，不进行 Excel 公式核对。','PDF 修订稿导出为 Word；原 PDF 及其签章保持原样。',...(pages.some(p=>!p.text)?['第 '+pages.filter(p=>!p.text).map(p=>p.number).join('、')+' 页未提取到文字，尚未完成这些页面的审稿，需要 OCR。']:[])]};
 }catch(e){if(/Password|password|encrypt/i.test(e.name+' '+e.message))throw Error('PDF 已加密，请解密后上传');throw e}finally{await task.destroy()}
}
module.exports={extract};
