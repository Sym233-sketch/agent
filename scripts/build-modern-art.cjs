/* Original vector artwork for the independent modern UI. No external assets. */
'use strict';
const fs=require('node:fs'),path=require('node:path');
const output=path.join(__dirname,'..','public','modern');
const tau=Math.PI*2;
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const mul=(a,k)=>a.map(x=>x*k);
const dot=(a,b)=>a.reduce((n,x,i)=>n+x*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/Math.hypot(...a));
const curve=t=>[(2+Math.cos(3*t))*Math.cos(2*t),(2+Math.cos(3*t))*Math.sin(2*t),Math.sin(3*t)];
function rotate(v){
  let [x,y,z]=v;
  [y,z]=[y*Math.cos(.76)-z*Math.sin(.76),y*Math.sin(.76)+z*Math.cos(.76)];
  [x,z]=[x*Math.cos(-.24)+z*Math.sin(-.24),-x*Math.sin(-.24)+z*Math.cos(-.24)];
  [x,y]=[x*Math.cos(-.16)-y*Math.sin(-.16),x*Math.sin(-.16)+y*Math.cos(-.16)];
  return [x,y,z];
}
const project=([x,y,z])=>[210+x*48/(1-z/13),137+y*48/(1-z/13)];
const light=unit([-.45,-.7,1]);
const half=unit(add(light,[0,0,1]));
function material(n){
  const diffuse=Math.max(0,dot(n,light));
  const reflection=Math.pow(.5+.5*Math.sin(n[1]*4.2+n[0]*1.4),5);
  const specular=Math.pow(Math.max(0,dot(n,half)),28);
  const rim=Math.pow(1-Math.max(0,n[2]),3);
  const value=.08+.36*Math.sqrt(diffuse)+.35*reflection+.7*specular+.18*rim;
  const cool=Math.max(0,n[0])*.1,rose=Math.max(0,-n[0])*.055;
  return '#'+[value*.95+rose,value*.99+cool*.35,value+cool+rose*.5].map(c=>Math.round(Math.max(0,Math.min(1,c))*255).toString(16).padStart(2,'0')).join('');
}
const rings=256,sides=36,radius=.25,mesh=[];
for(let i=0;i<=rings;i++){
  const t=i/rings*tau,p=curve(t),before=curve(t-.0002),after=curve(t+.0002);
  const tangent=unit(sub(after,before));
  let normal=unit(sub(add(before,after),mul(p,2)));
  const binormal=unit(cross(tangent,normal));normal=unit(cross(binormal,tangent));
  mesh.push(Array.from({length:sides},(_,j)=>{
    const a=j/sides*tau,n=add(mul(normal,Math.cos(a)),mul(binormal,Math.sin(a)));
    return {point:rotate(add(p,mul(n,radius))),normal:rotate(n)};
  }));
}
const faces=[];
for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){
  const k=(j+1)%sides,vertices=[mesh[i][j],mesh[i+1][j],mesh[i+1][k],mesh[i][k]];
  const n=unit(vertices.reduce((a,v)=>add(a,v.normal),[0,0,0]));
  if(n[2]<-.06)continue;
  const color=material(n),points=vertices.map(v=>project(v.point));
  const d=points.map((p,k)=>(k?'L':'M')+p.map(x=>x.toFixed(2)).join(' ')).join('')+'Z';
  faces.push({z:vertices.reduce((n,v)=>n+v.point[2],0)/4,path:`<path d="${d}" fill="${color}" stroke="${color}" stroke-width=".45" stroke-linejoin="round"/>`});
}
faces.sort((a,b)=>a.z-b.z);
const sculpture=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 300" fill="none"><defs><radialGradient id="mce-art-aura"><stop stop-color="#929aff" stop-opacity=".16"/><stop offset=".5" stop-color="#6088d8" stop-opacity=".055"/><stop offset="1" stop-color="#7b90d3" stop-opacity="0"/></radialGradient><radialGradient id="mce-art-floor"><stop stop-color="#b7d2ff" stop-opacity=".12"/><stop offset="1" stop-color="#b7d2ff" stop-opacity="0"/></radialGradient></defs><ellipse cx="218" cy="144" rx="195" ry="146" fill="url(#mce-art-aura)"/><ellipse cx="217" cy="264" rx="132" ry="19" fill="url(#mce-art-floor)"/>${faces.map(f=>f.path).join('')}</svg>`;
const mail=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 180" fill="none"><defs><linearGradient id="mce-mail-body" x1="48" y1="55" x2="191" y2="157" gradientUnits="userSpaceOnUse"><stop stop-color="#4d5b75"/><stop offset=".46" stop-color="#26344e"/><stop offset="1" stop-color="#101a2b"/></linearGradient><linearGradient id="mce-mail-edge" x1="52" y1="49" x2="186" y2="142" gradientUnits="userSpaceOnUse"><stop stop-color="#b7cbec"/><stop offset=".48" stop-color="#8188ba"/><stop offset="1" stop-color="#78a7d1"/></linearGradient><linearGradient id="mce-mail-paper" x1="103" y1="28" x2="141" y2="119" gradientUnits="userSpaceOnUse"><stop stop-color="#e0e7f1"/><stop offset="1" stop-color="#7b91af"/></linearGradient><radialGradient id="mce-mail-halo"><stop stop-color="#888fff" stop-opacity=".16"/><stop offset="1" stop-color="#888fff" stop-opacity="0"/></radialGradient></defs><ellipse cx="120" cy="94" rx="116" ry="85" fill="url(#mce-mail-halo)"/><path d="M48 76 117 34a8 8 0 0 1 8 0l68 42v70a10 10 0 0 1-10 10H58a10 10 0 0 1-10-10Z" fill="url(#mce-mail-body)" stroke="url(#mce-mail-edge)" stroke-width="1.2"/><rect x="80" y="35" width="83" height="103" rx="7" transform="rotate(7 80 35)" fill="url(#mce-mail-paper)" stroke="#cbd5e6" stroke-width=".6"/><path d="m95 59 48 6m-51 9 48 6m-50 9 31 4" stroke="#526886" stroke-width="2" stroke-linecap="round"/><path d="m49 78 72 44 71-44v68a9 9 0 0 1-9 9H58a9 9 0 0 1-9-9Z" fill="url(#mce-mail-body)" stroke="url(#mce-mail-edge)"/><path d="m52 150 48-42m89 42-47-42" stroke="#8399bd" stroke-opacity=".5"/><circle cx="181" cy="38" r="4" fill="#d4c5f6"/><circle cx="40" cy="113" r="2.5" fill="#a2c5ee"/><path d="M193 109h10m-5-5v10" stroke="#b9c9e3" stroke-opacity=".7" stroke-linecap="round"/></svg>`;
fs.mkdirSync(output,{recursive:true});
fs.writeFileSync(path.join(output,'modern-orbit.svg'),sculpture+'\n');
fs.writeFileSync(path.join(output,'modern-mail.svg'),mail+'\n');
const sculptureImage='<img class="sculpture-vector" alt="" width="420" height="300" decoding="async" src="data:image/svg+xml;base64,'+Buffer.from(sculpture).toString('base64')+'">';
fs.writeFileSync(path.join(output,'art.js'),'/* Generated by scripts/build-modern-art.cjs. Original project vectors. */\nwindow.MINCETONG_ART='+JSON.stringify({sculpture:sculptureImage,mail})+';\n');
console.log(`Built ${faces.length} vector surfaces and the mail illustration (${Math.round(Buffer.byteLength(sculpture)/1024)} KiB sculpture).`);
