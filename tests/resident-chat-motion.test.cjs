'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/service-desk.js'),'utf8');
// Exercise the private DOM reconciler without a browser or a model request.
const reconciler=source.slice(source.indexOf('function reconcileTranscript('),source.indexOf('function render(scroll='));
class Node {
 constructor(tag='div'){this.tag=tag;this.children=[];this.parent=null;this.style={};this.animations=[];this.moves=0;}
 set innerHTML(value){this.html=value;if(this.tag==='template'){this.content={firstElementChild:new Node()};this.content.firstElementChild.html=value;}}
 get innerHTML(){return this.html;}
 insertBefore(node,before){if(node.parent)node.remove();const index=before?this.children.indexOf(before):this.children.length;this.children.splice(index,0,node);node.parent=this;this.moves++;}
 remove(){if(!this.parent)return;this.parent.children.splice(this.parent.children.indexOf(this),1);this.parent=null;}
 animate(frames,options){this.animations.push({frames,options});}
}
function harness(reduced=false){
 const transcript=new Node(),context={current:null,busy:false,failure:null,greeting:'你好',recommendations:'',Map,Set,document:{createElement:tag=>new Node(tag)},$:()=>transcript,matchMedia:()=>({matches:reduced}),esc:s=>String(s).replaceAll('<','&lt;'),recommendationView:()=>context.recommendations};
 vm.createContext(context);vm.runInContext(reconciler,context);
 return {context,transcript,render:(messages=[],tail=[],animate=false)=>context.reconcileTranscript(messages,tail,animate)};
}
const user=text=>({role:'user',text}),assistant=text=>({role:'assistant',text});
test('pending message is retained after the reply, and settled history never reanimates or moves',()=>{
 const h=harness();h.render();const greeting=h.transcript.children[0];
 h.context.busy=true;h.render([], [user('想了解助餐')],true);const pending=h.transcript.children[1],thinking=h.transcript.children[2];
 assert.equal(pending.animations.length,1);assert.equal(greeting.animations.length,0);
 h.render([], [user('想了解助餐')],true);assert.equal(h.transcript.children[2],thinking);assert.equal(pending.animations.length,1);
 h.context.busy=false;h.context.current={id:'new-case'};h.render([user('想了解助餐'),assistant('我们先了解一下需要。')],[],true);
 assert.equal(h.transcript.children[0],greeting);assert.equal(h.transcript.children[1],pending);assert.equal(thinking.parent,null);
 const response=h.transcript.children[2],moves=h.transcript.moves;assert.equal(response.animations.length,1);
 h.render([user('想了解助餐'),assistant('我们先了解一下需要。')]);assert.equal(h.transcript.children[2],response);assert.equal(h.transcript.moves,moves);assert.equal(response.animations.length,1);
});
test('initial histories and a different case are settled immediately, while repeated text stays distinct',()=>{
 const h=harness();h.context.current={id:'first'};h.render([user('你好'),assistant('你好'),user('你好')]);
 const first=h.transcript.children[1],last=h.transcript.children[3];assert.notEqual(first,last);assert.equal(first.animations.length,0);
 h.render([user('你好'),assistant('你好'),user('你好')],[],true);assert.equal(h.transcript.children[1],first);assert.equal(h.transcript.children[3],last);
 h.context.current={id:'second'};h.render([user('你好')],[],true);assert.equal(first.parent,null);assert.equal(last.parent,null);assert.equal(h.transcript.children[1].animations.length,0);
});
test('unchanged recommendations retain their subtree and reduced motion creates no animation',()=>{
 const h=harness(true);h.render();h.context.recommendations='<section class="desk-recommendations">政策</section>';h.render([user('查询')],[],true);
 const recommendation=h.transcript.children.at(-1),message=h.transcript.children[1];assert.equal(message.animations.length,0);
 h.render([user('查询')],[],true);assert.equal(h.transcript.children.at(-1),recommendation);
 h.context.recommendations='<section class="desk-recommendations">新的政策</section>';h.render([user('查询')]);assert.equal(recommendation.parent,null);assert.equal(h.transcript.children[1],message);
});
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function raceHarness(){
 const started=deferred(),loadResult=deferred(),nodes=new Map(),node=()=>({value:'',focus(){},querySelectorAll:()=>[]}),host={isConnected:true,classList:{toggle(){},contains:()=>false},querySelector(selector){if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);}},nextCase={id:'updated-case',application:{status:'draft',missing:[]},messages:[],draft:{fields:[]}};
 const context={window:{},document:{querySelector:()=>host},crypto:{randomUUID:()=> 'race-request'}};
 vm.createContext(context);
 // Render is deliberately inert here: this tests async state ordering, without model or UI side effects.
 vm.runInContext(source.replace('window.MINCETONG_DESK={',"render=()=>{};review=()=>{};window.__deskRace={load,send,prepareMatter,resumeRecommendations,mount,current:()=>current,setCurrent:c=>current=c,setHost:h=>host=h};window.MINCETONG_DESK={"),context);
 const api=context.window.__deskRace;api.setHost(host);api.setCurrent({id:'original-case',recommendationParentId:'parent-case',messages:[],draft:{fields:[]}});
 context.window.MINCETONG_DESK.configure({ensure:async()=>{},toast(){},api:async(route,options)=>{if(route==='agent/desk'&&!options.method){started.resolve();return loadResult.promise;}return {case:nextCase};}});
 return {api,host,started,loadResult,nextCase};
}
for(const action of ['send','new case','prepare matter','resume recommendations'])test('a stale initial load cannot replace the result of '+action,async()=>{
 const h=raceHarness();let loading;
 if(action==='new case')h.api.mount();else loading=h.api.load();
 await h.started.promise;
 if(action==='send')await h.api.send('了解助餐','race-request');
 else if(action==='new case')await h.host.querySelector('#deskNew').onclick();
 else if(action==='prepare matter')await h.api.prepareMatter('meal-support');
 else await h.api.resumeRecommendations();
 assert.equal(h.api.current(),h.nextCase);
 h.loadResult.resolve({case:null});if(loading)await loading;else await new Promise(setImmediate);
 assert.equal(h.api.current(),h.nextCase,'the earlier GET must not erase the completed mutation');
});
