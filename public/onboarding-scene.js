/* Original procedural chrome and spring interactions. No textures or network. */
(() => {
'use strict';
const vertex='attribute vec2 position;void main(){gl_Position=vec4(position,0.,1.);}';
const fragment=`precision highp float;
uniform vec2 resolution,pointer,lens;uniform vec4 camera;uniform float time,phase,energy,impulse,mobile;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
mat2 rot(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
void main(){
vec2 uv=(gl_FragCoord.xy-.5*resolution)/min(resolution.x,resolution.y);
vec2 center=mix(camera.xy,vec2(camera.x*.3,.5*resolution.y/min(resolution.x,resolution.y)-.38+camera.y*.2),mobile);
float zoom=camera.z*mix(1.,.78,mobile)*(1.+impulse*.055);
vec2 p=(uv-center-pointer*.026)/zoom;
p=rot(camera.w+sin(time*.12)*.075+pointer.x*.07)*p;
p.x*=1.04+lens.x*.16;p.y*=.96-lens.x*.08;
float a=atan(p.y,p.x),r=length(p);
float radius=.29+.023*sin(a*3.+time*.37+phase*.5)+.013*cos(a*2.-time*.23);
float w=.05+.012*sin(a*2.+time*.27+phase*.3),u=(r-radius)/w;
float aa=1.5/(min(resolution.x,resolution.y)*zoom*w);
float edge=1.-smoothstep(1.-aa,1.+aa,abs(u));
vec3 atmosphere=mix(vec3(.021,.033,.063),vec3(.055,.025,.043),lens.y);
vec3 bg=vec3(.014,.019,.029)+atmosphere*exp(-length(uv-center*.35)*1.8);
bg+=exp(-abs(r-radius)*15.)*vec3(.028,.047,.085)*(1.+energy*.8);
vec3 metal=vec3(0.);
if(abs(u)<1.+aa){
float z=sqrt(max(0.,1.-u*u));vec3 n=normalize(vec3(p/(r+.001)*u,z));n.xy=rot(.22*sin(a*3.+time*.29)+lens.x*.35)*n.xy;
float diffuse=max(0.,dot(n,normalize(vec3(-.6,.9,1.2))));
float strip=pow(.5+.5*sin(n.x*5.2+n.y*2.8+sin(a)*.7+time*.11),14.);
float softbox=pow(.5+.5*sin(n.x*3.1-n.y*4.4+cos(a)*.5),6.);
float sheen=pow(max(0.,dot(reflect(normalize(vec3(.8,-.7,-1.)),n),vec3(0.,0.,1.))),26.);
vec3 tint=mix(vec3(.30,.49,.72),vec3(.70,.52,.67),.5+.5*sin(a+time*.09+lens.y*2.));
tint=mix(tint,vec3(.86,.68,.43),pow(max(0.,sin(a-1.5)),10.)*.38);
metal=tint*(.10+diffuse*.48)+vec3(.83,.91,1.)*strip*.84+vec3(.73,.80,.93)*softbox*.31+vec3(1.)*sheen*.72;
metal+=mix(tint,vec3(.84,.90,1.),.4)*pow(1.-z,3.)*.55;
metal*=.78+z*.22;metal+=energy*.09+impulse*.06;}
vec3 c=mix(bg,metal,edge);
c+=vec3(.27,.36,.58)*exp(-abs(r-(radius+.095+.008*sin(a*4.-time*.3)))*540.)*.27;
c+=vec3(.55,.43,.35)*exp(-abs(r-(radius+.13))*650.)*.12;
c*=mix(.4,1.,smoothstep(.10,.68,length(uv*vec2(1.4,1.))));
c+=(hash(gl_FragCoord.xy+time)-.5)*.004;c*=1.-.2*smoothstep(.4,1.7,length(uv));gl_FragColor=vec4(c,1.);}`;
// Position, focal length, roll, tilt and color grade form a deliberate seven-shot sequence.
const shots=[
 {name:'orbit-wide',camera:[0,.02,1.46,-.28],lens:[.12,.20]},
 {name:'silver-edge',camera:[.58,-.33,2.45,.92],lens:[.45,.34]},
 {name:'liquid-profile',camera:[-.65,.10,2.18,-1.08],lens:[-.28,.06]},
 {name:'pearl-macro',camera:[.10,.68,2.80,1.65],lens:[.58,.18]},
 {name:'refraction-detail',camera:[.75,-.68,3.25,-.70],lens:[-.32,.75]},
 {name:'companion-portrait',camera:[-.48,-.12,1.90,1.55],lens:[.62,.90]},
 {name:'open-orbit',camera:[0,-.02,1.52,2.96],lens:[-.15,.12]}
];
function create(shell,reduced){
const canvas=shell.querySelector('.ob-canvas'),anchor=shell.querySelector('.ob-cursor-anchor'),cursor=shell.querySelector('.ob-cursor'),dot=shell.querySelector('.ob-cursor-dot'),light=shell.querySelector('.ob-pointer-light'),abort=new AbortController(),signal=abort.signal,fine=matchMedia('(hover:hover) and (pointer:fine)');
let gl,program,buffer,uniforms,frame,last=0,started=performance.now(),destroyed=false,dirty=true,px=0,py=0,sx=0,sy=0,hover=0,power=0,pulse=0,stage=0,targetStage=0,magnet,magnetRect;
const ringDiameter=parseFloat(getComputedStyle(cursor,'::after').width)||38,dotDiameter=parseFloat(getComputedStyle(dot,'::after').width)||7;
// The dot may trail outside the ring, up to 0.75 ring diameters beyond its outer edge.
const cursorOffsetLimit=Math.max(0,ringDiameter/2+ringDiameter*.75-dotDiameter/2),cursorLagMs=22,cursorSettleMs=42;
let ringX=0,ringY=0,mouseX=0,mouseY=0,frameMouseX=0,frameMouseY=0,ringAt=0,hasCursor=false;
const camera=[...shots[0].camera],lens=[...shots[0].lens];let targetShot=shots[0];shell.dataset.camera=targetShot.name;
const on=(node,event,fn)=>node.addEventListener(event,fn,{signal});
function fallback(){shell.dataset.renderer='fallback';canvas.hidden=true;gl=null;}
try{gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});if(!gl)throw Error('Unavailable');
const shader=(kind,code)=>{const s=gl.createShader(kind);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Compilation failed');return s;};
const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Link failed');gl.useProgram(program);
buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);uniforms={};for(const k of ['resolution','pointer','time','phase','energy','impulse','mobile','camera','lens'])uniforms[k]=gl.getUniformLocation(program,k);shell.dataset.renderer='webgl';}catch{fallback();}
function resize(){dirty=true;magnetRect=null;if(!gl)return;const scale=Math.min(devicePixelRatio||1,Math.sqrt(320000/(innerWidth*innerHeight)),1.5);canvas.width=Math.max(1,Math.round(innerWidth*scale));canvas.height=Math.max(1,Math.round(innerHeight*scale));gl.viewport(0,0,canvas.width,canvas.height);}
function reset(){if(magnet){for(const k of ['--mx','--my'])magnet.style.setProperty(k,'0px');for(const k of ['--rx','--ry'])magnet.style.setProperty(k,'0deg');magnet=null;}magnetRect=null;}
function paintRing(){cursor.style.transform=`translate3d(${ringX}px,${ringY}px,0)`;}
function moveCursor(x,y){
mouseX=x;mouseY=y;
if(!hasCursor){ringX=0;ringY=0;frameMouseX=x;frameMouseY=y;ringAt=performance.now();hasCursor=true;paintRing();}
// Move the pair together. Only the ring's small relative offset is animated.
anchor.style.transform=`translate3d(${x}px,${y}px,0)`;
}
function settleCursor(now){
if(!hasCursor||!fine.matches||reduced.matches)return;
const dt=Math.min(50,Math.max(0,now-ringAt));ringAt=Math.max(ringAt,now);if(!dt)return;
const dx=(frameMouseX-mouseX)*cursorLagMs/dt,dy=(frameMouseY-mouseY)*cursorLagMs/dt,distance=Math.hypot(dx,dy);
frameMouseX=mouseX;frameMouseY=mouseY;
// Soft saturation and a convex blend keep the offset bounded without hard positional clipping.
const scale=distance?cursorOffsetLimit*Math.tanh(distance/Math.max(.001,cursorOffsetLimit))/distance:0;
const follow=1-Math.exp(-dt/cursorSettleMs);ringX+=(dx*scale-ringX)*follow;ringY+=(dy*scale-ringY)*follow;
if(!distance&&Math.hypot(ringX,ringY)<.02){ringX=0;ringY=0;}paintRing();
}
on(shell,'pointermove',e=>{if(e.pointerType==='touch'||!fine.matches||reduced.matches)return;
// Input anchors the pair; frames only animate the ring within its allowed radius.
moveCursor(e.clientX,e.clientY);
px=(e.clientX/innerWidth-.5)*2;py=(.5-e.clientY/innerHeight)*2;shell.classList.add('has-pointer');anchor.hidden=false;cursor.hidden=false;dot.hidden=false;const control=e.target.closest('button,a,[role=radio]');hover=control?1:0;cursor.classList.toggle('is-hover',!!control);cursor.classList.toggle('is-text',!!e.target.closest('input,textarea'));
const target=e.target.closest('.ob-primary,.ob-back,.ob-brand');if(target!==magnet){reset();magnet=target;}if(magnet){const r=magnetRect||(magnetRect=magnet.getBoundingClientRect()),dx=Math.max(-1,Math.min(1,(e.clientX-r.left-r.width/2)/(r.width/2))),dy=Math.max(-1,Math.min(1,(e.clientY-r.top-r.height/2)/(r.height/2)));magnet.style.setProperty('--mx',dx*9+'px');magnet.style.setProperty('--my',dy*7+'px');magnet.style.setProperty('--rx',-dy*6+'deg');magnet.style.setProperty('--ry',dx*7+'deg');magnet.style.setProperty('--shine-x',(dx+1)*50+'%');magnet.style.setProperty('--shine-y',(dy+1)*50+'%');}});
function releaseCursor(){cursor.classList.remove('is-pressed');}
on(shell,'pointerleave',()=>{px=0;py=0;hover=0;hasCursor=false;releaseCursor();reset();shell.classList.remove('has-pointer');anchor.hidden=true;cursor.hidden=true;dot.hidden=true;});
on(shell,'pointerdown',e=>{if(reduced.matches)return;pulse=Math.max(pulse,.65);if(e.pointerType!=='touch'&&fine.matches&&e.target.closest('button,a'))cursor.classList.add('is-pressed');});
on(window,'pointerup',releaseCursor);on(window,'pointercancel',releaseCursor);on(window,'blur',releaseCursor);
on(window,'resize',resize);on(canvas,'webglcontextlost',e=>{e.preventDefault();fallback();});
function tick(now){if(destroyed)return;frame=requestAnimationFrame(tick);if(document.hidden)return;settleCursor(now);if(now-last<15||(reduced.matches&&!dirty))return;const elapsed=Math.min(50,Math.max(0,now-last)),frameRatio=elapsed/(1000/60),follow=1-Math.pow(.935,frameRatio);last=now;dirty=false;sx+=(px-sx)*follow;sy+=(py-sy)*follow;power+=(hover-power)*(1-Math.pow(.9,frameRatio));pulse*=Math.pow(.88,frameRatio);stage=reduced.matches?targetStage:stage+(targetStage-stage)*(1-Math.pow(.955,frameRatio));
for(let i=0;i<4;i++)camera[i]=reduced.matches?targetShot.camera[i]:camera[i]+(targetShot.camera[i]-camera[i])*follow;
for(let i=0;i<2;i++)lens[i]=reduced.matches?targetShot.lens[i]:lens[i]+(targetShot.lens[i]-lens[i])*follow;
if(light&&fine.matches&&!reduced.matches){light.style.setProperty('--pointer-x',sx);light.style.setProperty('--pointer-y',sy);}
if(gl){gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);gl.uniform2f(uniforms.pointer,sx,sy);gl.uniform4f(uniforms.camera,...camera);gl.uniform2f(uniforms.lens,...lens);gl.uniform1f(uniforms.time,reduced.matches?2.5:(now-started)/1000);gl.uniform1f(uniforms.phase,stage);gl.uniform1f(uniforms.energy,power);gl.uniform1f(uniforms.impulse,reduced.matches?0:pulse);gl.uniform1f(uniforms.mobile,innerWidth<760?1:0);gl.drawArrays(gl.TRIANGLES,0,6);}}
resize();frame=requestAnimationFrame(tick);
on(reduced,'change',()=>{dirty=true;if(reduced.matches){hasCursor=false;releaseCursor();shell.classList.remove('has-pointer');reset();anchor.hidden=true;cursor.hidden=true;dot.hidden=true;}});
return{step(v){dirty=true;targetStage=v;targetShot=shots[v]||shots[0];shell.dataset.camera=targetShot.name;shell.style.setProperty('--shot-x',targetShot.camera[0]);shell.style.setProperty('--shot-y',targetShot.camera[1]);shell.style.setProperty('--shot-zoom',targetShot.camera[2]);shell.style.setProperty('--shot-roll',targetShot.camera[3]+'rad');pulse=reduced.matches?0:1;hover=0;cursor.classList.remove('is-hover');reset();},burst(){dirty=true;pulse=1;},destroy(){destroyed=true;abort.abort();cancelAnimationFrame(frame);if(gl){gl.deleteBuffer(buffer);gl.deleteProgram(program);}shell.classList.remove('has-pointer');}};
}
window.MincetongMotion={create};
})();
