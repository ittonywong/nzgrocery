'use strict';
// ===== config =====
const PROXY="https://nzgrocery-proxy.ytonywong.workers.dev";
const VERSION="1.2.0 (2026-10-19)";
const CHAIN_NAME={"paknsave":"PAK'nSAVE","new-world":"New World","countdown":"Woolworths","farro":"Farro","other":""};
const SEARCH_CHAINS=["paknsave","new-world","countdown","farro"];
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// ===== i18n =====
let LANG=localStorage.getItem('nzgLang');if(!I18N[LANG])LANG='zh-Hant';
const T=(k,v={})=>(I18N[LANG][k]??I18N['zh-Hant'][k]??k).replace(/\{(\w+)\}/g,(_,x)=>v[x]??'');
const LOC={"zh-Hant":"zh-HK","zh-Hans":"zh-CN","en":"en-NZ","ja":"ja-JP","mi":"en-NZ","ko":"ko-KR"};
const fmtT=iso=>{try{return new Intl.DateTimeFormat(LOC[LANG],{timeZone:'Pacific/Auckland',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))}catch(e){return iso}};
const ago=iso=>{const s=(Date.now()-Date.parse(iso))/1000;const rtf=new Intl.RelativeTimeFormat(LANG==='mi'?'en':LOC[LANG],{numeric:'auto'});
 return s<3600?rtf.format(-Math.max(1,Math.round(s/60)),'minute'):s<86400*2?rtf.format(-Math.round(s/3600),'hour'):rtf.format(-Math.round(s/86400),'day')};
const money=c=>'$'+(c/100).toFixed(2);
const kmS=d=>(d<10?d.toFixed(1):Math.round(d))+' km';
// ===== font size (rem) =====
const FS=[87.5,100,112.5,125,150];let fsi=+localStorage.getItem('nzgFs');if(!(fsi>=0&&fsi<FS.length))fsi=1;
function applyFs(){document.documentElement.style.fontSize=FS[fsi]+'%';localStorage.setItem('nzgFs',fsi)}
$('#fDown').onclick=()=>{if(fsi>0)fsi--;applyFs()};$('#fUp').onclick=()=>{if(fsi<FS.length-1)fsi++;applyFs()};$('#fReset').onclick=()=>{fsi=1;applyFs()};applyFs();
// ===== state =====
let DATA=null,PLACES=null,here=null,hereLabel='',radius=+localStorage.getItem('nzgRadius')||10,filter='all',sortMode='price';
const LK='nzgList';let list=[];try{list=JSON.parse(localStorage.getItem(LK)||'[]')}catch(e){list=[]}
const saveList=()=>localStorage.setItem(LK,JSON.stringify(list));
const toast=m=>{const t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(toast.h);toast.h=setTimeout(()=>t.style.display='none',2200)};
// ===== geo (all on the phone) =====
function hv(a,b,c,d){const p=Math.PI/180,x=Math.sin((c-a)*p/2)**2+Math.cos(a*p)*Math.cos(c*p)*Math.sin((d-b)*p/2)**2;return 12742*Math.asin(Math.sqrt(x))}
function nearby(){if(!here||!DATA)return[];return DATA.stores.map(s=>({...s,d:hv(here[0],here[1],s.lat,s.lng)})).filter(s=>s.d<=radius).sort((a,b)=>a.d-b.d)}
// Price "slots" near the user: one per per-store priced branch, one per chain-wide/zone price (with its nearest branch)
function priceSlots(){const ns=nearby(),slots=[],zone={};
 for(const s of ns){if(s.kind==='priced')slots.push({key:'b'+s.priceLoc,chain:s.chain,loc:s.priceLoc,label:s.name,d:s.d,store:s});
  else if(s.kind==='zone'&&!zone[s.chain]){zone[s.chain]=1;slots.push({key:'z'+s.chain,chain:s.chain,loc:s.priceLoc,zone:true,label:T('zoneRow',{chain:CHAIN_NAME[s.chain]}),d:s.d,store:s})}}
 return slots}
