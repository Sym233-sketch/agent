/* Government sculpture: a wide, bevelled Mobius ribbon. No external assets. */
(() => {
  'use strict';
  function create(host, reduced) {
    const events = new AbortController(), signal = events.signal;
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    host.append(canvas);
    let gl, program, vertices, elements, frame = 0, observer;
    let disposed = false, lost = false, last = 0, time = 8;
    let px = 0, py = 0, sx = 0, sy = 0, level = 1, targetLevel = 1;
    const on = (node, event, handler) => node.addEventListener(event, handler, {signal});
    function stop() { cancelAnimationFrame(frame); frame = 0; last = 0; }
    function fallback() { host.dataset.renderer = 'fallback'; canvas.hidden = true; }
    function destroy() {
      disposed = true; stop(); events.abort(); observer?.disconnect();
      if (gl && !lost) {
        gl.deleteBuffer(vertices); gl.deleteBuffer(elements); gl.deleteProgram(program);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
      canvas.remove();
    }
    try {
      gl = canvas.getContext('webgl', {alpha:true,antialias:true,powerPreference:'low-power',premultipliedAlpha:false});
      if (!gl) throw Error('WebGL unavailable');
      const vertex = `precision mediump float;
        attribute vec3 position; attribute vec3 normal; attribute vec2 uv;
        uniform float time; uniform float aspect; uniform vec2 pointer;
        varying vec3 N; varying vec3 P; varying vec2 UV;
        mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
        mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
        mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
        void main(){
          mat3 r=rx(.68+sin(time*.08)*.16+pointer.y*.06)*ry(time*.055+pointer.x*.08)*rz(-.26+sin(time*.06)*.08);
          vec3 p=r*position; N=r*normal;P=p;UV=uv;
          float z=5.4-p.z;
          float zoom=3.6+sin(time*.07)*.10;
          float wide=smoothstep(.8,1.5,aspect);
          gl_Position=vec4(p.x*zoom/aspect+mix(.25,.34,wide)*z,p.y*zoom+.28*z,z-.1,z);
        }`;
      const fragment = `precision mediump float;
        varying vec3 N;varying vec3 P;varying vec2 UV;uniform float level;
        void main(){
          vec3 n=normalize(N),v=normalize(vec3(0.,0.,5.4)-P),r=reflect(-v,n);
          float facing=max(dot(n,v),0.);
          float rim=pow(1.-facing,2.5);
          float key=pow(max(dot(n,normalize(vec3(-.6,1.,1.7))),0.),1.7);
          float box=pow(.5+.5*sin(r.y*8.+r.x*3.),15.);
          float edge=pow(max(dot(n,normalize(vec3(1.,-.4,.6))),0.),5.);
          vec3 base=mix(vec3(.024,.036,.061),vec3(.28,.35,.46),key);
          vec3 color=base+box*vec3(.63,.73,.88)*.85+rim*vec3(.33,.40,.65)+edge*vec3(.39,.29,.58);
          float spec=pow(max(dot(reflect(normalize(vec3(.4,-1.,-1.)),n),v),0.),45.);
          color+=spec*vec3(.83,.80,1.);
          float cross=pow(.5+.5*cos(UV.x*6.283185*84.),65.);
          float contour=pow(.5+.5*cos(UV.y*6.283185*16.),42.);
          color+=(cross*.035+contour*.065)*vec3(.58,.67,.82)*(facing*.7+.3);
          color*=.58+.42*level;
          gl_FragColor=vec4(pow(color,vec3(.94)),1.);
        }`;
      function shader(type, source) {
        const shader = gl.createShader(type); gl.shaderSource(shader,source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) {
          gl.deleteShader(shader); throw Error('Scene shader unavailable');
        }
        return shader;
      }
      const vs = shader(gl.VERTEX_SHADER,vertex), fs = shader(gl.FRAGMENT_SHADER,fragment);
      program = gl.createProgram(); gl.attachShader(program,vs); gl.attachShader(program,fs); gl.linkProgram(program);
      gl.deleteShader(vs); gl.deleteShader(fs);
      if (!gl.getProgramParameter(program,gl.LINK_STATUS)) throw Error('Scene unavailable');
      gl.useProgram(program);
      // A broad strip with a half-turn, a thin solid edge and an asymmetric opening.
      // It has one ribbon silhouette, distinct from the resident's three-lobed tube.
      const signedRoot = value => Math.sign(value)*Math.sqrt(Math.abs(value));
      function surface(t,a) {
        const c=Math.cos(t),s=Math.sin(t),radius=1.04+.10*Math.cos(t-.7),twist=t*.5+.30*Math.sin(t);
        const width=(.41+.055*Math.cos(t))*signedRoot(Math.cos(a)),depth=.038*signedRoot(Math.sin(a));
        const radial=width*Math.cos(twist)-depth*Math.sin(twist);
        return [1.16*radius*c+radial*c,.84*radius*s+radial*s,.12*Math.sin(2*t)+width*Math.sin(twist)+depth*Math.cos(twist)];
      }
      const normalize = a => {const l=Math.hypot(...a);return a.map(v=>v/l);};
      const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
      const data = [], indices = [], segments = 256, sides = 64;
      for (let i=0;i<=segments;i++) {
        const t=i/segments*Math.PI*2;
        for (let j=0;j<=sides;j++) {
          const a=j/sides*Math.PI*2,p=surface(t,a),before=surface(t-.0001,a),after=surface(t+.0001,a);
          const left=surface(t,a-.0001),right=surface(t,a+.0001);
          const tangent=after.map((v,k)=>v-before[k]),across=right.map((v,k)=>v-left[k]);
          const n=normalize(cross(tangent,across));
          data.push(...p,...n,i/segments,j/sides);
          if(i<segments&&j<sides){const v=i*(sides+1)+j;indices.push(v,v+sides+1,v+1,v+1,v+sides+1,v+sides+2);}
        }
      }
      vertices = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,vertices); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
      for (const [name,size,offset] of [['position',3,0],['normal',3,12],['uv',2,24]]) {
        const attribute=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,size,gl.FLOAT,false,32,offset);
      }
      elements=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,elements);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
      gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
      const uniforms=Object.fromEntries(['time','aspect','pointer','level'].map(name=>[name,gl.getUniformLocation(program,name)]));
      function draw(now) {
        frame=0;if(disposed||lost)return;
        const dt=Math.min((now-(last||now))/1000,.05);last=now;
        if(!reduced.matches)time+=dt;
        sx+=(px-sx)*(1-Math.exp(-dt*3));sy+=(py-sy)*(1-Math.exp(-dt*3));
        level+=(targetLevel-level)*(1-Math.exp(-dt*3));
        gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
        gl.uniform1f(uniforms.time,reduced.matches?8:time);gl.uniform2f(uniforms.pointer,sx,sy);gl.uniform1f(uniforms.level,level);
        gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
        if(!document.hidden&&!reduced.matches)frame=requestAnimationFrame(draw);
      }
      function resume(){if(!disposed&&!lost&&!frame&&!document.hidden)frame=requestAnimationFrame(draw);}
      function resize(){
        const rect=host.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,1.35);
        canvas.width=Math.max(1,Math.round(rect.width*dpr));canvas.height=Math.max(1,Math.round(rect.height*dpr));
        gl.viewport(0,0,canvas.width,canvas.height);gl.uniform1f(uniforms.aspect,canvas.width/canvas.height);
        if(reduced.matches)draw(performance.now());else resume();
      }
      observer=new ResizeObserver(resize);observer.observe(host);
      on(document,'visibilitychange',()=>{stop();if(!document.hidden)resume();});
      on(document,'pointermove',e=>{if(e.pointerType==='touch'||reduced.matches)return;px=e.clientX/innerWidth-.5;py=e.clientY/innerHeight-.5;});
      on(document,'pointerleave',()=>{px=0;py=0;});
      on(reduced,'change',()=>{stop();if(reduced.matches){sx=sy=0;level=targetLevel;draw(performance.now());}else resume();});
      on(canvas,'webglcontextlost',event=>{event.preventDefault();lost=true;stop();fallback();});
      host.dataset.renderer='webgl';resize();
      return {destroy,setActivity(value){targetLevel=value;if(reduced.matches){level=value;draw(performance.now());}}};
    } catch {
      stop();observer?.disconnect();events.abort();
      if(gl){gl.deleteBuffer(vertices);gl.deleteBuffer(elements);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();lost=true;}
      fallback();
      return {destroy,setActivity(){}};
    }
  }
  window.MincetongGovernmentScene = {create};
})();
