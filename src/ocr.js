/** All model, WASM, and worker assets are served from the application's own origin. */
let workerPromise=null, activeWorker=null, progress=()=>{};
export function setProgressHandler(fn){progress=fn;}
function timeout(promise,ms,message,onTimeout){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>{onTimeout?.();reject(new Error(message));},ms);})]).finally(()=>clearTimeout(timer));}
export async function warmup(){
  if(!workerPromise) {
    workerPromise=(async()=>{
      if(!globalThis.Tesseract) throw new Error('OCR library could not load. Refresh or check that site assets are allowed by your network.');
      const base=new URL('vendor/',document.baseURI);
      const w=await globalThis.Tesseract.createWorker('eng',1,{
        workerPath:new URL('worker.min.js',base).href,
        corePath:new URL('core/',base).href,
        langPath:new URL('lang/',base).href.replace(/\/$/,''),
        workerBlobURL:false,cacheMethod:'none',
        logger:m=>progress(m),
        errorHandler:()=>{}
      });
      activeWorker=w;
      await w.setParameters({tessedit_pageseg_mode:'3',preserve_interword_spaces:'1'});
      return w;
    })().catch(error=>{workerPromise=null;throw error;});
  }
  return workerPromise;
}
export async function resetOCR(){const w=activeWorker;workerPromise=null;activeWorker=null;if(w) await w.terminate();}
export async function prepareImage(file,rotation=0) {
  const bitmap=await createImageBitmap(file);
  try {
    if(bitmap.width*bitmap.height>40000000) throw new Error('Image exceeds 40 megapixels. Export a smaller image.');
    const scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));
    const width=Math.round(bitmap.width*scale),height=Math.round(bitmap.height*scale),turned=rotation%180!==0;
    const canvas=document.createElement('canvas');canvas.width=turned?height:width;canvas.height=turned?width:height;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(rotation*Math.PI/180);ctx.drawImage(bitmap,-width/2,-height/2,width,height);
    return canvas;
  }finally{bitmap.close();}
}
export async function scanImage(file,rotation=0) {
  const start=performance.now();
  const canvas=await prepareImage(file,rotation);
  const w=await timeout(warmup(),60000,'OCR initialization timed out. Check network access and reload the page.');
  const {data}=await timeout(w.recognize(canvas,{}, {text:true,blocks:false}),45000,'This image took too long to read. Try a cropped, straight-on image.',()=>{void resetOCR();});
  canvas.width=0;canvas.height=0;
  return {file:file.name,text:data.text,confidence:data.confidence,elapsedMs:Math.round(performance.now()-start),rotation};
}
