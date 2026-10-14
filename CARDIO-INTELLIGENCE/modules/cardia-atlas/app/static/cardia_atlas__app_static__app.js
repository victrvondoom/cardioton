import * as THREE from './vendor/three.module.js';
import { OrbitControls } from './vendor/OrbitControls.js';
import { bandForProbability } from './risk_bands.mjs';

const state={schema:null,example:null,result:null,values:null,selected:'CAD',analysisVersion:0,pendingExplanations:new Map(),scene:null,camera:null,renderer:null,controls:null,arteries:{},labels:{},raycaster:new THREE.Raycaster(),pointer:new THREE.Vector2()};
const $=id=>document.getElementById(id);
const vesselLabels={LAD:'LAD · anterior descending',LCX:'LCX · circumflex',RCA:'RCA · right coronary'};
const targetNames={CAD:'Overall CAD',LAD:'LAD',LCX:'LCX',RCA:'RCA'};
const colors={low:0x69c69a,moderate:0xe5b66c,high:0xee7270,neutral:0x779096};
function riskColor(p){return colors[bandForProbability(p)]}
function hexColor(n){return `#${n.toString(16).padStart(6,'0')}`}
function esc(s){return String(s).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]))}

async function init(){
  try{
    const [s,e,p]=await Promise.all([fetch('/api/schema'),fetch('/api/example'),fetch('/api/performance')]);
    const failed=[s,e,p].find(x=>!x.ok);if(failed){let detail='The local API did not return its setup files.';try{detail=(await failed.json()).detail||detail}catch{}throw new Error(detail)}
    state.schema=await s.json();state.example=await e.json();const perf=await p.json();
    renderForm();renderPerformance(perf);await loadExample(false);
    $('analysis-state').innerHTML='<i></i> Awaiting inputs';
    try{mountThree()}catch(err){
      const notice=document.createElement('p');notice.className='loading-explanation';notice.setAttribute('role','status');
      notice.textContent='3D view unavailable in this browser. Enable WebGL or use a compatible browser to rotate and zoom the heart. Predictions, vessel scores and explanations remain available below.';
      $('canvas-wrap').replaceChildren(notice);
    }
  }catch(err){showError(err.message||String(err));$('analysis-state').innerHTML='<i></i> API unavailable';}
  $('clinical-form').addEventListener('submit',onSubmit);
  $('load-example').addEventListener('click',()=>loadExample(true));
  $('clear-form').addEventListener('click',clearForm);
  $('explain-target').addEventListener('change',e=>selectTarget(e.target.value));
  $('reset-view').addEventListener('click',()=>{if(state.controls){state.controls.reset();state.camera.position.set(0,0,5.3)}});
  if(new URLSearchParams(location.search).get('demo')==='1'){
    await loadExample(false);
    await onSubmit({preventDefault(){}});
  }
}
function renderForm(){
  const groups=state.schema.fields.reduce((a,f)=>((a[f.group]??=[]).push(f),a),{});
  $('field-count').textContent=`${state.schema.fields.length} predictors`;
  $('field-groups').innerHTML=Object.entries(groups).map(([group,fields],i)=>`<details class="field-group" ${i<2?'open':''}><summary>${esc(group)} <span>${fields.length} fields</span></summary><div class="fields">${fields.map(renderField).join('')}</div></details>`).join('');
  document.querySelectorAll('#clinical-form input,#clinical-form select').forEach(el=>el.addEventListener('input',()=>{
    delete el.dataset.demoExact;
    $('example-note').textContent='Edited profile: values no longer match the synthetic feature-wise median/mode demo. Use synthetic data only.';
  }));
}
function renderField(f){
  let input='';
  if(f.type==='select'||f.type==='coded_select'){
    input=`<select name="${esc(f.name)}"><option value="">Not provided</option>${f.options.map(x=>`<option value="${esc(x.value)}">${esc(x.label)}</option>`).join('')}</select>`;
  }else{
    const step=f.step==='any'?'any':f.step;
    input=`<input name="${esc(f.name)}" type="number" step="${step}" min="${f.min}" max="${f.max}" placeholder="${Number.isInteger(f.median)?f.median:f.median.toFixed(2)}">`;
  }
  const showRange=x=>Number.isInteger(Number(x))?String(x):Number(x).toFixed(2);
  let hint=f.type==='number'?`Source range ${showRange(f.min)}–${showRange(f.max)}; units unspecified.`:f.type==='coded_select'?'Source-coded value; meaning not defined in the dataset metadata.':'Blank is allowed.';
  return `<div class="field"><label for="f-${esc(f.name)}">${esc(f.label)}</label>${input.replace(`name="${esc(f.name)}"`,`id="f-${esc(f.name)}" name="${esc(f.name)}"`)}<small>${esc(hint)}</small></div>`;
}
async function loadExample(show=true){
  for(const [key,value] of Object.entries(state.example.values||{})){
    const input=document.querySelector(`[name="${CSS.escape(key)}"]`);if(input){const field=state.schema.fields.find(f=>f.name===key);input.dataset.demoExact=String(value);input.value=field?.name==='BMI'?Number(value).toFixed(1):(field?.type==='number'&&field?.step==='any'?Number(value).toFixed(2):value)}
  }
  $('example-note').textContent=state.example.label||'Synthetic demonstration values only.';
  if(show){$('example-note').classList.add('flash');setTimeout(()=>$('example-note').classList.remove('flash'),800)}
}
function invalidateAnalysis(){state.analysisVersion+=1;state.pendingExplanations.clear();return state.analysisVersion}
function clearForm(){invalidateAnalysis();document.querySelectorAll('#clinical-form input,#clinical-form select').forEach(x=>{x.value='';delete x.dataset.demoExact});$('example-note').textContent='All fields cleared. Blank fields will be imputed by the fitted pipeline.';state.result=null;state.values=null;$('result-content').classList.add('hidden');$('results-empty').classList.remove('hidden');$('analysis-state').innerHTML='<i></i> Awaiting inputs';setArteryProbabilities(null)}
async function onSubmit(e){
  e.preventDefault();const analysisVersion=invalidateAnalysis();clearError();const button=$('predict');button.disabled=true;button.innerHTML='<span>Calculating models…</span><span class="spinner"></span>';$('analysis-state').className='status-badge waiting';$('analysis-state').innerHTML='<i></i> Computing';
  try{
    const values={};for(const f of state.schema.fields){const el=document.querySelector(`[name="${CSS.escape(f.name)}"]`);let v=el?.dataset.demoExact??el?.value??'';values[f.name]=v===''?null:(f.type==='number'||f.type==='coded_select'?Number(v):v)}
    const res=await fetch('/api/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({values,include_explanations:false})});
    const payload=await res.json();if(!res.ok)throw new Error(payload.detail||`Request failed (${res.status})`);if(state.analysisVersion!==analysisVersion)return;
    state.values=values;state.result=payload;state.selected='CAD';renderResults();$('analysis-state').className='status-badge ready';$('analysis-state').innerHTML='<i></i> Predictions ready';loadExplanation('CAD');
  }catch(err){if(state.analysisVersion!==analysisVersion)return;showError(err.message||String(err));$('analysis-state').className='status-badge';$('analysis-state').innerHTML='<i></i> Could not analyze'}
  finally{if(state.analysisVersion===analysisVersion){button.disabled=false;button.innerHTML='<span>Generate analysis</span><span aria-hidden="true">→</span>'}}
}
function renderResults(){
  $('results-empty').classList.add('hidden');$('result-content').classList.remove('hidden');
  const preds=state.result.predictions;
  $('prediction-cards').innerHTML=Object.entries(preds).map(([key,d])=>`<button class="prediction-card ${key===state.selected?'selected':''}" data-target="${key}"><span class="name">${targetNames[key].toUpperCase()}</span><div class="prob" style="color:${hexColor(riskColor(d.probability))}">${(d.probability*100).toFixed(1)}%</div><span class="class">${d.predicted_class==='positive'?'Model positive':'Model negative'} · ${esc(d.model)}</span><div class="meter"><i style="width:${d.probability*100}%;background:${hexColor(riskColor(d.probability))}"></i></div></button>`).join('');
  document.querySelectorAll('.prediction-card').forEach(el=>el.addEventListener('click',()=>selectTarget(el.dataset.target)));
  $('explain-target').innerHTML=Object.keys(preds).map(k=>`<option value="${k}">${targetNames[k]}</option>`).join('');$('explain-target').value=state.selected;
  setArteryProbabilities(preds);renderVessels(preds);renderExplanation();
}
function selectTarget(t){state.selected=t;$('explain-target').value=t;document.querySelectorAll('.prediction-card').forEach(x=>x.classList.toggle('selected',x.dataset.target===t));document.querySelectorAll('.vessel-item').forEach(x=>x.classList.toggle('active',x.dataset.target===t));renderExplanation();loadExplanation(t)}
function renderVessels(preds){
  $('vessel-list').innerHTML=['LAD','LCX','RCA'].map(k=>{const p=preds[k].probability;return `<button class="vessel-item ${state.selected===k?'active':''}" data-target="${k}"><span class="v-name"><i class="vessel-dot" style="background:${hexColor(riskColor(p))}"></i>${k}</span><div class="v-prob" style="color:${hexColor(riskColor(p))}">${(p*100).toFixed(1)}%</div><div class="v-caption">predicted probability</div></button>`}).join('');
  document.querySelectorAll('.vessel-item').forEach(el=>el.addEventListener('click',()=>selectTarget(el.dataset.target)));
}
function renderExplanation(){
  if(!state.result)return;const key=state.selected,exp=state.result.explanations[key];
  if(!exp){$('baseline-line').textContent=`Loading ${targetNames[key]} explanation…`;$('shap-bars').innerHTML='<div class="loading-explanation">Calculating the selected outcome’s explanation…</div>';return;}
  $('baseline-line').textContent=`${targetNames[key]} estimate ${(exp.prediction_probability*100).toFixed(1)}%  ·  Background baseline ${(exp.baseline_probability*100).toFixed(1)}%  ·  Additivity difference ${(exp.additivity_error*100).toFixed(3)} percentage points`;
  const vals=exp.contributions||[],max=Math.max(...vals.map(x=>Math.abs(x.value)),.0001);
  $('shap-bars').innerHTML=vals.map(x=>{const width=Math.max(2,Math.abs(x.value)/max*47);const feature=state.schema.fields.find(f=>f.name===x.feature);const patientValue=x.input===null?'Blank → imputed':(typeof x.input==='number'?Number(x.input).toLocaleString(undefined,{maximumFractionDigits:2}):String(x.input));const unit=feature?.unit&& !feature.unit.includes('does not specify')?feature.unit:'';return `<div class="shap-row"><span class="shap-label" title="${esc(x.feature)}">${esc(feature?.label||x.feature)}</span><span class="shap-patient-value" title="Input value from this analysis">${esc(patientValue)}${unit?` ${esc(unit)}`:''}</span><div class="shap-track"><i class="shap-zero"></i><i class="shap-fill ${x.value>=0?'pos':'neg'}" style="width:${width}%"></i></div><span class="shap-value">${x.value>=0?'+':''}${(x.value*100).toFixed(2)} pp</span></div>`}).join('');
}
async function loadExplanation(target){
  if(!state.result||state.result.explanations[target]||!state.values)return;
  const analysis=state.result,values=state.values,analysisVersion=state.analysisVersion;
  if(state.pendingExplanations.get(target)===analysisVersion)return;
  state.pendingExplanations.set(target,analysisVersion);
  try{
    renderExplanation();
    const res=await fetch(`/api/explain/${encodeURIComponent(target)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({values})});
    const payload=await res.json();if(!res.ok)throw new Error(payload.detail||`Explanation request failed (${res.status})`);
    if(state.analysisVersion!==analysisVersion||state.result!==analysis)return;
    analysis.explanations[target]=payload;
    if(state.selected===target)renderExplanation();
  }catch(err){
    if(state.analysisVersion===analysisVersion&&state.result===analysis&&state.selected===target){$('baseline-line').textContent='Explanation unavailable.';$('shap-bars').innerHTML=`<div class="loading-explanation">${esc(err.message||String(err))}</div>`;}
  }finally{if(state.pendingExplanations.get(target)===analysisVersion)state.pendingExplanations.delete(target)}
}
function setArteryProbabilities(preds){
  for(const [key,obj] of Object.entries(state.arteries)){const p=preds?.[key]?.probability;const color=p==null?colors.neutral:riskColor(p);obj.material.color.setHex(color);obj.material.emissive.setHex(color);obj.material.emissiveIntensity=.18;obj.children?.forEach?.(c=>c.material?.color?.setHex(color))}
  if(state.scene){state.scene.traverse(o=>{if(o.userData.vessel){const p=preds?.[o.userData.vessel]?.probability,c=p==null?colors.neutral:riskColor(p);if(o.material?.color)o.material.color.setHex(c)}})}
}
function renderPerformance(report){
  const show=x=>`${x.mean.toFixed(2)} ± ${x.sd.toFixed(2)}`;
  const order=['CAD','LAD','LCX','RCA'];$('performance-grid').innerHTML=order.map(k=>{const r=report.targets[k],m=r.outer_fold_mean_sd;return `<article class="metric-card"><div class="metric-title">${targetNames[k].toUpperCase()}</div><div class="metric-model">Final refit family: ${esc(r.selected_final_model)} · threshold 0.50</div><div class="metric-pairs"><span><b>${show(m.accuracy)}</b><small>Outer CV accuracy · mean ± SD</small></span><span><b>${show(m.precision)}</b><small>Outer CV precision · mean ± SD</small></span><span><b>${show(m.recall_sensitivity)}</b><small>Outer CV recall · mean ± SD</small></span><span><b>${show(m.f1)}</b><small>Outer CV F1 · mean ± SD</small></span><span><b>${show(m.roc_auc)}</b><small>Outer CV ROC-AUC · mean ± SD</small></span><span><b>${show(m.specificity)}</b><small>Outer CV specificity · mean ± SD</small></span></div></article>`}).join('');
  $('method-note').textContent=`${report.validation} Outer-fold scores estimate that inner-CV model-selection procedure; they are not a separate performance estimate for the particular final refit family shown on each card. The displayed family was selected in a separate 5-fold comparison on all 303 records and then refit on all records. ${report.predictor_count} predictors. Threshold 0.50 was fixed in advance. No independent cohort was available.`;
}
function showError(message){$('error-box').textContent=message;$('error-box').classList.remove('hidden')}
function clearError(){$('error-box').classList.add('hidden');$('error-box').textContent=''}

function mountThree(){
  const canvas=$('heart-canvas'),wrap=$('canvas-wrap');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#101b21');
  const camera=new THREE.PerspectiveCamera(39,1,.1,100);camera.position.set(0,0,5.2);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.06;controls.minDistance=3.7;controls.maxDistance=7.6;controls.maxPolarAngle=Math.PI*.78;
  scene.add(new THREE.HemisphereLight(0xbde5dd,0x203039,2.0));const key=new THREE.DirectionalLight(0xffddd0,3);key.position.set(-2,3,5);scene.add(key);const rim=new THREE.DirectionalLight(0x7cd7cb,1.8);rim.position.set(2,1,-2);scene.add(rim);
  const group=new THREE.Group();scene.add(group);
  const torsoMat=new THREE.MeshStandardMaterial({color:0x49636a,roughness:.82,metalness:.04,transparent:true,opacity:.22,side:THREE.DoubleSide});
  const chest=new THREE.Mesh(new THREE.SphereGeometry(1,32,24),torsoMat);chest.scale.set(1.15,1.5,.27);chest.position.set(0,-.02,-.62);group.add(chest);
  for(const x of [-.7,.7]){const shoulder=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),torsoMat);shoulder.scale.set(.62,.42,.28);shoulder.position.set(x,.95,-.58);group.add(shoulder)}
  const neck=new THREE.Mesh(new THREE.CylinderGeometry(.22,.27,.48,20),torsoMat);neck.position.set(0,1.65,-.58);group.add(neck);
  // Original anatomy-informed 3D illustration. Chamber lobes, great vessels, and coronary paths
  // are constructed here; no downloaded mesh or unverified third-party geometry is bundled.
  const myocardium=new THREE.MeshStandardMaterial({color:0x8d4d52,roughness:.58,metalness:.02,emissive:0x210d12,emissiveIntensity:.16});
  const chamber=(name,pos,scale,rot=0,color=0x8d4d52)=>{const m=new THREE.Mesh(new THREE.SphereGeometry(1,40,32),myocardium.clone());m.material.color.setHex(color);m.name=name;m.scale.set(...scale);m.position.set(...pos);m.rotation.z=rot;group.add(m);return m};
  // The anterior right atrium/right ventricle sit on viewer-left (patient-right); the left
  // chambers are viewer-right. The ventricle mass tapers obliquely to an apex.
  chamber('right-ventricle',[-.22,-.10,.16],[.48,.69,.34],-.12,0x95585a);
  chamber('left-ventricle',[.18,-.19,-.03],[.52,.79,.37],.22,0x81474c);
  chamber('right-atrium',[-.31,.48,.045],[.34,.38,.30],-.16,0xa36364);
  chamber('left-atrium',[.27,.47,-.10],[.36,.34,.28],.12,0x905458);
  // Rounded ventricular apex, shifted toward the patient's left (viewer-right).
  const apex=chamber('ventricular-apex',[.17,-.72,.055],[.27,.35,.29],.30,0x81474c);
  // Great vessels, in front/behind the atrial base to preserve their visible origins.
  addStructureTube([[.12,.33,-.02],[.12,.55,-.04],[.15,.78,-.05],[.30,.96,-.06],[.49,1.00,-.08],[.62,.86,-.10],[.62,.61,-.11]],.105,0xb96d68,group);
  addStructureTube([[-.04,.31,.10],[-.03,.52,.20],[-.10,.72,.20],[-.30,.86,.16],[-.50,.85,.12]],.085,0x66899a,group);
  addStructureTube([[-.31,.56,-.02],[-.31,.92,-.03],[-.31,1.17,-.04]],.105,0x718d9a,group);
  addStructureTube([[-.34,-.51,-.12],[-.34,-.77,-.10],[-.32,-1.02,-.08]],.105,0x718d9a,group);
  // Short left-main trunk bifurcates: LAD follows the anterior IV groove to the apex;
  // LCX follows the patient's left AV groove (viewer-right). RCA tracks the right AV groove.
  addStructureTube([[.08,.48,.27],[.18,.43,.34],[.24,.38,.34]],.037,0xe7b2a0,group);
  addTube('RCA',[[-.14,.55,.32],[-.37,.49,.32],[-.60,.31,.29],[-.67,.02,.25],[-.58,-.29,.18],[-.37,-.47,.02],[-.12,-.50,-.22]],colors.neutral,group);
  addTube('LAD',[[.24,.38,.34],[.15,.20,.42],[.08,-.04,.43],[.12,-.33,.37],[.20,-.59,.29],[.22,-.82,.16]],colors.neutral,group);
  addTube('LCX',[[.22,.38,.34],[.43,.46,.26],[.64,.40,.17],[.70,.20,.08],[.66,.00,-.04],[.52,-.13,-.20]],colors.neutral,group);
  // Small diagonal branch illustrates ordinary branching without claiming segment mapping.
  addStructureTube([[.10,.02,.42],[.32,.08,.35],[.48,.12,.25]],.018,0xdca095,group);
  state.scene=scene;state.camera=camera;state.renderer=renderer;state.controls=controls;
  const resize=()=>{const r=wrap.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()};new ResizeObserver(resize).observe(wrap);resize();
  renderer.domElement.addEventListener('pointerdown',onCanvasPick);
  const animate=()=>{requestAnimationFrame(animate);controls.update();scene.updateMatrixWorld(true);updateVesselLabels();renderer.render(scene,camera)};animate();
}
function addTube(key,points,color,group){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,64,.034,10,false),new THREE.MeshStandardMaterial({color,roughness:.32,metalness:.08,emissive:color,emissiveIntensity:.12}));mesh.userData.vessel=key;mesh.name=`artery-${key}`;group.add(mesh);state.arteries[key]=mesh;
  const p=curve.getPointAt(.53);const marker=new THREE.Mesh(new THREE.SphereGeometry(.08,16,12),new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.24}));marker.position.copy(p);marker.userData.vessel=key;group.add(marker);
  const el=document.createElement('button');el.className='canvas-label';el.style.pointerEvents='auto';el.textContent=key;el.addEventListener('click',()=>selectTarget(key));$('canvas-labels').append(el);state.labels[key]={element:el,anchor:marker};
}
function addStructureTube(points,radius,color,group){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const material=new THREE.MeshStandardMaterial({color,roughness:.4,metalness:.02,emissive:color,emissiveIntensity:.06});const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,48,radius,12,false),material);mesh.name='anatomy-structure';group.add(mesh);return mesh}
function updateVesselLabels(){
  const width=state.renderer.domElement.clientWidth,height=state.renderer.domElement.clientHeight;
  for(const {element,anchor} of Object.values(state.labels)){
    const point=anchor.getWorldPosition(new THREE.Vector3()).project(state.camera);
    const visible=point.z>-1&&point.z<1;element.style.display=visible?'block':'none';
    if(visible){element.style.left=`${(point.x*.5+.5)*width}px`;element.style.top=`${(-point.y*.5+.5)*height}px`}
  }
}
function onCanvasPick(event){const r=state.renderer.domElement.getBoundingClientRect();state.pointer.x=((event.clientX-r.left)/r.width)*2-1;state.pointer.y=-((event.clientY-r.top)/r.height)*2+1;state.raycaster.setFromCamera(state.pointer,state.camera);const items=[];state.scene.traverse(o=>{if(o.userData.vessel)items.push(o)});const hit=state.raycaster.intersectObjects(items,false)[0];if(hit?.object?.userData?.vessel)selectTarget(hit.object.userData.vessel)}
init();
