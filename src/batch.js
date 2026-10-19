import {validateApplication} from './verify.js';
export const MAX_APPLICATIONS=300, MAX_FILES=600, MAX_FILE_BYTES=12*1024*1024, MAX_TOTAL_BYTES=300*1024*1024;
export function validateFiles(files) {
  if(!files.length) throw new Error('Select at least one label image.');
  if(files.length>MAX_FILES) throw new Error(`Select at most ${MAX_FILES} images.`);
  if(files.reduce((n,f)=>n+f.size,0)>MAX_TOTAL_BYTES) throw new Error('Images exceed the 300 MB batch limit. Split into smaller batches.');
  const names=new Set();
  for(const f of files) {
    if(names.has(f.name)) throw new Error(`Duplicate filename: ${f.name}. Rename images before importing.`);
    names.add(f.name);
    if(!/\.(png|jpe?g|webp)$/i.test(f.name)||!['image/png','image/jpeg','image/webp',''].includes(f.type)) throw new Error(`${f.name}: use PNG, JPEG, or WebP. PDF and HEIC are not supported.`);
    if(f.size>MAX_FILE_BYTES) throw new Error(`${f.name}: maximum image size is 12 MB.`);
    if(!f.size) throw new Error(`${f.name}: file is empty.`);
  }
}
export function parseManifest(raw, files) {
  validateFiles(files);
  let rows;try {rows=JSON.parse(raw);}catch{throw new Error('Manifest must be valid JSON. Download the example to get started.');}
  if(!Array.isArray(rows)||!rows.length||rows.length>MAX_APPLICATIONS) throw new Error('Manifest must be an array of 1–300 applications.');
  const byName=new Map(files.map(f=>[f.name,f])), ids=new Set(), used=new Set();
  const jobs=rows.map((row,index)=>{
    if(!row||typeof row!=='object'||Array.isArray(row)) throw new Error(`Application ${index+1} must be an object.`);
    const id=String(row.id??'').trim();
    if(!id||id.length>100||ids.has(id)) throw new Error(`Application ${index+1}: provide a unique id of 1–100 characters.`);
    ids.add(id);
    const errors=validateApplication(row);
    if(errors.length) throw new Error(`${id}: ${errors.join(' ')}`);
    if(!Array.isArray(row.files)||!row.files.length||row.files.length>6) throw new Error(`${id}: list 1–6 image filenames in files.`);
    const selected=row.files.map(name=>{
      if(typeof name!=='string'||!byName.has(name)) throw new Error(`${id}: image not selected: ${String(name)}`);
      if(used.has(name)) throw new Error(`${id}: ${name} is assigned more than once.`);
      used.add(name);return byName.get(name);
    });
    const {files:_,...application}=row;
    return {id,application,files:selected};
  });
  const unused=files.filter(f=>!used.has(f.name));
  if(unused.length) throw new Error(`Images missing from manifest: ${unused.map(f=>f.name).join(', ')}`);
  return jobs;
}
export function csvCell(value) {
  let s=String(value??'');
  // Avoid spreadsheet formula execution in exported untrusted OCR/application text.
  if(/^[\s]*[=+\-@\t\r]/.test(s)) s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
export function resultsCSV(jobs) {
  const rows=[['Application','Brand','Status','Field','Expected','Observed','Finding','Reason','Reviewer notes']];
  for(const job of jobs) {
    if(!job.result) rows.push([job.id,job.application.brand,job.state,'','','','',job.error||'',job.notes||'']);
    else for(const c of job.result.checks) rows.push([job.id,job.application.brand,job.result.status,c.key,c.expected,c.observed,c.status,c.reason,job.notes||'']);
  }
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
