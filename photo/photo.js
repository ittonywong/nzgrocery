// v1.6.0 photo → food guess. Runs 100% in this browser (onnxruntime-web, MIT; TinyCLIP vision encoder, MIT).
// The photo never leaves the phone: no upload, no API key, no third-party server. Loaded only after the 📷 button is tapped.
(function(){'use strict';
const BASE=new URL('./',document.currentScript?document.currentScript.src:location.href).href; // .../photo/
const MCACHE='nzgrocery-photo-v1'; // separate from the app-shell cache, so a new site version does not re-download 25 MB
let ready=null,session=null,META=null,EMB=null;const stat={bytes:0,fromCache:false,loadMs:0};
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=ok;s.onerror=()=>no(new Error('load '+src));document.head.appendChild(s)})}
async function getBin(url,onProg){let c=null;try{c=await caches.open(MCACHE)}catch(e){}
 if(c){const hit=await c.match(url);if(hit){stat.fromCache=true;const b=await hit.arrayBuffer();onProg&&onProg(b.byteLength);return b}}
 const r=await fetch(url);if(!r.ok)throw new Error('HTTP '+r.status);
 const rd=r.body&&r.body.getReader?r.body.getReader():null;let buf;
 if(rd){const ch=[];let n=0;for(;;){const {done,value}=await rd.read();if(done)break;ch.push(value);n+=value.length;onProg&&onProg(value.length)}
  buf=new Uint8Array(n);let o=0;for(const x of ch){buf.set(x,o);o+=x.length}buf=buf.buffer}
 else{buf=await r.arrayBuffer();onProg&&onProg(buf.byteLength)}
 if(c){try{await c.put(url,new Response(buf.slice(0),{headers:{'Content-Type':'application/octet-stream'}}))}catch(e){}}
 return buf}
function init(onProg){if(ready)return ready;const t0=performance.now();
 ready=(async()=>{
  META=await (await fetch(BASE+'model/labels.json')).json();
  const raw=atob(META.emb);const q=new Int8Array(raw.length);for(let i=0;i<raw.length;i++)q[i]=raw.charCodeAt(i)<<24>>24;
  EMB=[];for(let i=0;i<META.labels.length;i++){const v=new Float32Array(META.dim);let n=0;for(let j=0;j<META.dim;j++){v[j]=q[i*META.dim+j];n+=v[j]*v[j]}n=Math.sqrt(n);for(let j=0;j<META.dim;j++)v[j]/=n;EMB.push(v)}
  let got=0;const WASM='ort/ort-wasm-simd-threaded.wasm';const total=META.bytes+(META.wasmBytes||14239897);const prog=n=>{got+=n;onProg&&onProg(Math.min(1,got/total))};
  const pOrt=window.ort?Promise.resolve():loadScript(BASE+'ort/ort.wasm.min.js');
  const bins=await Promise.all([getBin(BASE+WASM,prog)].concat(META.parts.map(p=>getBin(BASE+'model/'+p,prog))));await pOrt;
  ort.env.wasm.wasmPaths=BASE+'ort/';ort.env.wasm.wasmBinary=bins[0];ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
  const parts=bins.slice(1);
  const all=new Uint8Array(META.bytes);let o=0;for(const p of parts){all.set(new Uint8Array(p),o);o+=p.byteLength}
  if(o!==META.bytes)throw new Error('model size');
  session=await ort.InferenceSession.create(all,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  stat.bytes=META.bytes;stat.loadMs=Math.round(performance.now()-t0);return stat})();
 ready.catch(()=>{ready=null});return ready}
async function toTensor(file){const S=META.size;let bmp;
 try{bmp=await createImageBitmap(file,{imageOrientation:'from-image'})}catch(e){bmp=await new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im);im.onerror=no;im.src=URL.createObjectURL(file)})}
 let w=bmp.width,h=bmp.height,src=bmp;
 // step down by halves first (phone photos are 3000-4000 px) so the small image is not aliased
 while(Math.min(w,h)>S*2){const c=document.createElement('canvas');c.width=Math.round(w/2);c.height=Math.round(h/2);const x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(src,0,0,c.width,c.height);src=c;w=c.width;h=c.height}
 const sc=S/Math.min(w,h),cw=S/sc;const c=document.createElement('canvas');c.width=S;c.height=S;const x=c.getContext('2d',{willReadFrequently:true});x.imageSmoothingQuality='high';
 x.drawImage(src,(w-cw)/2,(h-cw)/2,cw,cw,0,0,S,S);
 const d=x.getImageData(0,0,S,S).data,f=new Float32Array(3*S*S),m=META.mean,sd=META.std;
 for(let i=0;i<S*S;i++)for(let k=0;k<3;k++)f[k*S*S+i]=(d[i*4+k]/255-m[k])/sd[k];
 if(bmp.close)bmp.close();return new ort.Tensor('float32',f,[1,3,S,S])}
async function classify(file,onProg){await init(onProg);const t0=performance.now();
 const out=await session.run({pixel_values:await toTensor(file)});const v=out.emb.data;
 const sc=EMB.map(e=>{let s=0;for(let j=0;j<e.length;j++)s+=e[j]*v[j];return s*META.scale});
 const mx=Math.max(...sc);const ex=sc.map(s=>Math.exp(s-mx));const Z=ex.reduce((a,b)=>a+b,0);
 const top=sc.map((s,i)=>i).sort((a,b)=>sc[b]-sc[a]).slice(0,3).map(i=>Object.assign({p:ex[i]/Z},META.labels[i]));
 return {top,ms:Math.round(performance.now()-t0),stat}}
window.NZGPhoto={init,classify,get stat(){return stat}};
})();