// ===== proxy (never receives the location) =====
async function api(path,params){const u=new URL(PROXY+path);for(const[k,v]of Object.entries(params))u.searchParams.set(k,v);
 const r=await fetch(u,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer'});
 if(r.status===429||r.status===503)throw new Error(T('errBusy'));
 if(!r.ok)throw new Error('HTTP '+r.status);
 return{json:await r.json(),fetchedAt:r.headers.get('X-Fetched-At'),cache:r.headers.get('X-Cache')}}
// ===== links =====
function productUrl(p){const sku=String(p.sku||'');
 if(p.chain==='paknsave')return'https://www.paknsave.co.nz/shop/product/'+encodeURIComponent(sku.toLowerCase().replace(/-/g,'_'))+'pns';
 if(p.chain==='new-world')return'https://www.newworld.co.nz/shop/product/'+encodeURIComponent(sku.toLowerCase().replace(/-/g,'_'))+'nw';
 if(p.chain==='countdown')return'https://www.woolworths.co.nz/shop/productdetails?stockcode='+encodeURIComponent(sku);
 return'https://www.farro.co.nz/'}
const gmap=s=>'https://www.google.com/maps/dir/?api=1&destination='+s.lat+','+s.lng;
const amap=s=>'https://maps.apple.com/?daddr='+s.lat+','+s.lng;
// ===== UI: language =====
const langSel=$('#lang');langSel.innerHTML=LANGS.map(([k,v])=>'<option value="'+k+'"'+(k==='mi'?' lang="mi"':'')+'>'+v+'</option>').join('');
function applyLang(){document.documentElement.lang=LANG;langSel.value=LANG;document.title=T('title');
 document.querySelectorAll('[data-tr]').forEach(e=>e.textContent=T(e.dataset.tr));
 document.querySelectorAll('[data-ip]').forEach(e=>e.placeholder=T(e.dataset.ip));
 document.querySelectorAll('[data-ar]').forEach(e=>e.setAttribute('aria-label',T(e.dataset.ar)));
 RADII.forEach(r=>$('#r'+r).textContent=T('kmShort',{n:r}));pickRender();
 $('#ver').textContent='v'+VERSION+(DATA?' · OSM '+DATA.osmTimestamp.slice(0,10):'');
 renderAll()}
langSel.onchange=()=>{LANG=langSel.value;localStorage.setItem('nzgLang',LANG);applyLang()};
// ===== tabs =====
const TABS=['stores','search','list'];
function showTab(t){for(const x of TABS){$('#tb-'+x).setAttribute('aria-selected',x===t);$('#v-'+x).hidden=x!==t}if(t==='list')renderList()}
TABS.forEach(t=>$('#tb-'+t).onclick=()=>showTab(t));
// ===== location =====
// Round 3: two ways to set the centre — (a) GPS, only after the user agrees in our own consent box AND the browser prompt;
// (b) manual City > Area > Place (official LINZ suburb/locality centroids from data/places.json). Everything is computed on
// the phone: the position and the chosen place never leave it (price queries send the whole city's branch list).
const RADII=[5,10,20,30];if(!RADII.includes(radius))radius=10;
let sel={city:'',area:'',place:''},mode='',gpsNear=null;try{const o=JSON.parse(localStorage.getItem('nzgLoc')||'{}');if(o&&typeof o==='object')sel={city:o.city||'',area:o.area||'',place:o.place||''}}catch(e){}
const saveSel=()=>localStorage.setItem('nzgLoc',JSON.stringify(sel)); // names only, never GPS coordinates
const isZh=()=>LANG.startsWith('zh');
const zhName=o=>!o?'':LANG==='zh-Hant'&&o.zh?o.zh+' '+o.name:LANG==='zh-Hans'&&o.zhs?o.zhs+' '+o.name:o.name; // English (official) names + Chinese labels for city/area
const cityOf=id=>PLACES&&PLACES.cities.find(c=>c.id===id)||null;
const areaOf=(c,id)=>c&&c.areas.find(a=>a.id===id)||null;
const placeOf=(a,n)=>a&&a.places.find(p=>p[0]===n)||null;
function curCity(){return cityOf(sel.city)}
function LOCIDS(){const c=curCity();return c?c.chainLocIds:(DATA?DATA.chainLocIds:{})}
function setRadius(r){radius=r;localStorage.setItem('nzgRadius',r);RADII.forEach(x=>$('#r'+x).setAttribute('aria-pressed',x===r));renderAll()}
RADII.forEach(r=>$('#r'+r).onclick=()=>setRadius(r));
function setPlace(cid,aid,pname,fromGps){const c=cityOf(cid),a=areaOf(c,aid),p=placeOf(a,pname);
 sel={city:c?cid:'',area:a?aid:'',place:p?pname:''};saveSel();
 if(!fromGps){mode=p?'place':'';gpsNear=null;here=p?[p[1],p[2]]:null;hereLabel=p?pname:''}
 if(view.run&&view.run.q&&here&&!view.run.key.startsWith((sel.city||'akl')+'|')){const q=view.run.q;setTimeout(()=>openRun(q),0)} // re-run the search with the new city's branch list
 renderAll()}
// --- picker (accessible list of buttons; shown inline so it works with screen readers, zoom and small screens) ---
let pickKind='';
function openPick(kind){pickKind=kind;$('#pick').hidden=false;['City','Area','Place'].forEach(k=>$('#c'+k).setAttribute('aria-expanded',k.toLowerCase()===kind));
 const f=$('#pickF');f.value='';pickRender();(kind==='place'&&!f.hidden?f:($('#pickL button[aria-current=true]')||$('#pickL button')||$('#pickX'))).focus()}
function closePick(back){const k=pickKind;pickKind='';$('#pick').hidden=true;['City','Area','Place'].forEach(x=>$('#c'+x).setAttribute('aria-expanded','false'));if(back&&k)$('#c'+k[0].toUpperCase()+k.slice(1)).focus()}
$('#pickX').onclick=()=>closePick(true);$('#pick').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closePick(true)}});
$('#cCity').onclick=()=>pickKind==='city'?closePick():openPick('city');$('#cArea').onclick=()=>pickKind==='area'?closePick():openPick('area');$('#cPlace').onclick=()=>pickKind==='place'?closePick():openPick('place');
$('#pickF').oninput=()=>pickRender();
const fold=x=>x.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\bmount\b/g,'mt');
function crumb(k,lbl,val){$('#c'+k).innerHTML='<span class="k">'+esc(T(lbl))+'</span><span class="v'+(val?'':' none')+'">'+esc(val||T('pickNone'))+'</span>'}
function pickRender(){if(!PLACES)return;const c=curCity(),a=areaOf(c,sel.area);
 crumb('City','pCity',zhName(c));crumb('Area','pArea',zhName(a));crumb('Place','pPlace',sel.place);
 $('#cArea').disabled=!c;$('#cPlace').disabled=!a;
 if(!pickKind)return;const L=$('#pickL'),F=$('#pickF'),N=$('#pickN');let items=[];
 if(pickKind==='city'){$('#pickT').textContent=T('pickCity');F.hidden=true;N.hidden=true;
  items=PLACES.cities.map(x=>({v:x.id,t:zhName(x),c:T('nStores',{n:x.stores}),cur:x.id===sel.city}))}
 else if(pickKind==='area'){$('#pickT').textContent=T('pickArea')+' · '+zhName(c);F.hidden=true;N.hidden=true;
  items=c.areas.map(x=>({v:x.id,t:zhName(x),c:T('nPlaces',{n:x.places.length})+' · '+T('nStores',{n:x.stores}),cur:x.id===sel.area}))}
 else{$('#pickT').textContent=T('pickPlace')+' · '+zhName(a);F.hidden=a.places.length<10;N.hidden=false;N.textContent=T('placeLabel');
  const q=fold(F.value.trim());items=a.places.filter(p=>!q||fold(p[0]).includes(q)||(p[3]&&fold(p[3]).includes(q)))
   .map(p=>({v:p[0],t:p[0],alt:q&&p[3]&&!fold(p[0]).includes(q)?p[3]:'',cur:p[0]===sel.place}))}
 L.innerHTML=items.length?items.map(x=>'<li><button type="button" data-v="'+esc(x.v)+'"'+(x.cur?' aria-current="true"':'')+'><span>'+esc(x.t)+(x.alt?'<span class="alt">'+esc(x.alt)+'</span>':'')+'</span>'+(x.c?'<span class="c">'+esc(x.c)+'</span>':'')+'</button></li>').join('')
  :'<li class="mut small" style="padding:.5rem">'+esc(T('noPlaceMatch'))+'</li>';
 L.querySelectorAll('button[data-v]').forEach(b=>b.onclick=()=>{const v=b.dataset.v;
  if(pickKind==='city'){if(v!==sel.city){const cc=cityOf(v);setPlace(v,cc.areas.length===1?cc.areas[0].id:'','')}else renderAll();
   openPick(curCity().areas.length===1?'place':'area')}
  else if(pickKind==='area'){if(v!==sel.area)setPlace(sel.city,v,'');openPick('place')}
  else{setPlace(sel.city,sel.area,v);closePick();$('#cPlace').focus()}})}
// --- GPS: our consent box first, then the browser's own permission prompt ---
$('#locBtn').onclick=()=>{const g=$('#gpsAsk');g.hidden=!g.hidden;$('#locBtn').setAttribute('aria-expanded',!g.hidden);if(!g.hidden)$('#gpsOk').focus()};
$('#gpsNo').onclick=()=>{$('#gpsAsk').hidden=true;$('#locBtn').setAttribute('aria-expanded','false');$('#locSt').textContent=T('gpsCancelled');$('#locBtn').focus()};
$('#gpsOk').onclick=()=>{$('#gpsAsk').hidden=true;$('#locBtn').setAttribute('aria-expanded','false');
 if(!navigator.geolocation){$('#locSt').textContent=T('locDenied',{msg:'n/a'});return}
 $('#locSt').textContent=T('locAsking');
 navigator.geolocation.getCurrentPosition(p=>{here=[p.coords.latitude,p.coords.longitude];hereLabel='gps';mode='gps';gpsNear=nearestPlace(here);closePick();
   if(gpsNear)setPlace(gpsNear.c.id,gpsNear.a.id,gpsNear.p[0],true);else{sel={city:'',area:'',place:''};renderAll()}},
  e=>{$('#locSt').innerHTML='<span class="err">'+esc(T('locDenied',{msg:e.message||e.code}))+'</span>'},{enableHighAccuracy:false,timeout:15000,maximumAge:0})};
