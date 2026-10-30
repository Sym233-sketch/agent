/* Original motion/geometry. Design studies are recorded in RESIDENT-DESIGN.md. */
(()=>{'use strict';
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),ease='cubic-bezier(.22,1,.36,1)';
let cleanup=()=>{},previousView='',oldLayer=null,previousNav=null;
function before(view){
 const dispose=cleanup;cleanup=()=>{};
 const main=document.querySelector('.product-main'),nav=document.querySelector('.product-nav [aria-current]');
 previousNav=nav?.getBoundingClientRect();
 if(!main||view===previousView||reduced.matches){dispose();return;}
 oldLayer?.remove();const rect=main.getBoundingClientRect();
 oldLayer=main.cloneNode(true);oldLayer.removeAttribute('id');oldLayer.querySelectorAll('[id]').forEach(el=>{if(el.id==='deskSend')el.classList.add('resident-send');if(el.id==='deskNew')el.classList.add('resident-new');el.removeAttribute('id')});
 [oldLayer,...oldLayer.querySelectorAll('*')].forEach(el=>{for(const attribute of [...el.attributes])if(attribute.name.startsWith('data-')&&!['data-desk-empty','data-desk-busy','data-desk-state'].includes(attribute.name))el.removeAttribute(attribute.name)});
 oldLayer.setAttribute('aria-hidden','true');oldLayer.inert=true;oldLayer.classList.add('resident-outgoing');
 Object.assign(oldLayer.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',margin:'0',pointerEvents:'none',zIndex:'8'});
 const sources=main.querySelectorAll('canvas'),copies=oldLayer.querySelectorAll('canvas');
 sources.forEach((source,i)=>{try{copies[i].getContext('2d')?.drawImage(source,0,0)}catch{}});
 document.body.append(oldLayer);dispose();
}
function mount(view){
 const main=document.querySelector('.product-main');if(!main)return;
 const abort=new AbortController(),signal=abort.signal,changed=view!==previousView;previousView=view;
 document.body.dataset.residentView=view;
 const scenes=[...main.querySelectorAll('.product-hero-art,.desk-welcome')].map(el=>sculpture(el,signal));
 if(['home','hall'].includes(view))scenes.push(particles(signal));
 const lineIcon=path=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>';
 const reset=main.querySelector('#deskNew');if(reset){reset.setAttribute('aria-label','开始新对话');reset.title='开始新对话';reset.innerHTML=lineIcon('M12 5v14M5 12h14')+'<span>开始新对话</span>';}
 const prep=main.querySelector('#deskPreparationToggle');if(prep){prep.setAttribute('aria-label','准备稿');prep.innerHTML=lineIcon('M7 3h8l4 4v14H5V3h2Zm8 0v5h4M8 12h8M8 16h6');}
 const support=main.querySelector('[data-resident-support]');if(support)support.onclick=()=>{const open=main.querySelector('.product-home').classList.toggle('resident-support-open');support.setAttribute('aria-expanded',String(open));};
 const inputHint=main.querySelector('#deskMessage');if(inputHint)inputHint.placeholder='';
 if(!reduced.matches&&changed){
  if(oldLayer){const layer=oldLayer;oldLayer=null;layer.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-14px)',filter:'blur(4px)'}],{duration:300,easing:ease}).finished.catch(()=>{}).finally(()=>layer.remove());}
  main.animate([{opacity:0,transform:'translateY(22px)'},{opacity:1,transform:'translateY(0)'}],{duration:850,easing:ease});
  const parts=main.querySelectorAll('.product-eyebrow,.product-hero h1,.product-hero-copy>p,.product-primary,.desk-welcome-kicker,.desk-welcome h2,.desk-welcome>p,.desk-composer,.desk-suggestions');
  parts.forEach((el,i)=>el.animate([{opacity:0,transform:'translateY(18px)',filter:'blur(5px)'},{opacity:1,transform:'none',filter:'blur(0px)'}],{duration:1000,delay:90+i*65,easing:ease,fill:'backwards'}));
  const nav=document.querySelector('.product-nav [aria-current]');if(nav&&previousNav){const r=nav.getBoundingClientRect(),delta=previousNav.left-r.left;if(Math.abs(delta)>2)nav.animate([{boxShadow:`${delta}px 0 0 0 #ffffff12`},{boxShadow:'0 0 0 0 #ffffff12'}],{duration:550,easing:ease});}
 }
 const composer=main.querySelector('.desk-composer');
 if(composer){composer.addEventListener('pointermove',e=>{const r=composer.getBoundingClientRect();composer.style.setProperty('--light-x',(e.clientX-r.left)+'px');composer.style.setProperty('--light-y',(e.clientY-r.top)+'px')},{signal});const input=composer.querySelector('textarea');const resize=()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,160)+'px';composer.classList.toggle('has-text',!!input.value.trim())};input.addEventListener('input',resize,{signal});document.addEventListener('resident:desk-state',resize,{signal});resize();}
 main.querySelectorAll('.product-primary').forEach(button=>{button.addEventListener('pointermove',e=>{if(reduced.matches||e.pointerType==='touch')return;const r=button.getBoundingClientRect();button.style.transform=`translate(${(e.clientX-r.left-r.width/2)*.06}px,${(e.clientY-r.top-r.height/2)*.1}px)`},{signal});button.addEventListener('pointerleave',()=>button.style.transform='',{signal});});
 cleanup=()=>{abort.abort();scenes.forEach(s=>s.destroy())};
}
function sculpture(host,signal){
 const wrap=document.createElement('div');wrap.className='resident-sculpture';wrap.setAttribute('aria-hidden','true');
 wrap.innerHTML='<div class="resident-sculpture-halo"></div><canvas></canvas><div class="resident-sculpture-fallback"><i></i><i></i><i></i></div>';host.prepend(wrap);
 const canvas=wrap.querySelector('canvas');let gl,frame=0,visible=true,disposed=false,energy=0,targetEnergy=0,px=0,py=0,sx=0,sy=0,started=performance.now(),last=0;
 const on=(el,event,fn)=>el.addEventListener(event,fn,{signal});let program,buffer,indexBuffer,observer,intersector;
 const destroy=()=>{disposed=true;cancelAnimationFrame(frame);observer?.disconnect();intersector?.disconnect();if(gl){gl.deleteBuffer(buffer);gl.deleteBuffer(indexBuffer);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext()}wrap.remove()};
 try{
 gl=canvas.getContext('webgl',{alpha:true,antialias:true,powerPreference:'low-power',premultipliedAlpha:false,preserveDrawingBuffer:true});if(!gl)throw Error('No WebGL');
 const vs=`precision mediump float;attribute vec3 p;attribute vec3 n;uniform float time;uniform vec2 pointer;uniform float energy;uniform float aspect;varying vec3 normal;varying vec3 point;
 mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
 void main(){mat3 r=rx(.35+sin(time*.22)*.13+pointer.y*.14)*ry(time*.12+pointer.x*.18)*rz(-.28+sin(time*.15)*.1);vec3 q=r*(p*(1.+sin(time*.7)*.025));normal=r*n;point=q;float z=5.1-q.z;float zoom=3.25+1.25*(.5+.5*sin(time*.16-.8));vec2 framing=vec2(sin(time*.1)*.18,cos(time*.13)*.12);gl_Position=vec4(q.x*zoom/aspect+framing.x,q.y*zoom+framing.y,z-0.1,z);}`;
 const fs=`precision mediump float;varying vec3 normal;varying vec3 point;uniform float time;uniform float energy;
 void main(){vec3 N=normalize(normal),V=normalize(vec3(0.,0.,5.1)-point),R=reflect(-V,N);float f=pow(1.-max(dot(N,V),0.),2.4);float key=pow(max(dot(N,normalize(vec3(-.7,1.,1.5))),0.),1.3);float band=pow(.5+.5*sin(R.y*10.+R.x*3.),12.);float rim=pow(max(dot(N,normalize(vec3(1.,-.2,.3))),0.),4.);vec3 base=mix(vec3(.055,.012,.16),vec3(.36,.18,.64),key);vec3 pearl=.5+.5*cos(vec3(0.,2.,4.)+dot(N,V)*4.2+R.y*1.6+time*.08);vec3 color=base+band*vec3(.68,.42,1.)*.85+f*(vec3(.45,.2,.88)+pearl*.22)+rim*vec3(.7,.18,.66)+energy*.12*pearl;float spec=pow(max(dot(reflect(normalize(vec3(.3,-1.,-1.)),N),V),0.),40.);color+=spec*vec3(.75,.6,1.);gl_FragColor=vec4(pow(color,vec3(.9)),1.);}`;
 const shader=(type,source)=>{const sh=gl.createShader(type);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh)||'shader');return sh};const v=shader(gl.VERTEX_SHADER,vs),f=shader(gl.FRAGMENT_SHADER,fs);program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'program');gl.useProgram(program);
 // A continuous trefoil tube, with a parallel local frame. No image or external library.
 const center=t=>{const r=1.05+.32*Math.cos(3*t);return [r*Math.cos(2*t),r*Math.sin(2*t),.48*Math.sin(3*t)]};
 const normalize=a=>{const l=Math.hypot(...a);return a.map(v=>v/l)},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const data=[],indices=[],segments=240,sides=32;
 for(let i=0;i<=segments;i++){const t=i/segments*Math.PI*2,c=center(t),after=center(t+.001),tangent=normalize(after.map((v,k)=>v-c[k])),u=normalize(cross(tangent,[0,0,1])),w=normalize(cross(tangent,u));for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,normal=u.map((v,k)=>v*Math.cos(a)+w[k]*Math.sin(a)),radius=.19+.028*Math.cos(3*t);data.push(...c.map((v,k)=>v+normal[k]*radius),...normal);if(i<segments&&j<sides){const v=i*(sides+1)+j;indices.push(v,v+sides+1,v+1,v+1,v+sides+1,v+sides+2)}}}
 buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);for(const [name,offset] of [['p',0],['n',12]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,3,gl.FLOAT,false,24,offset)}indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
 const uniforms=Object.fromEntries(['time','pointer','energy','aspect'].map(n=>[n,gl.getUniformLocation(program,n)]));
 const resize=()=>{const rect=wrap.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.75);canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));gl.viewport(0,0,canvas.width,canvas.height);gl.uniform1f(uniforms.aspect,canvas.width/canvas.height);if(reduced.matches)draw(performance.now())};
 function draw(now){frame=0;if(disposed||gl.isContextLost())return;const dt=Math.min((now-(last||now))/1000,.05);last=now;sx+=(px-sx)*(1-Math.exp(-dt*4));sy+=(py-sy)*(1-Math.exp(-dt*4));energy+=(targetEnergy-energy)*(1-Math.exp(-dt*3));gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(uniforms.time,reduced.matches?2:(now-started)/1000);gl.uniform2f(uniforms.pointer,sx,sy);gl.uniform1f(uniforms.energy,energy);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);if(!reduced.matches&&visible&&!document.hidden)frame=requestAnimationFrame(draw)}
 const resume=()=>{if(!frame&&!disposed&&!gl.isContextLost()&&visible&&!document.hidden)frame=requestAnimationFrame(draw)};
 observer=new ResizeObserver(resize);observer.observe(wrap);intersector=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)resume();else{cancelAnimationFrame(frame);frame=0}},{rootMargin:'100px'});intersector.observe(wrap);
 on(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0}else resume()});
 on(document,'pointermove',e=>{px=(e.clientX/innerWidth-.5)*2;py=(e.clientY/innerHeight-.5)*2});
 on(document,'resident:desk-state',e=>{targetEnergy=e.detail.busy?1:0;wrap.dataset.busy=String(e.detail.busy)});
 on(reduced,'change',()=>{cancelAnimationFrame(frame);frame=0;if(reduced.matches)draw(performance.now());else resume()});
 on(canvas,'webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(frame);frame=0;wrap.dataset.renderer='fallback'});
 wrap.dataset.renderer='webgl';resize();resume();
 }catch(error){console.warn('Resident sculpture fallback:',error.message);wrap.dataset.renderer='fallback';canvas.hidden=true;}
 return {destroy};
}
// One sparse field behind the interface. Real motion, no fake task progress.
function particles(signal){
 const canvas=document.createElement('canvas');canvas.className='resident-particles';canvas.setAttribute('aria-hidden','true');document.body.prepend(canvas);
 const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();return {destroy:()=>{}};}
 let w=0,h=0,frame=0,disposed=false,start=performance.now(),mx=0,my=0,tx=0,ty=0,last=0;
 let seed=233;const random=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
 const dots=Array.from({length:innerWidth<700?85:145},()=>({x:random(),y:random(),z:.25+random()*.75,r:.4+random()*1.7,phase:random()*Math.PI*2,speed:.1+random()*.3}));
 const on=(el,event,fn)=>el.addEventListener(event,fn,{signal});
 function draw(now){frame=0;if(disposed)return;const time=reduced.matches?0:(now-start)/1000,dt=Math.min((now-(last||now))/1000,.05);last=now;mx+=(tx-mx)*(1-Math.exp(-dt*2));my+=(ty-my)*(1-Math.exp(-dt*2));ctx.clearRect(0,0,w,h);
 for(const dot of dots){const x=((dot.x*w+Math.sin(time*.12+dot.phase)*28+mx*dot.z*32)%w+w)%w,y=((dot.y*h-time*dot.speed*7+my*dot.z*22)%h+h)%h,alpha=(.24+.34*(.5+.5*Math.sin(time*.6+dot.phase)))*dot.z;ctx.beginPath();ctx.fillStyle='rgba(183,139,255,'+alpha+')';ctx.shadowColor='#ae6cff';ctx.shadowBlur=dot.r>1?9:0;ctx.arc(x,y,dot.r*dot.z,0,Math.PI*2);ctx.fill();}
 ctx.shadowBlur=0;if(!reduced.matches&&!document.hidden)frame=requestAnimationFrame(draw);
 }
 const resize=()=>{w=innerWidth;h=innerHeight;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(reduced.matches)draw(performance.now());};
 const resume=()=>{if(!frame&&!disposed&&!document.hidden)frame=requestAnimationFrame(draw)};
 on(window,'resize',resize);on(document,'pointermove',e=>{tx=e.clientX/w-.5;ty=e.clientY/h-.5;});
 on(document,'visibilitychange',()=>{cancelAnimationFrame(frame);frame=0;if(!document.hidden)resume();});
 on(document,'resident:desk-state',e=>canvas.classList.toggle('is-quiet',!e.detail.empty));
 on(reduced,'change',()=>{cancelAnimationFrame(frame);frame=0;if(reduced.matches)draw(performance.now());else resume();});
 resize();resume();return {destroy:()=>{disposed=true;cancelAnimationFrame(frame);canvas.remove();}};
}
window.MINCETONG_PREMIERE={before,mount,leave:()=>{cleanup();cleanup=()=>{};oldLayer?.remove();oldLayer=null;previousView='';}};
})();
