'use strict';
// Prefer article bodies over navigation without assuming that every div is policy text.
function articleHTML(raw){
 const safe=String(raw).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<!--[\s\S]*?-->/g,' ');
 const candidates=[];for(const m of safe.matchAll(/<(article|main)\b[^>]*>/gi))candidates.push({start:m.index+m[0].length,tag:m[1].toLowerCase()});
 for(const m of safe.matchAll(/<div\b[^>]*(?:id|class)\s*=\s*["'][^"']*(?:TRS_Editor|UCAP-CONTENT|article-content|policy-content|content_detail|zoom)[^"']*["'][^>]*>/gi))candidates.unshift({start:m.index+m[0].length,tag:'div'});
 for(const c of candidates){const re=new RegExp('<\\/?'+c.tag+'\\b[^>]*>','gi');re.lastIndex=c.start;let depth=1,m;while((m=re.exec(safe))){if(m[0].startsWith('</'))depth--;else if(!m[0].endsWith('/>'))depth++;if(depth===0){const html=safe.slice(c.start,m.index);if(html.replace(/<[^>]+>/g,' ').trim().length>=160)return{html,scope:'article'};break}}}
 return{html:safe,scope:'page'};
}
module.exports={articleHTML};