// nearest official place centroid (within 15 km) gives the GPS position a city/area/place label — all on the phone
function nearestPlace(pt){let best=null;if(!PLACES)return null;for(const c of PLACES.cities)for(const a of c.areas)for(const p of a.places){const d=hv(pt[0],pt[1],p[1],p[2]);if(!best||d<best.d)best={c,a,p,d}}
 return best&&best.d<=15?best:null}
function renderLoc(){const st=$('#locSt');if(!here){st.textContent=T('locNone');return}
 const ns=nearby();const p=ns.filter(s=>s.kind==='priced'||s.kind==='zone').length;const c=curCity(),a=areaOf(c,sel.area);
 let h;if(mode==='gps')h=gpsNear?T('centreGps',{place:sel.place,area:zhName(a),city:zhName(c)}):T('locHere');
 else h=T('centreFrom',{place:sel.place,area:zhName(a),city:zhName(c)});
 h=esc(h)+' · '+esc(T('foundR',{r:radius,n:ns.length,p}));
 if(mode==='gps'&&!gpsNear)h+='<br><span class="err">'+esc(T('outsideCov',{cities:PLACES.cities.map(zhName).join('、')}))+'</span>';
 else if(c&&c.id!=='akl')h+='<br><span class="mut">'+esc(T('cityNote',{city:zhName(c)}))+'</span>';
 st.innerHTML=h}
function storeRegion(s){if(!PLACES||!s.city)return'';const c=cityOf(s.city);if(s.outside||!s.suburb)return T('outsideBoundary',{city:zhName(c)});
 return zhName(areaOf(c,s.area))+' · '+s.suburb}
// ===== stores tab =====
const FILTERS=[['all','fAll'],['priced','fPriced'],['cn','fCn'],['ko','fKo'],['other','fOther']];
function renderStores(){
 $('#chips').innerHTML=FILTERS.map(([k,l])=>'<button data-f="'+k+'" aria-pressed="'+(filter===k)+'">'+esc(T(l))+'</button>').join('');
 $('#chips').querySelectorAll('button').forEach(b=>b.onclick=()=>{filter=b.dataset.f;renderStores()});
 const box=$('#storeList');if(!here){box.innerHTML='<p class="panel">'+esc(T('needLoc'))+'</p>';return}
 const ns=nearby().filter(s=>filter==='all'||(filter==='priced'?(s.kind==='priced'||s.kind==='zone'):filter==='other'?(s.kind==='other'||s.kind==='noprice'):s.kind===filter));
 box.innerHTML=ns.map(s=>{const k={priced:['','kPriced'],zone:['','kZone'],cn:['cn','kCn'],ko:['ko','kKo'],other:['o','kOther'],noprice:['o','kNoprice']}[s.kind];
  const nm=s.nameZh&&LANG.startsWith('zh')&&!s.name.includes(s.nameZh)?s.nameZh+' '+s.name:s.name;
  return '<article class="card" data-kind="'+s.kind+'" data-id="'+esc(s.id)+'"><span class="dist">'+kmS(s.d)+'</span><h3>'+esc(nm)+'</h3>'+'<div class="rg">'+esc(storeRegion(s))+'</div>'+(s.addr?'<div class="mut small">'+esc(s.addr)+'</div>':'')+
  '<span class="badge '+k[0]+'">'+esc(T(k[1]))+'</span><div class="links">'+(s.web?'<a href="'+esc(s.web)+'" target="_blank" rel="noopener">'+esc(T('web'))+' ↗</a>':'')+
  '<a href="'+gmap(s)+'" target="_blank" rel="noopener">'+esc(T('nav'))+'</a><a href="'+amap(s)+'" target="_blank" rel="noopener">'+esc(T('apple'))+'</a></div></article>'}).join('');
}
// ===== search (round 2: 6-language terms, fan-out + paging, brand/type/variety grouping, live suggestions) =====
// Baskt "q" = substring match on product name, A–Z, max 100 per call. The engine (search.js) maps the user's words to
// English, plans a few Baskt queries per chain, filters whole words on the phone, then groups the results.
const LIMIT=100;
const RC=new Map(); // client cache: url -> {at, data}  (30 min) — repeat keystrokes/searches cost 0 requests
const INFL=new Map(); // in-flight: url -> {p, ctl, refs}  (same request never sent twice at once)
const NET={sent:0,cached:0,aborted:0,log:[]}; // exposed for tests
function reqUrl(path,params){const u=new URL(PROXY+path);for(const[k,v]of Object.entries(params))u.searchParams.set(k,v);return u.toString()}
function getJSON(url,run){const c=RC.get(url);if(c&&Date.now()-c.at<1800000){NET.cached++;return Promise.resolve(c.data)}
 let f=INFL.get(url);
 if(!f){const ctl=new AbortController();NET.sent++;NET.log.push(url);
  f={ctl,refs:0,p:fetch(url,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',signal:ctl.signal}).then(async r=>{
    if(r.status===429||r.status===503)throw new Error(T('errBusy'));if(!r.ok)throw new Error('HTTP '+r.status);
    const data={json:await r.json(),fetchedAt:r.headers.get('X-Fetched-At'),cache:r.headers.get('X-Cache')};RC.set(url,{at:Date.now(),data});return data}).finally(()=>INFL.delete(url))};
  INFL.set(url,f)}
 f.refs++;run.reqs.add(url);return f.p}
function releaseRun(run){for(const u of run.reqs){const f=INFL.get(u);if(f&&--f.refs<=0){f.ctl.abort();INFL.delete(u);NET.aborted++}}run.reqs.clear()}
const RUNS=new Map(); // plan.key -> run (shared by suggestions and full results)
function startRun(pl){const key=(sel.city||'akl')+'|'+pl.key;let run=RUNS.get(key);if(run&&!run.cancelled)return run;
 run={pl,key,loc:LOCIDS(),items:new Map(),prices:{},total:0,done:0,errs:[],fetchedAt:null,reqs:new Set(),more:{},subs:new Set(),cancelled:false,finished:false};RUNS.set(key,run);
 run.promise=execRun(run);return run}
function cancelRun(run){if(!run||run.finished)return;run.cancelled=true;releaseRun(run);RUNS.delete(run.key)}
function ingestRun(run,chain,json,words,size){const d=json.data||{};const locSet=new Set(run.loc[chain]||[]);const got=[];
 for(const it of d.items||[]){if(!NZS.matches(it,words,size))continue;got.push(it);if(!run.items.has(it.id))run.items.set(it.id,{...it,chain:it.chain||chain})}
 for(const p of d.latestPrices||[]){if(!run.items.has(p.itemId)||!locSet.has(String(p.locationId)))continue;(run.prices[p.itemId]||(run.prices[p.itemId]={}))[p.locationId]=
  {c:p.priceCents,u:p.unitPriceCents,um:p.unitMeasure,promo:p.promoFlag?(p.promoLabel||1):0,obs:p.observedAt,reg:p.regularPriceCents}}
 return got}
