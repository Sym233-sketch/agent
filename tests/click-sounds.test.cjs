'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{definitions,renderSound}=require('../public/click-sounds.js');
test('click sounds are short, reproducible and fade to silent boundaries without clipping',()=>{
 for(const sound of definitions)for(const rate of [24000,48000]){
  const samples=renderSound(sound.id,rate);assert.deepEqual(samples,renderSound(sound.id,rate));assert.equal(samples.length,Math.ceil(sound.duration*rate));assert.ok(samples.length/rate<=.15);
  assert.equal(Math.abs(samples[0]),0);assert.equal(Math.abs(samples.at(-1)),0);let peak=0,mean=0,energy=0;
  for(const value of samples){assert.ok(Number.isFinite(value));peak=Math.max(peak,Math.abs(value));mean+=value;energy+=value*value;}
  assert.ok(peak>.6&&peak<.63);assert.ok(peak*.45*3<1,'Three simultaneous voices retain output headroom');assert.ok(Math.abs(mean/samples.length)<.002);assert.ok(Math.sqrt(energy/samples.length)>.025);
 }
});
test('click feedback works at fixed 45 percent without a settings UI or stored preferences',async()=>{
 let click,contexts=0,starts=0,master;
 const document={hidden:false,addEventListener(type,listener){assert.equal(type,'click');click=listener;}};
 class AudioContext{
  constructor(){contexts++;this.state='suspended';this.destination={};}
  createGain(){master={gain:{value:0},connect(){}};return master;}
  createBuffer(channels,length,rate){assert.equal(channels,1);assert.equal(rate,24000);assert.ok(length>0);return{copyToChannel(){}};}
  createBufferSource(){return{connect(){},disconnect(){},stop(){},start(){starts++;this.onended();}};}
  async resume(){this.state='running';}
 }
 vm.runInNewContext(fs.readFileSync(require.resolve('../public/click-sounds.js'),'utf8'),{window:{AudioContext},document});
 assert.equal(contexts,0,'Loading the page must not start audio');
 click({isTrusted:false,button:0});click({isTrusted:true,button:2});document.hidden=true;click({isTrusted:true,button:0});assert.equal(contexts,0);
 document.hidden=false;click({isTrusted:true,button:0});await new Promise(setImmediate);
 assert.equal(contexts,1);assert.equal(starts,1);assert.equal(master.gain.value,.45*.45);
 click({isTrusted:true,button:0});await new Promise(setImmediate);assert.equal(starts,2);assert.equal(contexts,1);
});
test('sound renderer rejects invalid themes and sample rates',()=>{
 for(const id of ['missing','tap','crystal','pop','chime','droplet','wood','duet'])assert.throws(()=>renderSound(id),/Unknown/);for(const rate of [0,7999,192001,NaN,24000.5])assert.throws(()=>renderSound('wood-duet',rate),/sample rate/);
});
