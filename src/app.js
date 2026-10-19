import {verify, validateApplication, FIELD_LABELS} from './verify.js';
import {parseManifest, validateFiles, resultsCSV} from './batch.js';
import {scanImage, warmup, setProgressHandler} from './ocr.js';
const $=id=>document.getElementById(id);
const form=$('application-form');
const state={images:[],jobs:[],active:0,busy:false,stop:false,mode:'single',loading:false};
const labels={...FIELD_LABELS,warningHeading:'Warning heading',warningBody:'Warning wording',typography:'Warning formatting',quality:'Image readability',proof:'Proof consistency'};
const statusLabels={match:'Match',manual:'Agent checked',issue:'Discrepancy',review:'Review',na:'N/A'};
function el(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function notify(message){$('notice').textContent=message;$('notice').hidden=!message;if(message)$('notice').scrollIntoView({block:'nearest',behavior:'smooth'});}
function engine(message){$('engine-status').textContent=message;}
function readForm(){const data=new FormData(form);return Object.fromEntries([...data.entries()].concat([['imported',form.elements.imported.checked]]));}
function fillForm(app){for(const [key,value] of Object.entries(app)){const input=form.elements.namedItem(key);if(input){if(input.type==='checkbox')input.checked=value;else input.value=value;}}updateConditionalFields();}
function updateConditionalFields(){const imported=form.elements.imported.checked;$('country-label').hidden=!imported;form.elements.country.required=imported;form.elements.abv.required=form.elements.beverage.value==='spirits';}
form.elements.imported.addEventListener('change',updateConditionalFields);form.elements.beverage.addEventListener('change',updateConditionalFields);
function setMode(mode){if(state.busy)return;state.mode=mode;for(const m of ['single','batch']){$(`${m}-panel`).hidden=m!==mode;$(`${m}-tab`).setAttribute('aria-selected',String(m===mode));$(`${m}-tab`).tabIndex=m===mode?0:-1;}}
for(const mode of ['single','batch'])$(`${mode}-tab`).addEventListener('click',()=>setMode(mode));
$('single-tab').parentElement.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();setMode(e.key==='Home'?'single':e.key==='End'?'batch':state.mode==='single'?'batch':'single');$(`${state.mode}-tab`).focus();}});
function setBusy(busy){state.busy=busy;for(const n of document.querySelectorAll('#single-panel input,#single-panel select,#single-panel button,#batch-panel input,#batch-panel button,.tabs button'))n.disabled=busy;document.querySelectorAll('.review-controls input,.review-controls select,.review-controls textarea').forEach(n=>n.disabled=busy);$('progress-panel').hidden=!busy;$('stop').disabled=false;$('stop').textContent='Stop after this application';}
function attachImage(file){return {file,url:URL.createObjectURL(file),rotation:0};}
function clearImages(){for(const item of state.images)URL.revokeObjectURL(item.url);state.images=[];renderImages();}
function showImage(url,name){$('dialog-image').src=url;$('dialog-image').alt=`Label artwork: ${name}`;$('dialog-caption').textContent=name;$('image-dialog').showModal();}
$('close-dialog').addEventListener('click',()=>$('image-dialog').close());
function renderImages(){const list=$('image-list');list.replaceChildren();for(const [index,item] of state.images.entries()){
  const tile=el('div',undefined,'image-tile'),preview=el('button',undefined,'image-preview');preview.type='button';preview.setAttribute('aria-label',`Enlarge ${item.file.name}`);
  const img=el('img');img.src=item.url;img.alt=item.file.name;img.style.transform=`rotate(${item.rotation}deg)`;preview.append(img);preview.onclick=()=>showImage(item.url,item.file.name);
  const info=el('div',undefined,'image-info');info.append(el('strong',item.file.name),el('span',`${(item.file.size/1024).toFixed(0)} KB · ${item.rotation}°`));
  const actions=el('div',undefined,'image-actions');const rotate=el('button','Rotate 90°','secondary'),remove=el('button','Remove','secondary');rotate.type=remove.type='button';
  rotate.onclick=()=>{item.rotation=(item.rotation+90)%360;renderImages();};remove.onclick=()=>{URL.revokeObjectURL(item.url);state.images.splice(index,1);renderImages();};actions.append(rotate,remove);info.append(actions);tile.append(preview,info);list.append(tile);
} }
function startWarmup(){engine('Preparing local OCR…');warmup().then(()=>engine('Local OCR ready')).catch(()=>engine('OCR not ready · retry by verifying'));}
function addFiles(files){if(state.busy)return;try{const combined=[...state.images.map(x=>x.file),...files];validateFiles(combined);if(combined.length>6)throw new Error('A single application supports up to 6 label images.');for(const f of files)state.images.push(attachImage(f));renderImages();notify('');startWarmup();}catch(error){notify(error.message);}}
$('image-input').addEventListener('change',e=>{addFiles([...e.target.files]);e.target.value='';});
$('dropzone').addEventListener('dragover',e=>{e.preventDefault();if(!state.busy)$('dropzone').classList.add('dragging');});
$('dropzone').addEventListener('dragleave',()=>$('dropzone').classList.remove('dragging'));
$('dropzone').addEventListener('drop',e=>{e.preventDefault();$('dropzone').classList.remove('dragging');addFiles([...e.dataTransfer.files]);});
$('reset').onclick=()=>{form.reset();updateConditionalFields();clearImages();notify('');};
async function loadSampleData(){const response=await fetch('./samples/batch-manifest.json');if(!response.ok)throw new Error('Sample manifest could not be loaded.');return response.json();}
async function sampleFile(name){const response=await fetch(`./samples/${encodeURIComponent(name)}`);if(!response.ok)throw new Error('Sample image could not be loaded.');const blob=await response.blob();return new File([blob],name,{type:'image/png'});}
async function loadSample(kind){if(state.busy||state.loading)return;state.loading=true;setBusy(true);$('progress-title').textContent='Loading sample…';try{const rows=await loadSampleData(),row=rows.find(r=>r.sample===kind);const files=await Promise.all(row.files.map(sampleFile));clearImages();form.reset();fillForm(row);state.images=files.map(attachImage);renderImages();notify('');startWarmup();}catch(error){notify(error.message);}finally{state.loading=false;setBusy(false);}}
for(const b of document.querySelectorAll('[data-sample]'))b.onclick=()=>loadSample(b.dataset.sample);
function releaseJobs(){for(const j of state.jobs)for(const u of j.urls||[])URL.revokeObjectURL(u);}
function newJobs(jobs){releaseJobs();state.jobs=jobs.map(j=>({...j,state:'Queued',scans:[],visual:{},notes:'',urls:j.files.map(f=>URL.createObjectURL(f))}));state.active=0;$('queue-filter').value='all';$('results-section').hidden=false;renderQueue();renderResult();}
function badge(status,text){return el('span',text||statusLabels[status]||status,`badge ${status}`);}
function jobStatus(job){return job.result?job.result.status:job.state;}
function jobClass(job){return job.state==='Error'?'error':job.result?.issues?'issue':job.result?.reviews?'review':job.result?'ready':'pending';}
function renderQueue(){const container=$('queue-items');container.replaceChildren();const filter=$('queue-filter').value;let count=0;for(const [i,job] of state.jobs.entries()){
  const type=jobClass(job);if(filter==='attention'&&!['review','issue','error'].includes(type)||filter==='ready'&&type!=='ready'||filter==='pending'&&job.result)continue;
  count++;const button=el('button',undefined,`queue-item ${i===state.active?'active':''}`);button.type='button';button.setAttribute('aria-pressed',String(i===state.active));button.append(el('strong',job.application.brand),el('small',job.id),badge(type,jobStatus(job)));button.onclick=()=>{state.active=i;renderQueue();renderResult();};container.append(button);
}if(!count)container.append(el('p','No applications in this view.','empty-queue'));}
$('queue-filter').onchange=renderQueue;
function renderResult(){const job=state.jobs[state.active],root=$('result-detail');root.replaceChildren();if(!job)return;
  const header=el('div',undefined,'result-summary'),left=el('div');left.append(el('span',job.id,'eyebrow'),el('h3',job.application.brand),el('p',job.files.map(f=>f.name).join(' + ')));if(job.elapsedMs!==undefined)left.append(el('p',`${(job.elapsedMs/1000).toFixed(2)} seconds · ${job.scans.length} image${job.scans.length===1?'':'s'} · includes image preparation and any model initialization`));header.append(left,badge(jobClass(job),jobStatus(job)));root.append(header);
  if(job.error)root.append(el('p',job.error));
  if(job.result){
    const table=el('table',undefined,'finding-table'),head=el('thead'),tr=el('tr');for(const t of ['Check','Application / expected','Label evidence','Finding']){const th=el('th',t);th.scope='col';tr.append(th);}head.append(tr);table.append(head);const body=el('tbody');
    for(const c of job.result.checks){const row=el('tr');row.append(el('td',labels[c.key]||c.key));const expected=el('td',c.expected);expected.dataset.label='Expected';const observed=el('td',c.observed);observed.dataset.label='Observed';observed.append(el('small',c.reason));const finding=el('td');finding.append(badge(c.status));row.append(expected,observed,finding);body.append(row);}table.append(body);root.append(table);
    const controls=el('div',undefined,'review-controls');controls.append(el('h3','Finish the visual review'),el('p','Check the original artwork, including heading/body weight, separation, legibility and physical type size. A scan cannot establish printed dimensions.'));
    const label=el('label','Warning formatting');const select=el('select');select.setAttribute('aria-label','Warning formatting');for(const [value,text] of [['','Not yet reviewed'],['yes','Confirmed — formatting requirements checked'],['no','Issue found — formatting needs correction']]){const option=el('option',text);option.value=value;select.append(option);}select.value=job.visual.typography||'';select.disabled=state.busy;select.onchange=()=>{job.visual.typography=select.value;job.result=verify(job.application,job.scans,job.visual);renderQueue();renderResult();root.querySelector('select')?.focus();};label.append(select);controls.append(label);
    const notesLabel=el('label','Review notes'),notes=el('textarea');notes.value=job.notes;notes.maxLength=4000;notes.placeholder='Record any discrepancy or follow-up needed. Notes are included in exports.';notes.disabled=state.busy;notes.oninput=()=>job.notes=notes.value;notesLabel.append(notes);controls.append(notesLabel,el('p','“Ready for agent” means these prototype checks are complete, not regulatory approval.'));root.append(controls);
    const details=el('details'),summary=el('summary','View original OCR text');details.append(summary);for(const scan of job.scans){details.append(el('h4',`${scan.file} · ${Math.round(scan.confidence)} / 100 confidence`),el('pre',scan.text||'(No text recognized)'));}root.append(details);
  }else if(!job.error)root.append(el('p',job.state==='Queued'?'Waiting for verification.':job.state==='Stopped'?'Stopped before processing. Reload the application or batch to try again.':'Reading label images…','muted'));
  root.append(el('p','Inspect artwork · select an image to enlarge','small muted'));const images=el('div',undefined,'result-images');for(const [i,url] of job.urls.entries()){const b=el('button'),img=el('img');b.type='button';b.setAttribute('aria-label',`Enlarge ${job.files[i].name}`);img.src=url;img.alt=job.files[i].name;b.append(img);b.onclick=()=>showImage(url,job.files[i].name);images.append(b);}root.append(images);
}
setProgressHandler(m=>{if(state.busy){$('progress-detail').textContent=`${m.status}${m.progress!==undefined?' · '+Math.round(m.progress*100)+'%':''}`;$('progress').value=Math.round((m.progress||0)*100);}});
async function runJobs(){
  state.stop=false;setBusy(true);notify('');
  try{for(let i=0;i<state.jobs.length;i++){
    if(state.stop){for(let k=i;k<state.jobs.length;k++)state.jobs[k].state='Stopped';break;}
    const job=state.jobs[i],start=performance.now();job.state='Reading';renderQueue();if(i===state.active)renderResult();
    try{for(let f=0;f<job.files.length;f++){$('progress-title').textContent=`Application ${i+1} of ${state.jobs.length} · image ${f+1} of ${job.files.length}`;job.scans.push(await scanImage(job.files[f],job.rotations?.[f]||0));}job.result=verify(job.application,job.scans,job.visual);job.state='Complete';engine('Local OCR ready');}
    catch(error){job.state='Error';job.error=`Could not verify this application: ${error.message} Use a clear, readable PNG/JPG/WebP and try again.`;}
    job.elapsedMs=Math.round(performance.now()-start);renderQueue();if(i===state.active)renderResult();
  }}finally{setBusy(false);renderQueue();renderResult();$('results-title').focus({preventScroll:true});$('results-section').scrollIntoView({block:'start',behavior:'smooth'});}
}
$('verify').onclick=async()=>{if(state.busy)return;if(!form.reportValidity())return;const application=readForm(),errors=validateApplication(application);if(errors.length){notify(errors.join(' '));return;}if(!state.images.length){notify('Add at least one label image or choose a sample.');return;}newJobs([{id:application.id||'Application 1',application,files:state.images.map(x=>x.file),rotations:state.images.map(x=>x.rotation)}]);await runJobs();};
$('stop').onclick=()=>{state.stop=true;$('stop').disabled=true;$('stop').textContent='Stopping after current application…';};
$('run-batch').onclick=async()=>{if(state.busy)return;try{const file=$('manifest-input').files[0];if(!file)throw new Error('Select your JSON application manifest.');if(file.size>2*1024*1024)throw new Error('Manifest exceeds 2 MB.');const jobs=parseManifest(await file.text(),[...$('batch-images').files]);newJobs(jobs);await runJobs();}catch(error){notify(error.message);}};
$('sample-batch').onclick=async()=>{if(state.busy)return;setBusy(true);$('progress-title').textContent='Loading sample batch…';try{const rows=await loadSampleData(),files=await Promise.all(rows.flatMap(r=>r.files).map(sampleFile));const jobs=parseManifest(JSON.stringify(rows),files);newJobs(jobs);await runJobs();}catch(error){notify(error.message);}finally{setBusy(false);}};
function download(name,contents,type){const url=URL.createObjectURL(new Blob([contents],{type})),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export-csv').onclick=()=>download('label-lens-results.csv',resultsCSV(state.jobs),'text/csv;charset=utf-8');
$('export-json').onclick=()=>download('label-lens-results.json',JSON.stringify({exportedAt:new Date().toISOString(),prototype:'Label Lens',notice:'Decision support, not regulatory approval. OCR confidence is not a probability.',applications:state.jobs.map(({files,urls,...job})=>({...job,filenames:files.map(f=>f.name)}))},null,2),'application/json');
window.addEventListener('beforeunload',e=>{if(state.busy){e.preventDefault();e.returnValue='';}});
updateConditionalFields();
