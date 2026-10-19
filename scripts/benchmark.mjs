import {createWorker} from 'tesseract.js';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
import {verify} from '../src/verify.js';
const rows=JSON.parse(await readFile('public/samples/batch-manifest.json','utf8'));
const start=performance.now();
const worker=await createWorker('eng',1,{langPath:resolve('node_modules/@tesseract.js-data/eng/4.0.0'),cacheMethod:'none'});
await worker.setParameters({tessedit_pageseg_mode:'3',preserve_interword_spaces:'1'});
const initMs=performance.now()-start,results=[];
try{
  for(const row of rows){const scans=[];for(const file of row.files){const t=performance.now(),{data}=await worker.recognize(resolve('public/samples',file));scans.push({file,text:data.text,confidence:data.confidence,elapsedMs:Math.round(performance.now()-t)});}
    const result=verify(row,scans);results.push({id:row.id,scans,result});
    console.log(row.id,JSON.stringify({timeMs:scans.reduce((n,s)=>n+s.elapsedMs,0),status:result.status,issues:result.issues,reviews:result.reviews,checks:result.checks.map(c=>[c.key,c.status])}));
    if(row.sample==='mismatch'){assert.equal(result.checks.find(c=>c.key==='abv').status,'issue');assert.equal(result.checks.find(c=>c.key==='warningHeading').status,'issue');assert.equal(result.checks.find(c=>c.key==='warningBody').status,'issue');}
    else {assert.equal(result.issues,0);assert.equal(result.reviews,1,'Only visual typography should remain on clean fixtures');}
  }
  await writeFile('docs/ocr-benchmark.json',JSON.stringify({environment:'Node.js on development Linux container; not a browser benchmark',node:process.version,model:'Tesseract.js 6.0.1 / eng 4.0.0',initMs:Math.round(initMs),results},null,2)+'\n');
  console.log('OCR integration assertions passed. Initialization:',Math.round(initMs),'ms.');
}finally{await worker.terminate();}
