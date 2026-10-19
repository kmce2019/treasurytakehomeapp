/** Pure, deterministic comparison rules. OCR output is evidence, never a legal determination. */
export const RULE_VERSION = '1.0.0';
export const WARNING_BODY = '(1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.';
export const WARNING = `GOVERNMENT WARNING: ${WARNING_BODY}`;
export const FIELD_LABELS = {brand:'Brand name',classType:'Class / type',abv:'Alcohol content',netContents:'Net contents',producer:'Bottler / producer',address:'Producer address',country:'Country of origin'};
export const compact = s => String(s ?? '').replace(/\s+/g,' ').trim();
export const normalize = s => compact(s).normalize('NFKC').replace(/[‘’]/g,"'").replace(/[‐‑–—]/g,'-').toLowerCase();
const tokens = s => normalize(s).replace(/[^\p{L}\p{N}']/gu,' ').split(/\s+/).filter(Boolean);
const phrase = s => tokens(s).join(' ');
export function numericValues(text, kind) {
  const pattern = kind === 'abv' ? /\b(\d+(?:\.\d+)?)\s*%\s*(?:alc(?:ohol)?\.?\s*(?:\/|by)?\s*vol(?:ume)?\.?|abv|(?:by\s+)?vol\.?)\b/gi
    : kind === 'proof' ? /\b(\d+(?:\.\d+)?)\s*proof\b/gi
    : /\b(\d+(?:\.\d+)?)\s*(ml|cl|liters?|litres?|l|fl\.?\s*oz\.?)\b/gi;
  const matches=[...text.matchAll(pattern)];
  if(kind==='abv') for(const m of text.matchAll(/\b(?:ABV|alcohol(?:\s+content)?)\s*:?\s*(\d+(?:\.\d+)?)\s*%/gi)) {
    if(!matches.some(existing=>m.index<existing.index+existing[0].length&&existing.index<m.index+m[0].length))matches.push(m);
  }
  return matches.map(m => ({raw:m[0],value:Number(m[1])*(kind!=='net'?1:/^cl$/i.test(m[2])?10:/^(l|liters?|litres?)$/i.test(m[2])?1000:/^fl/i.test(m[2])?29.5735295625:1)}));
}
export function parseNet(value) {
  const found = numericValues(String(value),'net');
  return found.length === 1 && compact(found[0].raw).replace(/\.$/,'')===compact(value).replace(/\.$/,'') && found[0].value>0 ? found[0].value : null;
}
export function validateApplication(app) {
  const errors=[];
  if(!['spirits','wine','beer'].includes(app.beverage)) errors.push('Choose a beverage type.');
  for(const key of ['brand','classType','netContents','producer','address']) if(!compact(app[key])) errors.push(`${FIELD_LABELS[key]} is required.`);
  for(const key of Object.keys(FIELD_LABELS)) if(String(app[key]??'').length>300) errors.push(`${FIELD_LABELS[key]} must be 300 characters or fewer.`);
  if(compact(app.abv)==='') {if(app.beverage==='spirits') errors.push('Alcohol content is required for spirits.');}
  else if(!/^\d+(\.\d+)?$/.test(String(app.abv)) || Number(app.abv)<0 || Number(app.abv)>100) errors.push('Alcohol content must be a number from 0 to 100.');
  if(parseNet(app.netContents)===null) errors.push('Use a single net contents value, such as 750 mL, 0.75 L, or 12 fl oz.');
  if(typeof app.imported!=='boolean') errors.push('Imported must be true or false.');
  if(app.imported&&!compact(app.country)) errors.push('Country of origin is required for imports.');
  return errors;
}
function textCheck(key, expected, text) {
  const wanted=phrase(expected), hay=phrase(text);
  if(!wanted) return {key,status:'review',expected:'Not supplied',observed:'Not compared',reason:'Supply application data or review applicability.'};
  // Require whole token boundaries; e.g. ACME must not match ACMEVILLE.
  const exact = (` ${hay} `).includes(` ${wanted} `);
  const lines=text.split('\n').map(compact).filter(Boolean);
  let evidence=lines.find(l=>(` ${phrase(l)} `).includes(` ${wanted} `));
  if(exact&&!evidence) evidence=compact(text).slice(0,700);
  const words=new Set(tokens(expected));
  const candidate=lines.map(line=>({line,score:tokens(line).filter(x=>words.has(x)).length/Math.max(words.size,tokens(line).length)})).sort((a,b)=>b.score-a.score)[0];
  return {key,status:exact?'match':'review',expected,observed:evidence || (candidate?.score>=0.3?candidate.line:'Not confidently found'),reason:exact?'Text found; case, whitespace, apostrophe style and punctuation normalized.':'Expected text not confirmed. Check the image for a mismatch, abbreviation, missing panel, or OCR error.'};
}
function numberCheck(key,expected,text) {
  const kind=key==='abv'?'abv':'net', value=kind==='abv'?Number(expected):parseNet(expected);
  const found=numericValues(text,kind);
  const equal=n=>Math.abs(n.value-value)<(kind==='net'?0.5:0.0001);
  const allMatch=found.length>0&&found.every(equal);
  return {key,expected:kind==='abv'?`${expected}% ABV`:expected,observed:found.map(x=>x.raw).join(' / ')||'Not found',status:allMatch?'match':found.length?'issue':'review',reason:allMatch?'Numerically equivalent value found.':found.length?'Detected values differ from the application or conflict with each other.':'No unambiguous value with its unit was recognized.'};
}
export function checkWarning(text) {
  const clean=compact(text), headings=[...clean.matchAll(/government\s+warning\s*:/gi)];
  const heading=headings[0];
  const headingOK=headings.length===1&&heading[0]==='GOVERNMENT WARNING:';
  const body=heading?clean.slice(heading.index+heading[0].length):'';
  // Preserve every word, number and punctuation mark. Only body case and whitespace vary.
  const bodyOK=body.trimStart().toLowerCase().startsWith(WARNING_BODY.toLowerCase());
  return [
    {key:'warningHeading',status:headingOK?'match':headings.length?'issue':'review',expected:'GOVERNMENT WARNING:',observed:headings.map(h=>h[0]).join(' / ')||'Not found',reason:headingOK?'Uppercase heading and colon recognized.':headings.length?'Heading must use uppercase letters and a colon; duplicate headings require review.':'Heading not recognized. Inspect the image or supply the back label.'},
    {key:'warningBody',status:bodyOK?'match':heading?'issue':'review',expected:WARNING_BODY,observed:body.slice(0,WARNING_BODY.length+90)||'Not found',reason:bodyOK?'Exact wording and punctuation found; line wraps and body capitalization ignored.':'Warning wording is missing, altered, or uncertain in OCR. Compare the image with the required statement.'}
  ];
}
export function verify(app, scans, visual={}) {
  const text=scans.map(s=>s.text).join('\n');
  const checks=['brand','classType','producer','address'].map(k=>textCheck(k,app[k],text));
  checks.splice(2,0,compact(app.abv)?numberCheck('abv',app.abv,text):{key:'abv',status:'review',expected:'Not supplied',observed:'Applicability review',reason:'Wine/beer exceptions are not adjudicated by this prototype.'},numberCheck('netContents',app.netContents,text));
  checks.push(app.imported?textCheck('country',app.country,text):{key:'country',status:'na',expected:'Domestic product',observed:'Not compared',reason:'Import country-of-origin comparison not applicable to this application.'});
  const proof=numericValues(text,'proof'), abv=numericValues(text,'abv');
  if(proof.length) checks.push({key:'proof',status:abv.length&&proof.every(p=>abv.every(a=>Math.abs(p.value-a.value*2)<0.001))?'match':'issue',expected:'U.S. proof = 2 × ABV',observed:proof.map(p=>p.raw).join(' / '),reason:'U.S. proof is cross-checked when present; proof alone does not replace an ABV declaration.'});
  checks.push(...checkWarning(text));
  const volume=parseNet(app.netContents), size=volume>3000?3:volume>237?2:1;
  checks.push({key:'typography',status:visual.typography==='yes'?'manual':visual.typography==='no'?'issue':'review',expected:`Bold uppercase heading; nonbold body; separate continuous paragraph; readable contrast; minimum ${size} mm type (physical label).`,observed:visual.typography==='yes'?'Agent confirmed':visual.typography==='no'?'Agent identified a formatting issue':'Agent confirmation needed',reason:'OCR cannot reliably verify font weight or physical print size. Inspect the artwork and dimensions.'});
  const confidence=Math.min(...scans.map(s=>Number(s.confidence)||0));
  if(!text.trim()||confidence<80) {
    // Do not convert questionable recognition into a clean automatic pass.
    for(const c of checks) if(c.status==='match') {c.status='review';c.reason+=' OCR confidence is low; confirm against the image.';}
  }
  checks.push({key:'quality',status:!text.trim()||confidence<80?'review':'match',expected:'Readable text',observed:`${Math.round(Number.isFinite(confidence)?confidence:0)} / 100 OCR confidence`,reason:'Confidence is an OCR heuristic, not a probability of correctness. Inspect small print, glare, and curved text.'});
  const issues=checks.filter(c=>c.status==='issue').length, reviews=checks.filter(c=>c.status==='review').length;
  return {ruleVersion:RULE_VERSION,checks,status:issues?'Discrepancies found':reviews?'Needs review':'Ready for agent',issues,reviews,text,confidence:Number.isFinite(confidence)?confidence:0};
}