async function q1(run,chain,q,offset){if(run.cancelled)return null;const params={q,chain,locationId:run.loc[chain].join(','),limit:LIMIT};if(offset)params.offset=offset;
 run.total++;notify(run);
 try{const r=await getJSON(reqUrl('/api/v1/items',params),run);if(run.cancelled)return null;
  if(r.fetchedAt&&(!run.fetchedAt||r.fetchedAt<run.fetchedAt))run.fetchedAt=r.fetchedAt;return r.json}
 catch(e){if(!run.cancelled&&e.name!=='AbortError')run.errs.push(e.message);return null}
 finally{run.done++;notify(run)}}
async function execRun(run){const pl=run.pl;const chains=SEARCH_CHAINS.filter(c=>run.loc[c]);
 const extra=pl.extra.map(x=>NZS.resolve(x,'en')).filter(Boolean);
 // wave 1: the phrase (+ size) per chain, the concept's extra phrases, and for 2+ words the main word
 const w1=[];for(const c of chains){const seen=new Set();const add=(q,words,size,tag)=>{if(!q||q.length<2||seen.has(q))return;seen.add(q);w1.push({c,q,words,size,tag})};
  add(NZS.chainQ(c,pl.phrase,pl.size),pl.words,pl.size,'main');
  for(const x of extra)add(NZS.chainQ(c,x.words.join(' '),x.size),x.words,x.size,'extra');
  if(pl.anchor)add(pl.anchor,pl.words,pl.size,'anchor')}
 const res1=await Promise.all(w1.map(async t=>{const j=await q1(run,t.c,t.q);if(!j)return{t,j};const got=ingestRun(run,t.c,j,t.words,t.size);return{t,j,got}}));
 if(run.cancelled)return;
 // wave 2 (single word, no size): data-driven paging. Page 2 only when page 1 was mostly real matches (≥50 %; "tea" also
 // matches "steak", so paging that is wasteful); the plural ("apples") only when the plural really appears in page-1 names.
 const w2=[];if(pl.words.length===1&&!pl.size){const w=pl.words[0],pw=NZS.plural(w);
  const mains=res1.filter(r=>r.t.tag==='main'&&r.j);
  const pluralSeen=pw!==w&&mains.some(r=>(r.j.data.items||[]).some(it=>(' '+NZS.norm(it.name)+' ').includes(' '+pw+' ')));
  for(const r of mains){const pg=r.j.data.pagination||{};if(!pg.hasMore)continue;const n=(r.j.data.items||[]).length||1;
   if(r.got.length/n>=0.5)w2.push({c:r.t.c,q:r.t.q,off:pg.nextOffset,words:pl.words});else run.more[r.t.c]={q:r.t.q,off:pg.nextOffset};
   if(pluralSeen)w2.push({c:r.t.c,q:pw,off:0,words:pl.words})}}
 else{for(const r of res1)if(r.t.tag==='main'&&r.j&&(r.j.data.pagination||{}).hasMore)run.more[r.t.c]={q:r.t.q,off:r.j.data.pagination.nextOffset}}
 await Promise.all(w2.map(async t=>{const j=await q1(run,t.c,t.q,t.off);if(!j)return;ingestRun(run,t.c,j,t.words,null);
  const pg=j.data.pagination||{};if(t.off&&pg.hasMore)run.more[t.c]={q:t.q,off:pg.nextOffset}}));
 if(run.cancelled)return;run.finished=true;notify(run)}
async function loadMore(run){const ms=Object.entries(run.more);run.more={};run.finished=false;notify(run);
 await Promise.all(ms.map(async([c,m])=>{const j=await q1(run,c,m.q,m.off);if(!j)return;ingestRun(run,c,j,run.pl.words,run.pl.size);const pg=j.data.pagination||{};if(pg.hasMore)run.more[c]={q:m.q,off:pg.nextOffset}}));
 run.finished=true;notify(run)}
function notify(run){for(const f of run.subs)try{f(run)}catch(e){console.error(e)}}
// ---- grouping for display (needs location: only prices at nearby stores count) ----
function unitOf(o,p){const n=NZS.unitNorm(o.u,o.um);if(n)return{...n,calc:false};
 const m=String(p.size||'').match(/^(\d+(?:\.\d+)?)(kg|g|l|ml)$/);if(!m)return null;const q=+m[1]*({kg:1,g:.001,l:1,ml:.001}[m[2]]);if(!q)return null;
 return{u:/g$/.test(m[2])?'kg':'L',c:Math.round(o.c/q),calc:true}}
function groupRun(run){const slots=priceSlots();const prods=NZS.build([...run.items.values()],run.prices,run.pl.words);const out=[];
 for(const p of prods){const of=[];for(const it of p.items)for(const s of slots){if(s.chain!==it.chain)continue;const pr=it.prices[s.loc];if(pr)of.push({...pr,slot:s,item:it})}
  if(!of.length)continue;of.sort((a,b)=>a.c-b.c);p.of=of;p.best=of[0];p.unit=unitOf(of[0],p);
  const byU=of.map(o=>({o,u:unitOf(o,p)})).filter(x=>x.u).sort((a,b)=>a.u.c-b.u.c);p.bestU=byU[0]||null;out.push(p)}
 const sk=p=>sortMode==='unit'&&p.bestU?p.bestU.u.c:p.best.c;
 out.sort((a,b)=>sk(a)-sk(b));
 const types=new Map();for(const p of out){let t=types.get(p.type);if(!t)types.set(p.type,t={type:p.type,prods:[],subs:new Map()});t.prods.push(p);
  let g=t.subs.get(p.sub.key);if(!g)t.subs.set(p.sub.key,g={key:p.sub.key,label:p.sub.label,prods:[]});g.prods.push(p)}
 const tl=[...types.values()].sort((a,b)=>b.prods.length-a.prods.length||NZS.TYPES.indexOf(a.type)-NZS.TYPES.indexOf(b.type));
 for(const t of tl){const subs=[...t.subs.values()].sort((a,b)=>sk(a.prods[0])-sk(b.prods[0]));
  const multi=subs.filter(g=>g.prods.length>1),single=subs.filter(g=>g.prods.length===1);
  t.groups=subs.length>=4&&single.length>1&&t.type!=='fruit'&&t.type!=='veg'?[...multi,{key:'_other',label:'',other:true,prods:single.flatMap(g=>g.prods).sort((a,b)=>sk(a)-sk(b))}]:subs}
 return{prods:out,types:tl,ownType:prods.ownType}}
