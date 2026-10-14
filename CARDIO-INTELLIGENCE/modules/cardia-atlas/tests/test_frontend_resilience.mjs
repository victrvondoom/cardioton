import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../app/static/cardia_atlas__app_static__app.js',import.meta.url),'utf8')
  .replace(/^import .*;\n/gm,'').replace(/init\(\);\s*$/,'');

function node(){
  return {className:'',innerHTML:'',textContent:'',value:'',disabled:false,dataset:{},style:{},children:[],
    classList:{add(){},remove(){},toggle(){}},addEventListener(){},append(){},appendChild(){},replaceChildren(...items){this.children=items},setAttribute(){},getBoundingClientRect(){return {width:320,height:240,left:0,top:0}}};
}
function context(fetch){
  const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};
  const ctx={console,fetch,URLSearchParams,location:{search:''},setTimeout,clearTimeout,CSS:{escape:x=>x},
    THREE:{Raycaster:class{},Vector2:class{}},document:{getElementById:get,createElement:node,querySelector(){return null},querySelectorAll(){return []}},
    requestAnimationFrame(){},ResizeObserver:class{observe(){}},devicePixelRatio:1};
  vm.createContext(ctx);vm.runInContext(source,ctx);return {ctx,get};
}
const response=(body,ok=true,status=200)=>({ok,status,json:async()=>body});

// A WebGL construction failure stays local to the 3D panel after the API data loads.
{
  const {ctx,get}=context(async url=>response(url==='/api/schema'?{fields:[]}:url==='/api/example'?{values:{}}:{targets:{}}));
  vm.runInContext('renderForm=()=>{};renderPerformance=()=>{};loadExample=async()=>{};mountThree=()=>{throw new Error("WebGL unsupported")}',ctx);
  await vm.runInContext('init()',ctx);
  assert.match(get('canvas-wrap').children[0].textContent,/3D view unavailable/);
  assert.equal(get('error-box').className,'');
  assert.match(get('analysis-state').innerHTML,/Awaiting inputs/);
}

// A late explanation cannot attach to a newer result or replace its selected explanation panel.
{
  let resolve;const {ctx,get}=context(()=>new Promise(r=>{resolve=r}));
  vm.runInContext("state.result={explanations:{},predictions:{CAD:{probability:.5}}};state.values={Age:58};state.schema={fields:[]};state.analysisVersion=3;state.selected='CAD'",ctx);
  const pending=vm.runInContext("loadExplanation('CAD')",ctx);
  vm.runInContext("state.result={explanations:{},predictions:{CAD:{probability:.7}}};state.values={Age:70};state.analysisVersion=4",ctx);
  resolve(response({prediction_probability:.5,baseline_probability:.4,additivity_error:0,contributions:[]}));
  await pending;
  assert.equal(vm.runInContext('Object.keys(state.result.explanations).length',ctx),0);
  assert.equal(get('baseline-line').textContent.includes('Explanation unavailable'),false);
}

// A late explanation failure after Clear cannot replace the reset state with an error.
{
  let reject;const {ctx,get}=context(()=>new Promise((_,r)=>{reject=r}));
  vm.runInContext("state.result={explanations:{},predictions:{CAD:{probability:.5}}};state.values={Age:58};state.schema={fields:[]};state.analysisVersion=8;state.selected='CAD'",ctx);
  const pending=vm.runInContext("loadExplanation('CAD')",ctx);
  vm.runInContext('invalidateAnalysis();state.result=null;state.values=null',ctx);
  reject(new Error('old explanation failed'));
  await pending;
  assert.equal(get('shap-bars').innerHTML.includes('old explanation failed'),false);
}

// A late prediction response cannot restore results after a later analysis invalidates it.
{
  let resolve;const {ctx,get}=context(()=>new Promise(r=>{resolve=r}));
  const age=node();age.value='58';
  ctx.document.querySelector=selector=>selector.includes('Age')?age:null;
  vm.runInContext("state.schema={fields:[{name:'Age',type:'number'}]};state.analysisVersion=11",ctx);
  const pending=vm.runInContext('onSubmit({preventDefault(){}})',ctx);
  vm.runInContext('invalidateAnalysis();state.result=null;state.values=null',ctx);
  resolve(response({predictions:{CAD:{probability:.5}},explanations:{}}));
  await pending;
  assert.equal(vm.runInContext('state.result',ctx),null);
  assert.equal(get('analysis-state').innerHTML.includes('Predictions ready'),false);
}

console.log('frontend resilience checks passed');
