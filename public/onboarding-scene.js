/* Original procedural chrome and spring interactions. No textures or network. */
(() => {
'use strict';
const vertex='attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}';
const fragment=`precision highp float;
uniform vec2 resolution,pointer;uniform float time,phase,energy,impulse,mobile;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
mat2 rot(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
void main(){
vec2 uv=(gl_FragCoord.xy-.5*resolution)/min(resolution.x,resolution.y);
vec2 center=mix(vec2(.34,.01),vec2(0.,.5*resolution.y/min(resolution.x,resolution.y)-.46),mobile);
vec2 p=(uv-center-pointer*.038)/mix(1.,.66,mobile);
p=rot(-.34+sin(time*.14)*.12+pointer.x*.1+phase*.07)*p;p.x*=1.07;p.y*=.91;
float a=atan(p.y,p.x),r=length(p);
float radius=(.29+.026*sin(a*3.+time*.51+phase*.65)+.016*cos(a*2.-time*.29))*(1.-mobile*.06)*(1.+impulse*.45);
float w=.053+.016*sin(a*2.+time*.33+phase*.3),u=(r-radius)/w,edge=1.-smoothstep(.92,1.03,abs(u));
vec3 bg=vec3(.019,.025,.037)+vec3(.022,.033,.066)*exp(-length(uv-vec2(.3,0.))*1.8)+vec3(.055,.028,.042)*exp(-length(uv-vec2(-.4,-.5))*2.6);
bg+=exp(-abs(r-radius)*15.)*vec3(.028,.047,.085)*(1.+energy*.8);
vec3 metal=vec3(0.);
if(abs(u)<1.03){
float z=sqrt(max(0.,1.-u*u));vec3 n=normalize(vec3(p/(r+.001)*u,z));n.xy=rot(.25*sin(a*3.+time*.35))*n.xy;
float diffuse=max(0.,dot(n,normalize(vec3(-.6,.9,1.2))));
float strip=pow(.5+.5*sin(n.x*5.5+n.y*2.8+sin(a)*.7+time*.14),9.);
float sheen=pow(max(0.,dot(reflect(normalize(vec3(.8,-.7,-1.)),n),vec3(0.,0.,1.))),26.);
vec3 tint=mix(vec3(.25,.47,.82),vec3(.79,.62,.83),.5+.5*sin(a+time*.12+phase*.35));
tint=mix(tint,vec3(.94,.49,.30),pow(max(0.,sin(a-1.5)),8.)*.6);
metal=tint*(.16+diffuse*.72)+vec3(.85,.93,1.)*strip*.94+vec3(1.)*sheen*.9;
metal+=tint*pow(1.-z,2.5)*.6+pow(.5+.5*sin(a*34.+n.z*13.-time*.25),28.)*.05;
metal*=.75+z*.25;metal+=energy*.12+impulse*.13;}
vec3 c=mix(bg,metal,edge);
c+=vec3(.27,.36,.58)*exp(-abs(r-(radius+.095+.008*sin(a*4.-time*.3)))*540.)*.27;
c+=vec3(.55,.43,.35)*exp(-abs(r-(radius+.13))*650.)*.12;
c+=(hash(gl_FragCoord.xy+time)-.5)*.007;c*=1.-.22*smoothstep(.3,1.6,length(uv));gl_FragColor=vec4(c,1.);}`;
function create(shell,reduced){
const canvas=shell.querySelector('.ob-canvas'),cursor=shell.querySelector('.ob-cursor'),dot=shell.querySelector('.ob-cursor-dot'),abort=new AbortController(),signal=abort.signal,fine=matchMedia('(hover:hover) and (pointer:fine)');
let gl,program,buffer,uniforms,frame,last=0,started=performance.now(),destroyed=false,dirty=true,px=0,py=0,sx=0,sy=0,cx=innerWidth/2,cy=innerHeight/2,tx=cx,ty=cy,hover=0,power=0,pulse=0,stage=0,targetStage=0,magnet;
const on=(node,event,fn)=>node.addEventListener(event,fn,{signal});
function fallback(){shell.dataset.renderer='fallback';canvas.hidden=true;gl=null;}
try{gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});if(!gl)throw Error('Unavailable');
const shader=(kind,code)=>{const s=gl.createShader(kind);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Compilation failed');return s;};
const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Link failed');gl.useProgram(program);
buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);uniforms={};for(const k of ['resolution','pointer','time','phase','energy','impulse','mobile'])uniforms[k]=gl.getUniformLocation(program,k);shell.dataset.renderer='webgl';}catch{fallback();}
function resize(){dirty=true;if(!gl)return;const scale=Math.min(devicePixelRatio||1,Math.sqrt(650000/(innerWidth*innerHeight)),1.5);canvas.width=Math.max(1,Math.round(innerWidth*scale));canvas.height=Math.max(1,Math.round(innerHeight*scale));gl.viewport(0,0,canvas.width,canvas.height);}
function reset(){if(magnet){for(const k of ['--mx','--my'])magnet.style.setProperty(k,'0px');for(const k of ['--rx','--ry'])magnet.style.setProperty(k,'0deg');magnet=null;}}
on(shell,'pointermove',e=>{if(e.pointerType==='touch'||!fine.matches||reduced.matches)return;tx=e.clientX;ty=e.clientY;px=(tx/innerWidth-.5)*2;py=(.5-ty/innerHeight)*2;shell.classList.add('has-pointer');cursor.hidden=false;dot.hidden=false;const control=e.target.closest('button,a,[role=radio]');hover=control?1:0;cursor.classList.toggle('is-hover',!!control);cursor.classList.toggle('is-text',!!e.target.closest('input,textarea'));
const target=e.target.closest('.ob-primary,.ob-back,.ob-brand');if(target!==magnet){reset();magnet=target;}if(magnet){const r=magnet.getBoundingClientRect(),dx=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/(r.width/2))),dy=Math.max(-1,Math.min(1,(e.clientY-r.top-r.height/2)/(r.height/2)));magnet.style.setProperty('--mx',dx*9+'px');magnet.style.setProperty('--my',dy*7+'px');magnet.style.setProperty('--rx',-dy*6+'deg');magnet.style.setProperty('--ry',dx*7+'deg');magnet.style.setProperty('--shine-x',(dx+1)*50+'%');magnet.style.setProperty('--shine-y',(dy+1)*50+'%');}});
on(shell,'pointerleave',()=>{px=0;py=0;hover=0;reset();shell.classList.remove('has-pointer');cursor.hidden=true;dot.hidden=true;});
on(shell,'pointerdown',e=>{if(reduced.matches)return;pulse=Math.max(pulse,.65);const b=e.target.closest('button');if(!b)return;const r=b.getBoundingClientRect(),ripple=document.createElement('i');ripple.className='ob-ripple';ripple.style.left=e.clientX-r.left+'px';ripple.style.top=e.clientY-r.top+'px';b.append(ripple);setTimeout(()=>ripple.remove(),850);});
on(window,'resize',resize);on(canvas,'webglcontextlost',e=>{e.preventDefault();fallback();});
function tick(now){if(destroyed)return;frame=requestAnimationFrame(tick);if(document.hidden||now-last<15||(reduced.matches&&!dirty))return;last=now;dirty=false;sx+=(px-sx)*.065;sy+=(py-sy)*.065;cx+=(tx-cx)*.18;cy+=(ty-cy)*.18;power+=(hover-power)*.1;pulse*=.88;stage=reduced.matches?targetStage:stage+(targetStage-stage)*.045;
if(fine.matches&&!reduced.matches){cursor.style.transform=`translate3d(${cx}px,${cy}px,0)`;dot.style.transform=`translate3d(${tx}px,${ty}px,0)`;shell.style.setProperty('--pointer-x',sx);shell.style.setProperty('--pointer-y',sy);}
if(gl){gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);gl.uniform2f(uniforms.pointer,sx,sy);gl.uniform1f(uniforms.time,reduced.matches?2.5:(now-started)/1000);gl.uniform1f(uniforms.phase,stage);gl.uniform1f(uniforms.energy,power);gl.uniform1f(uniforms.impulse,reduced.matches?0:pulse);gl.uniform1f(uniforms.mobile,innerWidth<760?1:0);gl.drawArrays(gl.TRIANGLES,0,6);}}
resize();frame=requestAnimationFrame(tick);
on(reduced,'change',()=>{dirty=true;if(reduced.matches){shell.classList.remove('has-pointer');reset();cursor.hidden=true;dot.hidden=true;}});
return{step(v){dirty=true;targetStage=v;pulse=reduced.matches?0:1;hover=0;cursor.classList.remove('is-hover');reset();},burst(){dirty=true;pulse=1;},destroy(){destroyed=true;abort.abort();cancelAnimationFrame(frame);if(gl){gl.deleteBuffer(buffer);gl.deleteProgram(program);}shell.classList.remove('has-pointer');}};
}
window.MincetongMotion={create};
})();