// ---- display helpers ----
const ICON={fruit:'M12 7c-3-2-7 0-7 5s3 9 5 9c1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 5-4 5-9s-4-7-7-5zm0 0c0-2 1-4 3-5',veg:'M7 21l10-10M14 4c3 0 6 3 6 6l-6 6-6-6c0-3 3-6 6-6z',
 drinks:'M7 3h10l-1.5 18h-7zM7 8h10',tea:'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3',coffee:'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h2a2 2 0 0 1 0 4h-2',
 milk:'M8 3h8v3l2 3v12H6V9l2-3zM6 12h12',bakery:'M3 15c0-5 4-8 9-8s9 3 9 8zM3 15h18v3H3z',sauces:'M10 3h4v4l3 3v11H7V10l3-3z',other:'M4 8h16l-1.5 12h-13zM8 8a4 4 0 0 1 8 0'};
const icon=t=>{const d=ICON[t]||ICON[{dairy:'milk',frozen:'milk',sweets:'other',snacks:'other',cereal:'other',pantry:'sauces',alcohol:'drinks',baby:'milk',health:'sauces',nonfood:'other',meat:'other',meals:'bakery'}[t]]||ICON.other;
 return '<span class="thumb" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="'+d+'"/></svg></span>'};
function hl(text,words){let s=esc(text);const forms=[...new Set(words.flatMap(w=>[...NZS.wordForms(w)]))].sort((a,b)=>b.length-a.length).map(f=>f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 if(!forms.length)return s;return s.replace(new RegExp('(^|[^A-Za-z])('+forms.join('|')+')(?![A-Za-z])','gi'),'$1<b>$2</b>')}
const uLbl=u=>u.u==='kg'?T('perkg'):u.u==='L'?T('perL'):u.u==='ea'?T('perea'):'/'+u.u;
const unitTxt=u=>u?T('uFmt',{p:money(u.c),u:uLbl(u)})+(u.calc?' ('+T('unitCalc')+')':''):'';
const brandHtml=p=>p.brand?'<span class="brand">'+esc(p.brand)+'</span>'+(p.brandSrc==='inferred'?' <span class="mut small">('+esc(T('brandInferred'))+')</span>':''):'<span class="brand nob">'+esc(T(p.brandSrc==='unknown'?'brandInName':'noBrand'))+'</span>';
const shortName=p=>p.name.replace(/\s*\((\d[^)]*|kg|ea|each|\d+pk)\)\s*$/i,'');
const nameHasSize=p=>{const z=sizeTxt(p);return !z||NZS.norm(p.name).replace(/\s+/g,'').includes(z.replace(/\s+/g,''))};
const sizeTxt=p=>p.size==='kg'?'kg':p.size==='ea'?'':p.size;
const chainsOf=p=>[...new Set(p.of.map(o=>o.slot.chain))].map(c=>CHAIN_NAME[c]).join(' · ');
const typeName=t=>T('t_'+t);
function prodCard(p,open,words){const show=open?p.of:p.of.slice(0,1);const id=esc(p.key);
 return '<article class="card prod" data-key="'+id+'" data-type="'+p.type+'" data-cents="'+p.best.c+'">'+
 '<div class="ph">'+icon(p.type)+'<div class="pn"><div class="bl">'+brandHtml(p)+'</div><h3>'+hl(p.name,words)+'</h3>'+
 '<div class="mut small">'+esc([sizeTxt(p),p.sub.organic?T('organic'):''].filter(Boolean).join(' · '))+(sizeTxt(p)?' · ':'')+esc(T('chainsCarry',{list:chainsOf(p)}))+'</div></div>'+
 '<div class="pb"><div class="price">'+money(p.best.c)+'</div>'+(p.unit?'<div class="unitp">'+esc(unitTxt(p.unit))+'</div>':'')+'</div></div>'+
 show.map((o,j)=>offerHtml(o.item,o,j===0)).join('')+
 '<div class="row acts">'+(p.of.length>1?'<button class="sec more" data-key="'+id+'" aria-expanded="'+(!!open)+'">'+esc(open?T('showLess'):T('showAll',{n:p.of.length}))+'</button>':'')+
 '<button class="pri add" data-key="'+id+'">'+esc(T('add'))+'</button></div><div class="chooserBox"></div></article>'}
// ---- search UI state ----
let view={run:null,type:'all',cmp:null,shown:{}};const openCards=new Set();
function bindCards(box,G){box.querySelectorAll('.more').forEach(b=>b.onclick=()=>{const k=b.dataset.key;openCards.has(k)?openCards.delete(k):openCards.add(k);renderResults()});
 box.querySelectorAll('.add').forEach(b=>b.onclick=()=>{const p=G.prods.find(x=>x.key===b.dataset.key);if(p)addFlow(p,b)});
 [...box.querySelectorAll('[data-cat]'),...document.querySelectorAll('#cats [data-cat]')].forEach(b=>b.onclick=()=>{view.type=b.dataset.cat;renderResults();$('#cats').scrollIntoView({block:'nearest'})});
 box.querySelectorAll('[data-showmore]').forEach(b=>b.onclick=()=>{view.shown[b.dataset.showmore]=(view.shown[b.dataset.showmore]||40)+40;renderResults()})}
function statusLine(run,G){const pl=run.pl;let h='';
 if(run.errs.length)h+='<div class="err">'+esc(T('partialErr',{n:run.errs.length}))+'</div>';
 if(!run.finished)h+='<div class="loading" aria-busy="true"><span class="spin" aria-hidden="true"></span>'+esc(T('loadingN',{a:run.done,b:run.total}))+'</div>';
 if(run.mapped)h+='<div class="mut small">'+esc(T('mapped',{en:pl.phrase+(pl.size?' '+pl.size:'')}))+'</div>';
 if(G.prods.length)h+='<b>'+esc(T('resSummary',{q:run.q,n:G.prods.length,m:G.types.length}))+'</b>'+(run.fetchedAt?' <span class="mut small">· '+esc(T('fetchedAt',{t:fmtT(run.fetchedAt)}))+'</span>':'');
 else if(run.finished)h+='<p class="panel nores">'+esc(run.errs.length&&!run.items.size?T('err',{msg:run.errs[0]}):T('sNoneFriendly',{q:run.q}))+'</p>';
 if(here&&(G.prods.length||run.finished))h+='<div class="mut small scope">'+esc(T('cmpScope',{place:mode==='gps'?T('youHere'):sel.place,r:radius,n:priceSlots().length}))+'</div>';
 return h}
