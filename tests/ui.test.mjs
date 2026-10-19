/** DOM-level workflow test; OCR integration is tested separately on real PNGs. */
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {JSDOM} from 'jsdom';import {WARNING} from '../src/verify.js';
const html=await readFile('public/index.html','utf8');
const dom=new JSDOM(html,{url:'https://example.test/'});
const win=dom.window;
Object.assign(globalThis,{window:win,document:win.document,FormData:win.FormData,File:win.File});
win.HTMLElement.prototype.scrollIntoView=()=>{};
win.HTMLCanvasElement.prototype.getContext=()=>({fillRect(){},translate(){},rotate(){},drawImage(){}});
globalThis.createImageBitmap=async()=>({width:1200,height:1050,close(){}});
let serial=0;URL.createObjectURL=()=>`blob:test-${++serial}`;URL.revokeObjectURL=()=>{};
globalThis.fetch=async path=>path.includes('batch-manifest')?{ok:true,json:async()=>JSON.parse(await readFile('public/samples/batch-manifest.json','utf8'))}:{ok:true,blob:async()=>new Blob(['png'])};
const ocrText=`OLD TOM DISTILLERY\nKentucky Straight Bourbon Whiskey\n45% Alc./Vol. (90 Proof)\n750 mL\nBottled by Old Tom Distillery\nFrankfort, Kentucky\n${WARNING}`;
globalThis.Tesseract={createWorker:async()=>({setParameters:async()=>{},recognize:async()=>({data:{text:ocrText,confidence:96}}),terminate:async()=>{}})};
await import('../src/app.js');
const $=id=>document.getElementById(id);
const until=async fn=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw new Error('UI did not settle');};
test('sample → verify → visual review → ready, with source evidence',async()=>{
  document.querySelector('[data-sample=clean]').click();await until(()=>!$('verify').disabled&&$('image-list').children.length===1);
  assert.equal($('application-form').elements.brand.value,'Old Tom Distillery');
  $('verify').click();await until(()=>!$('verify').disabled&&!$('results-section').hidden);
  assert.match($('result-detail').textContent,/Needs review/);assert.match($('result-detail').textContent,/45% Alc/);
  const selector=$('result-detail').querySelector('select');selector.value='yes';selector.dispatchEvent(new win.Event('change'));
  assert.match($('result-detail').textContent,/Ready for agent/);
  const notes=$('result-detail').querySelector('textarea');notes.value='Checked original artwork';notes.dispatchEvent(new win.Event('input'));assert.equal(notes.value,'Checked original artwork');
});
test('tabs and import country field react without losing the form',()=>{
  $('batch-tab').click();assert.equal($('batch-panel').hidden,false);assert.equal($('single-panel').hidden,true);
  $('single-tab').click();const imported=$('application-form').elements.imported;imported.checked=true;imported.dispatchEvent(new win.Event('change'));assert.equal($('country-label').hidden,false);assert.equal($('application-form').elements.country.required,true);
});
test('clear form removes pending images but preserves completed review',()=>{$('reset').click();assert.equal($('image-list').children.length,0);assert.equal($('application-form').elements.brand.value,'');assert.equal($('results-section').hidden,false);});
test('manifest inputs and exports are reachable; no third-party scripts',()=>{
  assert.ok($('manifest-input'));assert.ok($('batch-images'));assert.ok($('export-csv'));assert.ok($('export-json'));
  for(const s of document.querySelectorAll('script[src]'))assert.equal(new URL(s.src).origin,'https://example.test');
});
