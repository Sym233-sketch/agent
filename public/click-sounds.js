/* Original, deterministic click sounds. Audio starts only after a user action. */
(() => {
'use strict';
const definitions=[
 {id:'wood-duet',name:'木叩双音',hint:'木叩起音，清亮回应',duration:.13}
];
const sound=definitions[0],volume=.45;
function woodTone(t,edge){return .65*Math.sin(2*Math.PI*720*t)*Math.exp(-t/.008)+.26*Math.sin(2*Math.PI*1580*t)*Math.exp(-t/.005)+.1*Math.sin(2*Math.PI*230*t)*Math.exp(-t/.009)+.15*edge*Math.exp(-t/.0012);}
function duetTone(t,edge){
 const response=Math.max(0,t-.03),responseAttack=Math.sin(Math.min(1,response/.0012)*Math.PI/2)**2;
 return .6*Math.sin(2*Math.PI*1320*t)*Math.exp(-t/.011)+.38*Math.sin(2*Math.PI*1980*response)*Math.exp(-response/.017)*responseAttack+.025*edge*Math.exp(-t/.001);
}
function renderSound(id,sampleRate=24000){
 if(id!==sound.id)throw Error('Unknown click sound');
 if(!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>192000)throw Error('Invalid sample rate');
 // Keep the accepted waveform's noise seed when retiring the other sound choices.
 const data=new Float32Array(Math.ceil(sound.duration*sampleRate));let seed=7110,previous=0,peak=0;
 for(let i=0;i<data.length;i++){
  const t=i/sampleRate;seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/4294967296*2-1,edge=noise-previous;previous=noise;
  const value=.55*woodTone(t,edge)+.45*duetTone(t,edge);
  const attack=Math.min(1,t/.001),tail=Math.min(1,(data.length-1-i)/(sampleRate*.0015));
  data[i]=value*Math.sin(attack*Math.PI/2)**2*Math.sin(tail*Math.PI/2)**2;peak=Math.max(peak,Math.abs(data[i]));
 }
 if(peak)for(let i=0;i<data.length;i++)data[i]*=.62/peak;
 return data;
}
const api={definitions,renderSound};
if(typeof module==='object'&&module.exports){module.exports=api;return;}
window.MincetongClickSounds=api;
let engine,resuming;
const pcm=renderSound(sound.id),active=new Set();
function ensureAudio(){
 if(engine&&engine.context.state!=='closed')return engine;
 const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return null;
 const context=new Audio({latencyHint:'interactive'}),master=context.createGain();master.gain.value=volume*.45;master.connect(context.destination);
 const buffer=context.createBuffer(1,pcm.length,24000);buffer.copyToChannel(pcm,0);
 engine={context,master,buffer};return engine;
}
async function play(){
 if(document.hidden)return false;
 try{
  const audio=ensureAudio();if(!audio)return false;
  if(audio.context.state!=='running'){resuming ||=audio.context.resume().finally(()=>{resuming=null;});await resuming;}
  if(audio.context.state!=='running'||document.hidden)return false;
  while(active.size>=3){const oldest=active.values().next().value;active.delete(oldest);try{oldest.stop();}catch{}oldest.disconnect();}
  const source=audio.context.createBufferSource();source.buffer=audio.buffer;source.connect(audio.master);active.add(source);
  source.onended=()=>{active.delete(source);source.disconnect();};source.start();
  return true;
 }catch{return false;}
}
document.addEventListener('click',e=>{if(e.isTrusted===false||e.button>0)return;void play();},true);
})();