function renderResults(){const box=$('#results'),run=view.run;$('#cats').innerHTML='';
 if(!run){box.innerHTML='';$('#sSt').innerHTML=view.msg||'';$('#moreWrap').innerHTML='';return}
 if(!here){$('#sSt').innerHTML='<span class="err">'+esc(T('needLoc'))+'</span>';box.innerHTML='';return}
 const G=groupRun(run);const words=run.pl.words;$('#sSt').innerHTML=statusLine(run,G);
 if(view.cmp){renderCmp(G,words);return}
 if(view.type!=='all'&&!G.types.some(t=>t.type===view.type))view.type='all';
 if(G.types.length)$('#cats').innerHTML='<span class="sr">'+esc(T('typesLabel'))+'</span><button data-cat="all" aria-pressed="'+(view.type==='all')+'">'+esc(T('catAll'))+' <span class="n">'+G.prods.length+'</span></button>'+
  G.types.map(t=>'<button data-cat="'+t.type+'" aria-pressed="'+(view.type===t.type)+'">'+esc(typeName(t.type))+' <span class="n">'+t.prods.length+'</span></button>').join('');
 let h='';
 if(view.type==='all'){for(const t of G.types){h+='<section class="tsec" data-type="'+t.type+'"><h2 class="th">'+esc(typeName(t.type))+' <span class="mut small">'+esc(T('nKinds',{n:t.groups.length}))+'</span></h2>';
   for(const g of t.groups.slice(0,3))h+=groupHtml(g,words,3);
   if(t.prods.length>3)h+='<button class="sec wide" data-cat="'+t.type+'">'+esc(T('seeAllCat',{cat:typeName(t.type),n:t.prods.length}))+' ›</button>';h+='</section>'}}
 else{const t=G.types.find(x=>x.type===view.type);const lim=view.shown[t.type]||40;let n=0;
  h+='<h2 class="th">'+esc(typeName(t.type))+'</h2>';
  for(const g of t.groups){if(n>=lim)break;const take=Math.min(g.prods.length,lim-n);h+=groupHtml(g,words,take);n+=take}
  if(t.prods.length>lim)h+='<button class="sec wide" data-showmore="'+t.type+'">'+esc(T('moreProducts',{n:Math.min(40,t.prods.length-lim)}))+'</button>'}
 box.innerHTML=h;bindCards(box,G);
 const more=run.finished&&Object.keys(run.more).length;$('#moreWrap').innerHTML=more?'<button class="sec" id="moreBtn">'+esc(T('sMore'))+'</button>':'';
 const mb=$('#moreBtn');if(mb)mb.onclick=()=>loadMore(run)}
function groupHtml(g,words,limit){const first=g.prods[0];
 const lbl=g.other?T('otherKinds'):(g.label||T('plain'));
 return '<div class="grp" data-sub="'+esc(g.key)+'"><h3 class="gh">'+esc(lbl)+' <span class="mut small">· '+esc(T('nKinds',{n:g.prods.length}))+' · '+esc(T('fromP',{p:sortMode==='unit'&&first.bestU?unitTxt(first.bestU.u):money(first.best.c)}))+'</span></h3>'+
 g.prods.slice(0,limit).map(p=>prodCard(p,openCards.has(p.key),words)).join('')+'</div>'}
function renderCmp(G,words){const p=G.prods.find(x=>x.key===view.cmp);const box=$('#results');$('#moreWrap').innerHTML='';
 if(!p){box.innerHTML='<p class="panel">'+esc(T('cmpNone'))+'</p><button class="sec" id="cmpBack">'+esc(T('back'))+'</button>';$('#cmpBack').onclick=closeCmp;return}
 const t=G.types.find(x=>x.type===p.type);const g=t.groups.find(x=>x.prods.includes(p));
 const others=(g&&!g.other?g.prods:t.prods).filter(x=>x!==p).slice(0,12);
 box.innerHTML='<section id="cmp" aria-labelledby="cmpH"><button class="sec" id="cmpBack">'+esc(T('back'))+'</button><h2 id="cmpH" class="th">'+esc(T('cmpTitle'))+' · '+esc(typeName(p.type))+(g&&g.label&&!g.other?' · '+esc(g.label):'')+'</h2>'+
  prodCard(p,true,words)+(others.length?'<h3 class="gh">'+esc(T('sameGroup'))+'</h3>'+others.map(x=>prodCard(x,openCards.has(x.key),words)).join(''):'')+'</section>';
 $('#cmpBack').onclick=closeCmp;bindCards(box,G);$('#cmpBack').focus({preventScroll:true})}
function closeCmp(){view.cmp=null;renderResults()}
function openRun(text,opts){opts=opts||{};const r=NZS.resolve(text,LANG);const pl=NZS.plan(r);
 if(!pl){if(view.run)view.run.subs.delete(renderResults);view.run=null;view.msg=r&&r.unknown.length?'<p class="panel nores">'+esc(T('unknownWord',{w:r.unknown.join(' ')}))+'</p>':'';renderResults();return null}
 const run=startRun(pl);run.q=text;run.mapped=r.mapped||(r.words.join(' ')!==r.text.replace(/\s+/g,' ')&&!r.size);
 if(view.run&&view.run!==run)view.run.subs.delete(renderResults);
 view.run=run;view.type=opts.type||'all';view.cmp=opts.cmp||null;view.shown={};run.subs.add(renderResults);renderResults();return run}
// ---- live suggestions (combobox) ----
const qIn=$('#q'),sug=$('#sug');let sugRun=null,sugTimer=0,sugActive=-1,sugItems=[];
function sugClose(){sug.hidden=true;qIn.setAttribute('aria-expanded','false');qIn.removeAttribute('aria-activedescendant');sugActive=-1}
function sugRender(){const text=qIn.value.trim();if(!text){sugClose();return}
 let h='';sugItems=[];const run=sugRun;
 if(sugRun===null&&sugComp.length){h+='<li class="hint" role="presentation">'+esc(T('sugPick'))+'</li>'+sugComp.map((c,i)=>{sugItems.push({kind:'term',term:c.term});return '<li role="option" id="sg'+i+'" class="opt term" data-i="'+i+'"><span class="nm">'+esc(c.term)+(c.term!==c.en?' <span class="mut small">('+esc(c.en)+')</span>':'')+'</span></li>'}).join('')}
 else if(run){const G=here?groupRun(run):{prods:[],types:[]};const picks=pickSug(G);
  h+=picks.map((p,i)=>{sugItems.push({kind:'prod',p});return '<li role="option" id="sg'+i+'" class="opt" data-i="'+i+'">'+icon(p.type)+'<span class="nm">'+hl(shortName(p),run.pl.words)+' <span class="mut sz">'+esc([sizeTxt(p)||p.packSize||'',p.brand].filter(Boolean).join(' · '))+'</span></span><span class="sp">'+money(p.best.c)+'</span><button type="button" class="addb" tabindex="-1" data-i="'+i+'" aria-label="'+esc(T('addTo',{name:p.name}))+'">+</button></li>'}).join('');
  if(!run.finished)h+='<li class="hint" role="presentation"><span class="spin" aria-hidden="true"></span>'+esc(T('sugLoading'))+'</li>';
  else if(!picks.length)h+='<li class="hint" role="presentation">'+esc(run.errs.length&&!run.items.size?T('errBusy'):T('sugNone'))+'</li>'}
 else if(sugUnknown)h+='<li class="hint" role="presentation">'+esc(T('unknownWord',{w:sugUnknown}))+'</li>';
 const vi=sugItems.length;sugItems.push({kind:'all'});
 h+='<li role="option" id="sg'+vi+'" class="opt all" data-i="'+vi+'"><span class="nm">'+esc(T('viewAll'))+'</span><span aria-hidden="true">›</span></li>';
 sug.innerHTML=h;sug.hidden=false;qIn.setAttribute('aria-expanded','true');if(sugActive>=sugItems.length)sugActive=-1;setActive(sugActive);
 sug.querySelectorAll('.opt').forEach(li=>li.onclick=e=>{if(e.target.closest('.addb'))return;chooseSug(+li.dataset.i)});
 sug.querySelectorAll('.addb').forEach(b=>b.onclick=e=>{e.stopPropagation();const it=sugItems[+b.dataset.i];if(it&&it.p){addDirect(it.p)}})}
let sugComp=[],sugUnknown='';
function pickSug(G){ // basic products first (fresh/simple names, sold at most chains), then one per other category
 const score=p=>[p.own&&p.sub.mode==='v'?0:(p.type==='fruit'||p.type==='veg')?1:2,-Math.min(p.of.length,30),p.name.split(' ').length];
 const cmp=(a,b)=>{const x=score(a),y=score(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]-y[i];return a.best.c-b.best.c};
 const out=[],subs=new Set(),types=new Map();
 for(const t of G.types)types.set(t.type,[...t.prods].sort(cmp));
 const order=[...types.keys()].sort((a,b)=>((b===G.ownType)-(a===G.ownType)));let round=0;
 while(out.length<6&&round<6){for(const ty of order){const list=types.get(ty);const take=round===0&&ty===G.ownType?4:1;let k=0;
   while(k<take&&list.length&&out.length<6){const p=list.shift();const sk=p.type+p.sub.key;if(subs.has(sk)&&round<2)continue;subs.add(sk);out.push(p);k++}}round++}
 return out}
function setActive(i){sugActive=i;sug.querySelectorAll('.opt').forEach(li=>li.setAttribute('aria-selected',String(+li.dataset.i===i)));
 if(i>=0){qIn.setAttribute('aria-activedescendant','sg'+i);const el=$('#sg'+i);if(el)el.scrollIntoView({block:'nearest'})}else qIn.removeAttribute('aria-activedescendant')}
function chooseSug(i){const it=sugItems[i];if(!it)return;
 if(it.kind==='term'){qIn.value=it.term;onType(true);return}
 sugClose();if(it.kind==='all'){doSearch();return}
 const run=openRun(qIn.value.trim(),{cmp:it.p.key});if(run)$('#results').scrollIntoView({block:'start'})}
function addDirect(p){list.push({lid:Date.now().toString(36),name:p.name,qty:1,items:p.items.map(slim)});saveList();toast(T('listAdded',{name:p.name}))}
function onType(now){clearTimeout(sugTimer);const text=qIn.value.trim();
 const minOk=text.length>=2||/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(text);
 if(!text||!minOk){if(sugRun&&sugRun!==view.run)cancelRun(sugRun);sugRun=null;sugComp=[];sugClose();return}
 sugTimer=setTimeout(()=>{ // debounce 350 ms: only the text that stays for 350 ms is looked up
  const r=NZS.resolve(text,LANG);let pl=NZS.plan(r);sugComp=[];sugUnknown='';
  if(!pl||(!r.mapped&&text.length<4&&!NZS.C[NZS.singular(text.toLowerCase())])){ // short/partial word: complete from the word list (0 requests)
   const comp=NZS.complete(text,LANG);
   if(comp.length===1&&!pl){pl=NZS.plan(NZS.resolve(comp[0].en,'en'))}
   else if(comp.length===1){pl=NZS.plan(NZS.resolve(comp[0].en,'en'))}
   else if(comp.length>1){sugComp=comp;pl=null}
   else if(!pl&&r&&r.unknown.length)sugUnknown=r.unknown.join(' ')}
  const prev=sugRun;
  if(pl){sugRun=startRun(pl);if(!sugRun.q)sugRun.q=text;sugRun.subs.add(sugRender)}else sugRun=null;
  if(prev&&prev!==sugRun){prev.subs.delete(sugRender);if(prev!==view.run)cancelRun(prev)} // stale suggestion requests are aborted
  sugRender()},now===true?0:350)}
qIn.setAttribute('role','combobox');qIn.setAttribute('aria-autocomplete','list');qIn.setAttribute('aria-controls','sug');qIn.setAttribute('aria-expanded','false');
qIn.addEventListener('input',()=>onType());
qIn.addEventListener('keydown',e=>{if(sug.hidden){if(e.key==='ArrowDown'&&qIn.value.trim()){e.preventDefault();onType(true)}return}const n=sug.querySelectorAll('.opt').length;
 if(e.key==='ArrowDown'){e.preventDefault();setActive((sugActive+1)%n)}else if(e.key==='ArrowUp'){e.preventDefault();setActive(sugActive<=0?n-1:sugActive-1)}
 else if(e.key==='Escape'){e.preventDefault();sugClose()}else if(e.key==='Enter'&&sugActive>=0){e.preventDefault();chooseSug(sugActive)}});
qIn.addEventListener('focus',()=>{if(qIn.value.trim())onType(true)});
document.addEventListener('click',e=>{if(!e.target.closest('#sForm'))sugClose()});
function doSearch(){const q=qIn.value.trim();if(!q)return;sugClose();openCards.clear();
 // reuse the suggestion run when it is for this text (0 extra requests)
 const run=openRun(sugRun&&sugRun.q===q?sugRun.pl.phrase+(sugRun.pl.size?' '+sugRun.pl.size:''):q);if(run){run.q=q}}
$('#sForm').onsubmit=e=>{e.preventDefault();doSearch()}; // Enter on the phone keyboard = view all
$('#sortP').onclick=()=>{sortMode='price';$('#sortP').setAttribute('aria-pressed',true);$('#sortU').setAttribute('aria-pressed',false);renderResults()};
$('#sortU').onclick=()=>{sortMode='unit';$('#sortU').setAttribute('aria-pressed',true);$('#sortP').setAttribute('aria-pressed',false);renderResults()};
window.NZG_TEST={NET,RUNS,RC,INFL,get view(){return view},groupRun,priceSlots,get sel(){return sel},get PLACES(){return PLACES}};
function offerHtml(p,o,best){const s=o.slot;
 return '<div class="pl'+(best?' best':'')+'" data-loc="'+esc(s.loc)+'" data-cents="'+o.c+'"><div class="who"><b>'+esc(s.label)+'</b> <span class="mut small">'+kmS(s.d)+'</span>'+
 (s.zone?'<div class="mut small">'+esc(T('nearestBranch',{store:s.store.name,d:kmS(s.d)}))+'</div>':'')+
 '<div class="mut small rec" data-obs="'+esc(o.obs)+'">'+esc(T('rec',{t:fmtT(o.obs)}))+' ('+esc(ago(o.obs))+')</div>'+
 '<a href="'+esc(productUrl(p))+'" target="_blank" rel="noopener" class="vlink">'+esc(T('verify'))+' ↗</a>'+(s.zone?'':' <span class="mut small">('+esc(T('verifyStore'))+')</span>')+'</div>'+
 '<div class="amt">'+(best?'<div class="badge">'+esc(T('cheapest'))+'</div>':'')+'<div class="price">'+money(o.c)+'</div>'+(o.u&&o.um?'<div class="mut small">'+esc(T('unit',{p:money(o.u),u:o.um}))+'</div>':'')+
 (o.promo?'<div class="promo">'+esc(T('promo'))+(typeof o.promo==='string'?' · '+esc(o.promo):'')+'</div>':'')+'</div></div>'}
// ===== shopping list =====
const slim=p=>({id:p.id,chain:p.chain,name:p.name,brand:p.brand,size:p.size,sku:p.sku,prices:p.prices,savedAt:new Date().toISOString()});
// PAK'nSAVE and New World (both Foodstuffs) share product codes: add the twin automatically
// A grouped product already holds the same item at every chain (incl. PAK'nSAVE/New World twins with the same code)
function withTwins(p){if(p.items)return p.items.map(slim);return[slim(p)]}
function addFlow(p,btn){const box=(btn.closest('article')||btn.parentElement).querySelector('.chooserBox');
 if(!list.length){list.push({lid:Date.now().toString(36),name:p.name,qty:1,items:withTwins(p)});saveList();toast(T('added'));return}
 box.innerHTML='<div class="chooser"><button data-l="new">'+esc(T('addNew'))+'</button>'+list.map((l,i)=>'<button data-l="'+i+'">'+esc(T('mergeInto',{name:l.name}))+'</button>').join('')+'<button data-l="x">'+esc(T('close'))+'</button></div>';
 box.querySelectorAll('button').forEach(b=>b.onclick=()=>{const v=b.dataset.l;
  const add=withTwins(p);if(v==='new')list.push({lid:Date.now().toString(36),name:p.name,qty:1,items:add});
  else if(v!=='x'){const l=list[+v];const ids=new Set(add.map(x=>x.id));l.items=l.items.filter(x=>!ids.has(x.id)).concat(add)}
  box.innerHTML='';if(v!=='x'){saveList();toast(T('added'))}})}
function lineBest(line,slot){let best=null;for(const it of line.items){if(it.chain!==slot.chain)continue;const pr=it.prices&&it.prices[slot.loc];if(pr&&(!best||pr.c<best.c))best=pr}return best}
function renderList(){const box=$('#listBox');
 if(!list.length){box.innerHTML='<p class="panel">'+esc(T('listEmpty'))+'</p>';$('#totals').innerHTML='';$('#totNote').textContent='';return}
 box.innerHTML=list.map((l,i)=>'<article class="card line"><h3>'+esc(l.name)+'</h3><div class="mut small">'+esc(T('lineHas',{list:l.items.map(x=>CHAIN_NAME[x.chain]+': '+x.name+(x.size&&!x.name.includes(x.size)?' '+x.size:'')).join(' | ')}))+'</div>'+
  '<div class="row" style="margin-top:.3rem"><span class="qtyb"><span>'+esc(T('qty'))+'</span><button data-a="m" data-i="'+i+'" aria-label="−">−</button><b class="qv">'+l.qty+'</b><button data-a="p" data-i="'+i+'" aria-label="+">+</button></span>'+
  '<button class="sec" data-a="d" data-i="'+i+'">'+esc(T('del'))+'</button></div></article>').join('');
 box.querySelectorAll('button[data-a]').forEach(b=>b.onclick=()=>{const l=list[+b.dataset.i];if(b.dataset.a==='m')l.qty=Math.max(1,l.qty-1);if(b.dataset.a==='p')l.qty=Math.min(99,l.qty+1);if(b.dataset.a==='d')list.splice(+b.dataset.i,1);saveList();renderList()});
 $('#totNote').textContent=T('totNote',{a:'2',b:'3'});
 if(!here){$('#totals').innerHTML='<p class="panel">'+esc(T('noLocTot'))+'</p>';return}
 const rows=priceSlots().map(s=>{let tot=0,n=0,oldest=null;for(const l of list){const b=lineBest(l,s);if(b){tot+=b.c*l.qty;n++;if(!oldest||b.obs<oldest)oldest=b.obs}}return{s,tot,n,oldest}}).filter(r=>r.n>0)
  .sort((a,b)=>(b.n-a.n)||(a.tot-b.tot));
 $('#totals').innerHTML='<table><thead><tr><th>'+esc(T('tabStores'))+'</th><th>'+esc(T('totals'))+'</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr class="tot'+(i===0?' best':'')+'" data-loc="'+esc(r.s.loc)+'" data-total="'+r.tot+'" data-n="'+r.n+'"><td><b>'+esc(r.s.label)+'</b> <span class="mut small">'+kmS(r.s.d)+'</span>'+
  (r.oldest?'<div class="mut small">'+esc(T('rec',{t:fmtT(r.oldest)}))+'</div>':'')+'</td><td><span class="price">'+money(r.tot)+'</span><div class="small">'+esc(r.n===list.length?T('complete'):T('items',{a:r.n,b:list.length}))+'</div></td></tr>').join('')+'</tbody></table>'}
$('#clearList').onclick=()=>{if(list.length&&confirm(T('confirmClear'))){list=[];saveList();renderList()}};
$('#refreshList').onclick=async()=>{const st=$('#lSt');st.textContent=T('refreshing');let err=null;const ids=[...new Set(list.flatMap(l=>l.items.map(i=>i.id)))];
 const fresh={};for(const id of ids){try{const r=await api('/api/v1/items/comparison',{itemId:id});fresh[id]=r.json.data}catch(e){err=e.message}}
 for(const l of list)for(const it of l.items){const d=fresh[it.id];if(!d)continue;const locSet=new Set(LOCIDS()[it.chain]||[]);const pr={};
  for(const p of d.prices||[])if(locSet.has(String(p.locationId)))pr[p.locationId]={c:p.priceCents,u:p.unitPriceCents,um:p.unitMeasure,promo:p.promoFlag?(p.promoLabel||1):0,obs:p.observedAt};
  it.prices=pr;it.savedAt=new Date().toISOString()}
 saveList();renderList();st.innerHTML=err?'<span class="err">'+esc(T('err',{msg:err}))+'</span>':esc(T('updated'))};
// ===== render all =====
function renderAll(){pickRender();renderLoc();renderStores();renderResults();if(typeof sugRun!=='undefined'&&sugRun&&!sug.hidden)sugRender();if(!$('#v-list').hidden)renderList()}
// ===== PWA =====
let deferredPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').hidden=false});
$('#installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').hidden=true};
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
// ===== boot =====
setRadius(radius);
Promise.all(['data/stores.json','data/places.json'].map(u=>fetch(u).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()}))).then(([d,p])=>{DATA=d;PLACES=p;
 if(sel.place){const c=cityOf(sel.city),a=areaOf(c,sel.area),pl=placeOf(a,sel.place);if(pl){mode='place';here=[pl[1],pl[2]];hereLabel=sel.place}else sel={city:c?sel.city:'',area:a?sel.area:'',place:''}}
 applyLang()}).catch(e=>{$('#locSt').innerHTML='<span class="err">'+esc(T('err',{msg:e.message}))+'</span>'});
applyLang();
