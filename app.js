'use strict';
// ===== config =====
const PROXY="https://nzgrocery-proxy.ytonywong.workers.dev";
const VERSION="1.6.0 (2026-10-24)";
const CHAIN_NAME={"paknsave":"PAK'nSAVE","new-world":"New World","countdown":"Woolworths","farro":"Farro","other":""};
const SEARCH_CHAINS=["paknsave","new-world","countdown","farro"];
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// ===== i18n =====
// Round 4: English is the default on a first visit (no saved choice), whatever the browser language is; the user's pick is saved in localStorage 'nzgLang'.
let LANG=localStorage.getItem('nzgLang');if(!I18N[LANG])LANG='en';
const T=(k,v={})=>(I18N[LANG][k]??I18N['zh-Hant'][k]??k).replace(/\{(\w+)\}/g,(_,x)=>v[x]??'');
const LOC={"zh-Hant":"zh-HK","zh-Hans":"zh-CN","en":"en-NZ","ja":"ja-JP","mi":"en-NZ","ko":"ko-KR"};
const fmtT=iso=>{try{return new Intl.DateTimeFormat(LOC[LANG],{timeZone:'Pacific/Auckland',year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(iso))}catch(e){return iso}};
const ago=iso=>{const s=(Date.now()-Date.parse(iso))/1000;const rtf=new Intl.RelativeTimeFormat(LANG==='mi'?'en':LOC[LANG],{numeric:'auto'});
 return s<3600?rtf.format(-Math.max(1,Math.round(s/60)),'minute'):s<86400*2?rtf.format(-Math.round(s/3600),'hour'):rtf.format(-Math.round(s/86400),'day')};
const money=c=>'$'+(c/100).toFixed(2);
const kmS=d=>(d<10?d.toFixed(1):Math.round(d))+' km';
// ===== font size (rem) =====
const FS=[87.5,100,112.5,125,150];let fsi=localStorage.getItem('nzgFs');fsi=fsi===null?1:+fsi;if(!(fsi>=0&&fsi<FS.length))fsi=1; // round 4 fix: a fresh profile starts at the standard size (A), not A−
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
const LANG_CODE={'en':'EN','zh-Hant':'繁中','zh-Hans':'简中','ja':'日本','mi':'MI','ko':'한국어'};
function applyLang(){document.documentElement.lang=LANG;langSel.value=LANG;$('#langCode').textContent=LANG_CODE[LANG]||LANG;langSel.setAttribute('aria-label',T('lang')+(LANG==='en'?'':' / Language'));document.title=T('title');
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
  const q=F.value.trim();let ps=a.places.map((p,i)=>({p,i,m:q?bestMatch(placeKeys(c,a,p,true),pqFold(q)):null}));if(q)ps=ps.filter(x=>x.m).sort((x,y)=>x.m.tier-y.m.tier||x.m.ki-y.m.ki||x.i-y.i);
  items=ps.map(({p,m})=>{const viaMain=!m||m.ki===0;return {v:p[0],t:p[0],h:viaMain&&m?hlKey(m):'',alt:m&&!viaMain?m.k.s:'',altH:m&&!viaMain?hlKey(m):'',cur:p[0]===sel.place}})}
 L.innerHTML=items.length?items.map(x=>'<li><button type="button" data-v="'+esc(x.v)+'"'+(x.cur?' aria-current="true"':'')+'><span>'+(x.h||esc(x.t))+(x.alt?'<span class="alt">'+(x.altH||esc(x.alt))+'</span>':'')+'</span>'+(x.c?'<span class="c">'+esc(x.c)+'</span>':'')+'</button></li>').join('')
  :'<li class="mut small" style="padding:.5rem">'+esc(T('noPlaceMatch'))+'</li>';
 L.querySelectorAll('button[data-v]').forEach(b=>b.onclick=()=>{const v=b.dataset.v;
  if(pickKind==='city'){if(v!==sel.city){const cc=cityOf(v);setPlace(v,cc.areas.length===1?cc.areas[0].id:'','')}else renderAll();
   openPick(curCity().areas.length===1?'place':'area')}
  else if(pickKind==='area'){if(v!==sel.area)setPlace(sel.city,v,'');openPick('place')}
  else{setPlace(sel.city,sel.area,v);closePick();$('#cPlace').focus()}})}
// ===== Round 4: place/suburb type-ahead (#pq). Computed on the phone from data/places.json + data/aliases.json; 0 network calls. =====
// Matching: case-insensitive, macrons/diacritics ignored, "Mount"="Mt", "Saint"="St"; English names, Chinese city/area labels
// (Traditional and Simplified) and a small documented set of well-known Chinese suburb names. Ranking: prefix > word-start > substring.
let ALIAS={};
function foldMap(s){let f='',a=[],b=[];for(let i=0;i<s.length;){const ch=String.fromCodePoint(s.codePointAt(i)),n=ch.length;
  for(const x of ch.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()){f+=x;a.push(i);b.push(i+n)}i+=n}
 for(const [re,to] of [[/\bmount\b/,'mt'],[/\bsaint\b/,'st']]){let m;while((m=re.exec(f))){const j=m.index,L=m[0].length;
  f=f.slice(0,j)+to+f.slice(j+L);a.splice(j,L,a[j],a[j+L-1]);b.splice(j,L,b[j],b[j+L-1])}}
 return {s,f,a,b}}
const pqFold=q=>foldMap(q.replace(/\s+/g,' ')).f;
const KC=new Map();const keyOf=s=>{let k=KC.get(s);if(!k){k=foldMap(s);KC.set(s,k)}return k};
const isWordCh=ch=>/[\p{L}\p{N}]/u.test(ch)&&!/[\u3000-\u9fff\uf900-\ufaff]/.test(ch);
function bestMatch(keys,q){if(!q)return null;let best=null;keys.forEach((k,ki)=>{if(!k)return;let j=k.f.indexOf(q);
  while(j>=0){const tier=j===0?0:!isWordCh(k.f[j-1])?1:2;if(!best||tier<best.tier||(tier===best.tier&&ki<best.ki))best={tier,ki,k,j,n:q.length};if(tier===0)break;j=k.f.indexOf(q,j+1)}});return best}
function hlKey(m){const s=m.k.s,x=m.k.a[m.j],y=m.k.b[m.j+m.n-1];return esc(s.slice(0,x))+'<b>'+esc(s.slice(x,y))+'</b>'+esc(s.slice(y))}
function hlIn(disp,m){const p=disp.indexOf(m.k.s);if(p<0)return null;return esc(disp.slice(0,p))+hlKey(m)+esc(disp.slice(p+m.k.s.length))}
function placeKeys(c,a,p,withAlt){const al=ALIAS[c.id+'|'+a.id+'|'+p[0]];const ks=[keyOf(p[0])];if(al){ks.push(keyOf(al[0]));if(al[1]!==al[0])ks.push(keyOf(al[1]))}if(withAlt&&p[3])ks.push(keyOf(p[3]));return ks}
const nameKeys=o=>[keyOf(o.name),o.zh&&keyOf(o.zh),o.zhs&&o.zhs!==o.zh&&keyOf(o.zhs)];
function pqSearch(q){const qf=pqFold(q.trim());if(!PLACES||!qf||(/^[\x00-\x7f]+$/.test(qf)&&qf.length<2))return null;const hit=[];
 for(const c of PLACES.cities){let m=bestMatch(nameKeys(c),qf);if(m)hit.push({t:0,c,m});
  for(const a of c.areas){m=bestMatch(nameKeys(a),qf);if(m)hit.push({t:1,c,a,m});
   for(const p of a.places){m=bestMatch(placeKeys(c,a,p),qf);if(m)hit.push({t:2,c,a,p,m})}}}
 const nm=h=>h.p?h.p[0]:h.a?h.a.name:h.c.name;
 hit.sort((x,y)=>x.m.tier-y.m.tier||x.t-y.t||(y.m.k.f===qf)-(x.m.k.f===qf)||(x.m.ki>0)-(y.m.ki>0)||nm(x).length-nm(y).length||nm(x).localeCompare(nm(y)));
 const out=[],seen=new Set(),id=h=>h.t+'|'+h.c.id+'|'+(h.a?h.a.id:'')+'|'+(h.p?h.p[0]:'');
 const add=h=>{const k=id(h);if(!seen.has(k)){seen.add(k);out.push(h)}};hit.forEach(add);
 for(const h of hit){if(h.m.tier>1)continue;if(h.t===0)h.c.areas.forEach(a=>add({t:1,c:h.c,a}));if(h.t===1)h.a.places.forEach(p=>add({t:2,c:h.c,a:h.a,p}))}
 return out}
const PQ_MAX=8;let pqRows=[],pqAct=-1,pqT=0,pqOpen=false;const pq=$('#pq'),pqL=$('#pqList'),pqD=$('#pqDrop'),pqM=$('#pqMsg');
function pqShow(open){pqOpen=open;pqD.hidden=!open;pq.setAttribute('aria-expanded',String(open&&pqRows.length>0));if(!open){pqAct=-1;pq.removeAttribute('aria-activedescendant')}}
function pqRender(){const v=pq.value;$('#pqX').hidden=!v;const all=pqSearch(v);if(all===null){pqRows=[];pqL.innerHTML='';pqShow(false);$('#pqSt').textContent='';return}
 pqRows=all.slice(0,PQ_MAX);if(pqAct>=pqRows.length)pqAct=pqRows.length-1;
 pqL.innerHTML=pqRows.map((h,i)=>{const disp=h.p?h.p[0]:zhName(h.a||h.c);let main=esc(disp),chip='';
  if(h.m){const x=hlIn(disp,h.m);if(x)main=x;else chip=' <span class="al">('+hlKey(h.m)+')</span>'}
  const sub=h.t===2?zhName(h.a)+' · '+zhName(h.c):h.t===1?T('pqArea',{n:h.a.places.length})+' · '+zhName(h.c):T('pqCity',{n:h.c.areas.length});
  return '<li id="pqo'+i+'" role="option" class="opt" aria-selected="'+(i===pqAct)+'" data-i="'+i+'"><span class="pn">'+main+chip+'</span><span class="ps">'+esc(sub)+'</span></li>'}).join('');
 const more=all.length-pqRows.length;pqM.hidden=!(all.length===0||more>0);pqM.textContent=all.length===0?T('pqNone'):more>0?T('pqMore',{n:more}):'';
 $('#pqSt').textContent=all.length===0?T('pqNone'):T('pqCount',{n:all.length});
 pqL.querySelectorAll('.opt').forEach(o=>{o.onmousedown=e=>e.preventDefault();o.onclick=()=>pqPick(+o.dataset.i)});
 pqShow(true);if(pqAct>=0){pq.setAttribute('aria-activedescendant','pqo'+pqAct);const o=$('#pqo'+pqAct);o&&o.scrollIntoView&&o.scrollIntoView({block:'nearest'})}else pq.removeAttribute('aria-activedescendant')}
function pqPick(i){const h=pqRows[i];if(!h)return;pqShow(false);$('#pqSt').textContent='';
 if(h.t===2){pq.value=h.p[0];setPlace(h.c.id,h.a.id,h.p[0])}
 else if(h.t===1){pq.value=zhName(h.a);if(h.c.id!==sel.city||h.a.id!==sel.area)setPlace(h.c.id,h.a.id,'');openPick('place')}
 else{pq.value=zhName(h.c);if(h.c.id!==sel.city)setPlace(h.c.id,h.c.areas.length===1?h.c.areas[0].id:'','');else renderAll();openPick(curCity().areas.length===1?'place':'area')}
 $('#pqX').hidden=!pq.value}
pq.addEventListener('input',()=>{clearTimeout(pqT);pqAct=-1;pqT=setTimeout(pqRender,60)});
pq.addEventListener('focus',()=>{if(pq.value)pqRender()});
pq.addEventListener('blur',()=>setTimeout(()=>{if(document.activeElement!==pq)pqShow(false)},120));
pq.addEventListener('keydown',e=>{const k=e.key;
 if(k==='ArrowDown'||k==='ArrowUp'){e.preventDefault();clearTimeout(pqT);if(!pqOpen){pqAct=-1;pqRender()}if(!pqRows.length)return;
  pqAct=k==='ArrowDown'?(pqAct+1)%pqRows.length:(pqAct<=0?pqRows.length-1:pqAct-1);pqRender()}
 else if(k==='Enter'){clearTimeout(pqT);if(!pqOpen)pqRender();if(pqRows.length){e.preventDefault();pqPick(pqAct>=0?pqAct:0)}}
 else if(k==='Escape'){e.preventDefault();if(pqOpen)pqShow(false);else{pq.value='';$('#pqX').hidden=true;$('#pqSt').textContent=''}}
 else if(k==='Tab')pqShow(false)});
$('#pqX').onclick=()=>{pq.value='';pqRows=[];pqShow(false);$('#pqX').hidden=true;$('#pqSt').textContent='';pq.focus()};
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
const NET={sent:0,cached:0,aborted:0,retries:0,log:[]}; // exposed for tests
function reqUrl(path,params){const u=new URL(PROXY+path);for(const[k,v]of Object.entries(params))u.searchParams.set(k,v);return u.toString()}
// v1.6.0: Baskt is sometimes slow (5–13 s) or answers 5xx for a new word. The phone now retries a failed request by itself
// (max 2 more tries, waits 3 s then 7 s, or the Retry-After the proxy gives, max 12 s) before it shows "busy".
const sleep=(ms,sig)=>new Promise((ok,no)=>{const h=setTimeout(ok,ms);if(sig)sig.addEventListener('abort',()=>{clearTimeout(h);no(new DOMException('aborted','AbortError'))},{once:true})});
async function fetchRetry(url,ctl){let last=null;
 for(let a=0;a<3;a++){
  if(a){const ra=last&&last.ra;await sleep(Math.min(12,Math.max(2,ra||(a===1?3:7)))*1000,ctl.signal);NET.retries++;NET.log.push('retry '+url)}
  let r;try{r=await fetch(url,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',signal:ctl.signal})}
  catch(e){if(e.name==='AbortError')throw e;last={msg:T('errBusy'),ra:0};continue}
  if(r.ok)return r;
  if(r.status===502||r.status===503||r.status===504){const ra=parseInt(r.headers.get('Retry-After')||'',10);last={msg:T('errBusy'),ra:Number.isFinite(ra)?ra:0};if(last.ra>20)break;continue}
  if(r.status===429)throw new Error(T('errBusy'));throw new Error('HTTP '+r.status)}
 throw new Error(last?last.msg:T('errBusy'))}
function getJSON(url,run){const c=RC.get(url);if(c&&Date.now()-c.at<1800000){NET.cached++;return Promise.resolve(c.data)}
 let f=INFL.get(url);
 if(!f){const ctl=new AbortController();NET.sent++;NET.log.push(url);
  f={ctl,refs:0,p:fetchRetry(url,ctl).then(async r=>{
    const data={json:await r.json(),fetchedAt:r.headers.get('X-Fetched-At'),cache:r.headers.get('X-Cache')};RC.set(url,{at:Date.now(),data});return data}).finally(()=>INFL.delete(url))};
  INFL.set(url,f)}
 f.refs++;run.reqs.add(url);return f.p}
function releaseRun(run){for(const u of run.reqs){const f=INFL.get(u);if(f&&--f.refs<=0){f.ctl.abort();INFL.delete(u);NET.aborted++}}run.reqs.clear()}
const RUNS=new Map(); // plan.key -> run (shared by suggestions and full results)
function startRun(pl){const key=(sel.city||'akl')+'|'+pl.key;let run=RUNS.get(key);if(run&&!run.cancelled&&!(run.finished&&run.errs.length))return run; // v1.6.0: a run that had failures is started again (successful parts come from the 30-min phone cache, 0 requests)
 run={pl,key,loc:LOCIDS(),items:new Map(),prices:{},total:0,done:0,errs:[],failedChains:new Set(),fetchedAt:null,reqs:new Set(),more:{},subs:new Set(),cancelled:false,finished:false};RUNS.set(key,run);
 run.promise=execRun(run);return run}
function cancelRun(run){if(!run||run.finished)return;run.cancelled=true;releaseRun(run);RUNS.delete(run.key)}
function ingestRun(run,chain,json,words,size){const d=json.data||{};const locSet=new Set(run.loc[chain]||[]);const got=[];
 for(const it of d.items||[]){if(!NZS.matches(it,words,size))continue;got.push(it);if(!run.items.has(it.id))run.items.set(it.id,{...it,chain:it.chain||chain})}
 for(const p of d.latestPrices||[]){if(!run.items.has(p.itemId)||!locSet.has(String(p.locationId)))continue;(run.prices[p.itemId]||(run.prices[p.itemId]={}))[p.locationId]=
  {c:p.priceCents,u:p.unitPriceCents,um:p.unitMeasure,obs:p.observedAt,reg:p.regularPriceCents}}
 return got}
async function q1(run,chain,q,offset){if(run.cancelled)return null;const params={q,chain,locationId:run.loc[chain].join(','),limit:LIMIT};if(offset)params.offset=offset;
 run.total++;notify(run);
 try{const r=await getJSON(reqUrl('/api/v1/items',params),run);if(run.cancelled)return null;
  if(r.fetchedAt&&(!run.fetchedAt||r.fetchedAt<run.fetchedAt))run.fetchedAt=r.fetchedAt;return r.json}
 catch(e){if(!run.cancelled&&e.name!=='AbortError'){run.errs.push(e.message);run.failedChains.add(chain)}return null}
 finally{run.done++;notify(run)}}
async function execRun(run){const pl=run.pl;const chains=SEARCH_CHAINS.filter(c=>run.loc[c]);
 const extra=pl.rawExtra?pl.extra.map(x=>({bq:x,words:pl.words,size:null})):pl.extra.map(x=>NZS.resolve(x,'raw')).filter(Boolean); // alias extras (L&P: "paeroa") are sent as typed and matched against the alias
 // wave 1: the phrase (+ size) per chain, the concept's extra phrases, and for 2+ words the main word
 const w1=[];for(const c of chains){const seen=new Set();const add=(q,words,size,tag)=>{if(!q||q.length<2||seen.has(q))return;seen.add(q);w1.push({c,q,words,size,tag})};
  add(NZS.chainQ(c,pl.bq||pl.phrase,pl.size),pl.words,pl.size,'main');
  for(const x of extra)add(NZS.chainQ(c,x.bq||x.words.join(' '),x.size),x.words,x.size,'extra');
  if(pl.brandQ)add(pl.brandQ,pl.words,pl.size,'brand'); // v1.3.2: brand + words -> ask Baskt for the brand (matches its brand field), filter on the phone
  for(const a of pl.alt||[])add(NZS.chainQ(c,a,pl.size),pl.words,pl.size,'alt'); // vogel's -> also vogels; tip-top -> tip top
  if(pl.anchor)add(pl.anchor,pl.words,pl.size,'anchor')}
 const res1=await Promise.all(w1.map(async t=>{const j=await q1(run,t.c,t.q);if(!j)return{t,j};const got=ingestRun(run,t.c,j,t.words,t.size);return{t,j,got}}));
 if(run.cancelled)return;
 // wave 2 (single word, no size): data-driven paging. Page 2 only when page 1 was mostly real matches (≥50 %; "tea" also
 // matches "steak", so paging that is wasteful); the plural ("apples") only when the plural really appears in page-1 names.
 const w2=[];for(const r of res1)if(r.t.tag==='brand'&&r.j&&(r.j.data.pagination||{}).hasMore)w2.push({c:r.t.c,q:r.t.q,off:r.j.data.pagination.nextOffset,words:r.t.words,size:r.t.size});
 if(pl.words.length===1&&!pl.size){const w=pl.words[0],pw=/[\s&]/.test(w)?w:NZS.plural(w);
  const mains=res1.filter(r=>r.t.tag==='main'&&r.j);
  const pluralSeen=pw!==w&&mains.some(r=>(r.j.data.items||[]).some(it=>(' '+NZS.norm(it.name)+' ').includes(' '+pw+' ')));
  for(const r of mains){const pg=r.j.data.pagination||{};if(!pg.hasMore)continue;const n=(r.j.data.items||[]).length||1;
   if(r.got.length/n>=0.5)w2.push({c:r.t.c,q:r.t.q,off:pg.nextOffset,words:pl.words});else run.more[r.t.c]={q:r.t.q,off:pg.nextOffset};
   if(pluralSeen)w2.push({c:r.t.c,q:pw,off:0,words:pl.words})}}
 else{for(const r of res1)if(r.t.tag==='main'&&r.j&&(r.j.data.pagination||{}).hasMore)run.more[r.t.c]={q:r.t.q,off:r.j.data.pagination.nextOffset}}
 await Promise.all(w2.map(async t=>{const j=await q1(run,t.c,t.q,t.off);if(!j)return;ingestRun(run,t.c,j,t.words||pl.words,t.size||null);
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
 const pl=run.pl;for(const p of out){p.hit=NZS.brandHit(p.brand,pl);p.pop=NZS.popRank(p.brand,pl.words)}
 return{prods:out,types:tl,ownType:prods.ownType,brands:brandGroups(out,pl,prods.ownType,sk)}}
// v1.3.2: results grouped by brand. Order: brand the user typed first, then well-known brands for the searched
// product (search.js POPULAR), then brands with more matching products sold at more stores; "Other" (no brand) last.
let BK=null;
function brandKey(b){const n=NZS.norm(b);if(!n)return'';BK=BK||[...NZS.brandSet().keys()].sort((a,b)=>b.length-a.length);for(let i=BK.length-1;i>=0;i--){const k=BK[i];if(n===k||n.startsWith(k+' '))return k}return n} // shortest known brand prefix: Tip Top Super Soft / Tip Top Fruju -> Tip Top; Ploughmans Bakery -> Ploughmans
function brandGroups(prods,pl,own,sk){const m=new Map();const fresh=!!(NZS.PRODUCE&&pl&&pl.words&&NZS.PRODUCE.has(pl.words.join(' ')));const lz=p=>(p.size==='kg'||p.size==='ea')?0:1;
 for(const p of prods){const k=brandKey(p.brand);let g=m.get(k);if(!g)m.set(k,g={key:'b:'+(k||'-'),label:'',names:{},prods:[],hit:false,pop:-1,score:0,own:0,other:!k});
  g.prods.push(p);if(p.brand)g.names[p.brand]=(g.names[p.brand]||0)+1;if(p.hit)g.hit=true;if(p.pop>=0&&(g.pop<0||p.pop<g.pop))g.pop=p.pop;
  if(p.type===own)g.own++;g.score+=(p.type===own?2:1)*Math.min(p.of.length,30)}
 for(const g of m.values()){const nm=Object.keys(g.names).sort((a,b)=>a.length-b.length||(g.names[b]-g.names[a]));
  g.label=g.other?'':(NZS.brandSet().get(g.key.slice(2))||nm[0]||'');   // known-brand label, else the shortest name seen
  g.prods.sort(fresh?(a,b)=>((a.type!==own)-(b.type!==own))||(lz(a)-lz(b))||sk(a)-sk(b):(a,b)=>sk(a)-sk(b))} // v1.3.3: inside a brand group strictly cheapest -> most expensive
 // v1.6.0: for a fresh fruit/veg word, the fresh item itself (loose per kg / each first) leads each group, then cheapest
 const pr=g=>g.pop<0?1:0; // well-known brands for the product come first, then by how many matching products/stores
 // relevance: 1) the brand typed  2) groups that hold the searched product itself (bread brands before a pickle brand;
 // loose apples with no brand before apple-juice brands)  3) well-known brands  4) more matching products × stores  5) "Other" last on ties
 return[...m.values()].sort((a,b)=>b.hit-a.hit||(b.own>0)-(a.own>0)||(fresh?b.own-a.own:0)||pr(a)-pr(b)||b.score-a.score||a.other-b.other||sk(a.prods[0])-sk(b.prods[0]))}
// ---- display helpers ----
const ICON={fruit:'M12 7c-3-2-7 0-7 5s3 9 5 9c1 0 1.5-.5 2-.5s1 .5 2 .5c2 0 5-4 5-9s-4-7-7-5zm0 0c0-2 1-4 3-5',veg:'M7 21l10-10M14 4c3 0 6 3 6 6l-6 6-6-6c0-3 3-6 6-6z',
 drinks:'M7 3h10l-1.5 18h-7zM7 8h10',tea:'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h2a2 2 0 0 1 0 4h-2M8 3v3M12 3v3',coffee:'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h2a2 2 0 0 1 0 4h-2',
 milk:'M8 3h8v3l2 3v12H6V9l2-3zM6 12h12',bakery:'M3 15c0-5 4-8 9-8s9 3 9 8zM3 15h18v3H3z',sauces:'M10 3h4v4l3 3v11H7V10l3-3z',other:'M4 8h16l-1.5 12h-13zM8 8a4 4 0 0 1 8 0'};
const icon=t=>{const d=ICON[t]||ICON[{dairy:'milk',frozen:'milk',sweets:'other',snacks:'other',cereal:'other',pantry:'sauces',alcohol:'drinks',baby:'milk',health:'sauces',nonfood:'other',meat:'other',meals:'bakery'}[t]]||ICON.other;
 return '<span class="thumb" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="'+d+'"/></svg></span>'};
function hl(text,words){let s=esc(text);const forms=[...new Set(words.flatMap(w=>[...NZS.wordForms(w)]))].sort((a,b)=>b.length-a.length).map(f=>f.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/ and /g,'\\s*(?:&amp;|and)\\s*').replace(/ /g,"(?:[\\s’-]|&#39;)*").replace(/s$/,"(?:’|&#39;)?s"));
 if(!forms.length)return s;return s.replace(new RegExp('(^|[^A-Za-z])('+forms.join('|')+')(?![A-Za-z])','gi'),'$1<b>$2</b>')}
const uLbl=u=>u.u==='kg'?T('perkg'):u.u==='L'?T('perL'):u.u==='ea'?T('perea'):'/'+u.u;
const unitTxt=u=>u?T('uFmt',{p:money(u.c),u:uLbl(u)})+(u.calc?' ('+T('unitCalc')+')':''):'';
const brandHtml=p=>p.brand?'<span class="brand">'+esc(p.brand)+'</span>'+(p.brandSrc==='inferred'?' <span class="mut small">('+esc(T('brandInferred'))+')</span>':''):'<span class="brand nob">'+esc(T(p.brandSrc==='unknown'?'brandInName':'noBrand'))+'</span>';
const shortName=p=>p.name.replace(/\s*\((\d[^)]*|kg|ea|each|\d+pk)\)\s*$/i,'');
const nameHasSize=p=>{const z=sizeTxt(p);return !z||NZS.norm(p.name).replace(/\s+/g,'').includes(z.replace(/\s+/g,''))};
const sizeTxt=p=>p.size==='kg'?'kg':p.size==='ea'?'':p.size;
const chainsOf=p=>[...new Set(p.of.map(o=>o.slot.chain))].map(c=>CHAIN_NAME[c]).join(' · ');
const typeName=t=>T('t_'+t);
// ---- v1.3.4: product photos from Open Food Facts (photos CC BY-SA, index ODbL) ----
// Matched ONLY by exact barcode: Baskt gives a GTIN for Woolworths items; a card uses the first GTIN of its items that has
// a front photo in data/img/NN.json (built offline from the OFF bulk export; NN = GTIN mod 64). No name guessing (tested:
// name+brand matching was right only ~51-62 % of the time). Photos load lazily, straight from images.openfoodfacts.org;
// each photo links to its Open Food Facts product page (attribution). No supermarket images are used.
const OFF_IMG='https://images.openfoodfacts.org/images/products/',OFF_PROD='https://world.openfoodfacts.org/product/';
const IMGSH=new Map(); // shard -> {data|null, p:Promise}
const g13=g=>{const d=String(g||'').replace(/\D/g,'').replace(/^0+/,'');return d.length>=8&&d.length<=14?d.padStart(13,'0'):null};
const shardOf=g=>String(Number(g.slice(-6))%64).padStart(2,'0'); // = GTIN mod 64 (10^6 is a multiple of 64)
function loadShard(k){let s=IMGSH.get(k);if(!s){s={data:null};s.p=fetch('data/img/'+k+'.json').then(r=>r.ok?r.json():{i:{}}).then(j=>{s.data=j.i||{};return s.data}).catch(()=>{s.data={};return s.data});IMGSH.set(k,s)}return s}
const gtinsOf=p=>[...new Set(p.items.map(it=>g13(it.gtin)).filter(Boolean))];
function photoOf(p){for(const g of gtinsOf(p)){const s=IMGSH.get(shardOf(g));if(!s||!s.data)continue;const v=s.data[g];if(v){const[l,r]=v.split('.');
  return{g,src:OFF_IMG+g.slice(0,3)+'/'+g.slice(3,6)+'/'+g.slice(6,9)+'/'+g.slice(9)+'/front_'+l+'.'+r+'.200.jpg'}}}return null}
const photoHtml=(f,alt)=>'<a class="thumb photo" href="'+OFF_PROD+f.g+'" target="_blank" rel="noopener" title="'+esc(T('imgTitle'))+'"><img src="'+f.src+'" alt="'+esc(alt)+'" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="56" height="56"></a>';
function thumbHtml(p){const f=photoOf(p);if(f)return photoHtml(f,p.name);const gs=gtinsOf(p);
 return gs.length&&gs.some(g=>{const s=IMGSH.get(shardOf(g));return!s||!s.data})?icon(p.type).replace('class="thumb"','class="thumb" data-gt="'+esc(p.key)+'"'):icon(p.type)}
function fillPhotos(box,G){const els=[...box.querySelectorAll('.thumb[data-gt]')];if(!els.length)return;const need=new Set();
 for(const e of els){const p=G.prods.find(x=>x.key===e.dataset.gt);if(p)for(const g of gtinsOf(p))need.add(shardOf(g))}
 Promise.all([...need].map(k=>loadShard(k).p)).then(()=>{for(const e of els){if(!e.isConnected)continue;const p=G.prods.find(x=>x.key===e.dataset.gt);if(!p)continue;
  const f=photoOf(p);if(f)e.outerHTML=photoHtml(f,p.name);else e.removeAttribute('data-gt')}})}
document.addEventListener('error',e=>{const t=e.target;if(t&&t.tagName==='IMG'&&t.parentNode&&t.parentNode.classList&&t.parentNode.classList.contains('photo')){const c=t.closest('.card');t.parentNode.outerHTML=icon(c?c.dataset.type:'other')}},true); // photo missing -> icon
function prodCard(p,open,words){const show=open?p.of:p.of.slice(0,1);const id=esc(p.key);
 return '<article class="card prod" data-key="'+id+'" data-type="'+p.type+'" data-cents="'+p.best.c+'">'+
 '<div class="ph">'+thumbHtml(p)+'<div class="pn"><div class="bl">'+brandHtml(p)+'</div><h3>'+hl(p.name,words)+'</h3>'+
 '<div class="mut small">'+esc([sizeTxt(p),p.sub.organic?T('organic'):''].filter(Boolean).join(' · '))+(sizeTxt(p)?' · ':'')+esc(T('chainsCarry',{list:chainsOf(p)}))+'</div></div>'+
 '<div class="pb"><div class="price cheap">'+money(p.best.c)+'</div>'+(p.unit?'<div class="unitp">'+esc(unitTxt(p.unit))+'</div>':'')+'</div></div>'+
 show.map((o,j)=>offerHtml(o.item,o,j===0)).join('')+
 '<div class="row acts">'+(p.of.length>1?'<button class="sec more" data-key="'+id+'" aria-expanded="'+(!!open)+'">'+esc(open?T('showLess'):T('showAll',{n:p.of.length}))+'</button>':'')+
 '<button class="sec hbtn" data-key="'+id+'" aria-expanded="'+histOpen.has(p.key)+'"><span aria-hidden="true">📈 </span>'+esc(T('histBtn'))+'</button>'+
 '<button class="pri add" data-key="'+id+'">'+esc(T('add'))+'</button></div>'+(histOpen.has(p.key)?'<div class="histBox" data-key="'+id+'"></div>':'')+'<div class="chooserBox"></div></article>'}
// ===== v1.5.0: price history, last 3 months, straight from Baskt's history (via the Worker), per store =====
// Tapping a product asks the Worker for /api/v1/items/history for the item at each of the (up to) 6 nearest stores.
// Every point is a date on which Baskt observed that price; lines are steps between observations and stop at the
// last observation (nothing is extended or guessed). If Baskt fails or has nothing for a store, the v1.4 weekly files
// data/history/NN.json (NN = itemId mod 16) are used for that store and marked "backup". No data -> "no records".
const histOpen=new Set(),HSH=new Map(),HB=new Map(),HKEEP=92,HMAX=6,HCOL=['#0b5394','#c0392b','#1b7f3b','#8e44ad','#b9770e','#4a4a4a'],HDASH=['','6 3','2 2','8 3 2 3','4 4','1 3'];
const hShard=id=>String(Number(id)%16).padStart(2,'0');
function loadHist(k){let s=HSH.get(k);if(!s){s={data:null};s.p=fetch('data/history/'+k+'.json').then(r=>{if(!r.ok)throw 0;return r.json()}).then(j=>{s.data=j;return j}).catch(()=>{s.data={h:{},fail:1};return s.data});HSH.set(k,s)}return s}
const nzYmd=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Pacific/Auckland',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
const hDay=ymd=>Math.round((Date.parse(ymd+'T00:00:00Z')-Date.parse('2026-01-01T00:00:00Z'))/864e5);
const hDate=(d,base)=>{try{return new Intl.DateTimeFormat(LOC[LANG],{timeZone:'UTC',month:'short',day:'numeric'}).format(new Date(Date.parse((base||'2026-01-01')+'T00:00:00Z')+d*864e5))}catch(e){return String(d)}};
const hFrom=()=>nzYmd(Date.now()-HKEEP*864e5); // same value all day -> the Worker's 12-hour cache is shared by everyone
// Baskt history of one item at one store: {st:'ok'|'empty'|'err'|'cap', obs:[{t,c,promo}], at}
function loadB(id,loc){const k=id+'|'+loc;let b=HB.get(k);if(b)return b;b={st:null};HB.set(k,b);
 const u=new URL(PROXY+'/api/v1/items/history');u.searchParams.set('itemId',id);u.searchParams.set('locationId',loc);u.searchParams.set('from',hFrom());u.searchParams.set('limit','100');
 b.p=fetch(u,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer'}).then(async r=>{
  if(!r.ok){let e={};try{e=await r.json()}catch(x){}b.st=e&&e.error==='daily_cap'?'cap':'err';if(b.st==='err')HB.delete(k);return b} // errors are not remembered: tap again = try again
  const j=await r.json(),ob=((j&&j.data&&j.data.observations)||[]).filter(o=>String(o.locationId)===String(loc)&&Number.isInteger(o.priceCents)&&o.priceCents>0&&o.observedAt);
  b.obs=ob.map(o=>({t:o.observedAt,c:o.priceCents,promo:!!o.promoFlag})).sort((x,y)=>Date.parse(x.t)-Date.parse(y.t));b.at=r.headers.get('X-Fetched-At');b.st=b.obs.length?'ok':'empty';return b})
 .catch(()=>{b.st='err';HB.delete(k);return b});return b}
function histTargets(p){const seen=new Set(),out=[];for(const o of [...p.of].sort((a,b)=>a.slot.d-b.slot.d)){if(seen.has(o.slot.key))continue;seen.add(o.slot.key);out.push(o)}return out}
function histSeries(p){const today=hDay(nzYmd(Date.now())),cut=today-HKEEP,all=histTargets(p),tg=all.slice(0,HMAX),out=[];let start=null,at=null,err=0,cap=0,fb=0;
 for(const o of tg){const s=o.slot,id=String(o.item.id),b=HB.get(id+'|'+s.loc),pts=new Map();let src='';
  if(b&&b.st==='ok'){src='b';if(b.at&&(!at||b.at>at))at=b.at;
   for(const x of b.obs){const d=hDay(nzYmd(x.t));if(d<cut||d>today+1)continue;pts.set(d,{c:x.c,promo:x.promo,t:x.t})}} // latest observation of each day wins
  else{if(b&&b.st==='cap')cap++;else if(!b||b.st!=='empty')err++;
   const sh=HSH.get(hShard(id)),g=sh&&sh.data&&sh.data.h&&sh.data.h[id]; // fallback: v1.4 weekly files
   if(g)for(const[locs,flat]of Object.entries(g)){if(!locs.split(',').includes(String(s.loc)))continue;
    for(let i=0;i<flat.length;i+=2){const d=flat[i],c=flat[i+1];if(d<cut||d>today+1)continue;const v=pts.get(d);if(!v||c<v.c)pts.set(d,{c})}}
   if(pts.size){src='f';fb++;if(sh.data.s&&(!start||sh.data.s<start))start=sh.data.s}}
  if(src&&o.obs&&o.c){const d=hDay(nzYmd(o.obs));if(d>=cut&&d<=today+1&&!pts.has(d))pts.set(d,{c:o.c,t:o.obs})} // the card's price is Baskt's newest observation; only added to a store that has history (else: "no records")
  const pa=[...pts.entries()].sort((a,b)=>a[0]-b[0]),cs=pa.map(x=>x[1].c);
  out.push({slot:s,src,pts:pa,cur:cs.length?cs[cs.length-1]:null,min:cs.length?Math.min(...cs):null,max:cs.length?Math.max(...cs):null})}
 return{series:out,today,start,at,err,cap,fb,more:Math.max(0,all.length-tg.length)}}
const hObs=x=>x.pts.map(q=>esc(hDate(q[0]))+' '+money(q[1].c)+(q[1].promo?' ('+esc(T('histPromo'))+')':'')).join(' · ');
function histHtml(p){const hs=histSeries(p),today=hs.today,gm=new Map(); // stores with exactly the same record share one line
 for(const x of hs.series){const k=x.src+'#'+x.pts.map(q=>q[0]+':'+q[1].c).join(';');const g=x.pts.length?gm.get(k):null;if(g){g.slot={label:g.slot.label+' · '+x.slot.label,d:Math.min(g.slot.d,x.slot.d)};g.n++}else gm.set(x.pts.length?k:'none'+gm.size,{...x,n:1})}
 const shown=[...gm.values()],plot=shown.filter(x=>x.pts.length);const head='<h4 class="hh">'+esc(T('histTitle'))+'</h4>';
 const notes=[T('histNoteB',{n:HMAX})];if(hs.at)notes.push(T('histFetched',{t:ago(hs.at)}));if(hs.fb)notes.push(T('histFbNote',{d:hs.start?hDate(hDay(hs.start)):'—'}));
 if(hs.cap)notes.push(T('histCapNote'));else if(hs.err)notes.push(T('histErrNote'));if(hs.more)notes.push(T('histMore',{n:hs.more}));
 const note='<p class="mut small hnote">'+notes.map(esc).join(' ')+' '+esc(T('histSrc'))+' <a href="https://www.baskt.nz/" target="_blank" rel="noopener">Baskt (baskt.nz)</a></p>';
 let ci=0;const col=shown.map(x=>x.pts.length?ci++:-1);
 const leg='<ul class="hleg">'+shown.map((x,i)=>{const c=col[i];return '<li>'+(c>=0?'<svg class="sw" width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" stroke="'+HCOL[c]+'" stroke-width="3"'+(HDASH[c]?' stroke-dasharray="'+HDASH[c]+'"':'')+'/></svg>':'')+'<b>'+esc(x.slot.label)+'</b>'+(x.n>1?'':' <span class="mut small">'+kmS(x.slot.d)+'</span>')+(x.src==='f'?' <span class="tag fb">'+esc(T('histFb'))+'</span>':'')+'<br><span class="small">'+
  (x.pts.length?esc(T('histNow'))+' <b>'+money(x.cur)+'</b>'+(x.pts.length>1?' · '+esc(T('histMin'))+' '+money(x.min)+' · '+esc(T('histMax'))+' '+money(x.max):'')+' · '+esc(T('histRange',{n:x.pts.length,a:hDate(x.pts[0][0]),b:hDate(x.pts[x.pts.length-1][0])}))+
   '</span><details class="hobs"><summary class="small">'+esc(T('histObs'))+'</summary><span class="small">'+hObs(x)+'</span></details>':'<b class="hnone">'+esc(T('histNoRec'))+'</b></span>')+'</li>'}).join('')+'</ul>';
 if(!plot.length)return head+'<p class="hnone">'+esc(T('histNoRec'))+'</p>'+leg+note;
 const W=320,H=150,L=44,R=8,TP=10,BT=22;let d0=Math.min(...plot.map(x=>x.pts[0][0])),d1=Math.max(today,...plot.map(x=>x.pts[x.pts.length-1][0]));if(d1-d0<7)d0=d1-7;
 let c0=Math.min(...plot.map(x=>x.min)),c1=Math.max(...plot.map(x=>x.max));if(c1-c0<20){const m=(c0+c1)/2;c0=m-10;c1=m+10}const pad=(c1-c0)*.08;c0-=pad;c1+=pad;
 const X=d=>(L+(d-d0)/(d1-d0)*(W-L-R)).toFixed(1),Y=c=>(TP+(c1-c)/(c1-c0)*(H-TP-BT)).toFixed(1);
 let g='<line x1="'+L+'" y1="'+(H-BT)+'" x2="'+(W-R)+'" y2="'+(H-BT)+'" stroke="#bbb"/><line x1="'+L+'" y1="'+TP+'" x2="'+L+'" y2="'+(H-BT)+'" stroke="#bbb"/>';
 const lo=Math.min(...plot.map(x=>x.min)),hi=Math.max(...plot.map(x=>x.max));
 for(const c of lo===hi?[lo]:[lo,hi])g+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(c)+'" y2="'+Y(c)+'" stroke="#e3e3e3"/><text x="'+(L-4)+'" y="'+(+Y(c)+4)+'" text-anchor="end" font-size="11" fill="#333">'+money(c)+'</text>';
 g+='<text x="'+L+'" y="'+(H-6)+'" font-size="11" fill="#333">'+esc(hDate(d0))+'</text><text x="'+(W-R)+'" y="'+(H-6)+'" font-size="11" fill="#333" text-anchor="end">'+esc(hDate(d1))+'</text>';
 shown.forEach((x,i)=>{const c=col[i];if(c<0)return;if(x.pts.length>=2){let dd='M'+X(x.pts[0][0])+' '+Y(x.pts[0][1].c);for(let k=1;k<x.pts.length;k++)dd+=' H'+X(x.pts[k][0])+' V'+Y(x.pts[k][1].c); // step line, ends at the last observation
   g+='<path d="'+dd+'" fill="none" stroke="'+HCOL[c]+'" stroke-width="2.2"'+(HDASH[c]?' stroke-dasharray="'+HDASH[c]+'"':'')+'/>'}
  g+=x.pts.map(q=>'<circle cx="'+X(q[0])+'" cy="'+Y(q[1].c)+'" r="2.8" fill="'+HCOL[c]+'"><title>'+esc(x.slot.label+': '+hDate(q[0])+' '+money(q[1].c))+'</title></circle>').join('')});
 const lbl=T('histAria',{name:p.name});
 return head+'<svg class="hsvg" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(lbl)+'"><title>'+esc(lbl)+'</title>'+g+'</svg>'+leg+note}
function fillHist(box,G){const els=[...box.querySelectorAll('.histBox')];if(!els.length)return;
 for(const e of els){const p=G.prods.find(x=>x.key===e.dataset.key);if(!p){e.remove();continue}
  const tg=histTargets(p).slice(0,HMAX),bs=tg.map(o=>loadB(String(o.item.id),o.slot.loc));
  const draw=()=>{if(!e.isConnected)return;e.innerHTML='<section class="hist" aria-live="polite">'+histHtml(p)+'</section>'};
  const step2=()=>{const ks=[...new Set(tg.filter((o,i)=>bs[i].st!=='ok').map(o=>hShard(o.item.id)))]; // fallback shards only where Baskt gave nothing
   ks.forEach(loadHist);if(ks.every(k=>HSH.get(k).data))draw();else Promise.all(ks.map(k=>HSH.get(k).p)).then(draw)};
  if(bs.every(b=>b.st))step2();else{e.innerHTML='<p class="mut small"><span class="spin" aria-hidden="true"></span>'+esc(T('histLoading'))+'</p>';Promise.all(bs.map(b=>b.p)).then(step2)}}}
function toggleHist(b,G){const k=b.dataset.key,art=b.closest('.prod');if(!art)return;
 if(histOpen.has(k)){histOpen.delete(k);const e=art.querySelector('.histBox');if(e)e.remove();b.setAttribute('aria-expanded','false');return}
 histOpen.add(k);b.setAttribute('aria-expanded','true');const e=document.createElement('div');e.className='histBox';e.dataset.key=k;art.querySelector('.chooserBox').before(e);fillHist(art,G)}
// ---- search UI state ----
let view={run:null,type:'all',cmp:null,shown:{}};const openCards=new Set();
function bindCards(box,G){fillPhotos(box,G);fillHist(box,G);
 box.querySelectorAll('.hbtn').forEach(b=>b.onclick=()=>toggleHist(b,G));
 box.querySelectorAll('.prod .pn h3').forEach(h=>h.onclick=()=>{const b=h.closest('.prod').querySelector('.hbtn');if(b)toggleHist(b,G)}); // v1.4.0: tap the product name = open/close its price history
box.querySelectorAll('.more').forEach(b=>b.onclick=()=>{const k=b.dataset.key;openCards.has(k)?openCards.delete(k):openCards.add(k);renderResults()});
 box.querySelectorAll('.add').forEach(b=>b.onclick=()=>{const p=G.prods.find(x=>x.key===b.dataset.key);if(p)addFlow(p,b)});
 [...box.querySelectorAll('[data-cat]'),...document.querySelectorAll('#cats [data-cat]')].forEach(b=>b.onclick=()=>{view.type=b.dataset.cat;renderResults();$('#cats').scrollIntoView({block:'nearest'})});
 box.querySelectorAll('[data-bexp]').forEach(b=>b.onclick=()=>{view.shown[b.dataset.bexp]=1;renderResults()});
 box.querySelectorAll('[data-bmore]').forEach(b=>b.onclick=()=>{view.shown._b=(view.shown._b||10)+10;renderResults()});
 box.querySelectorAll('[data-showmore]').forEach(b=>b.onclick=()=>{view.shown[b.dataset.showmore]=(view.shown[b.dataset.showmore]||40)+40;renderResults()})}
function statusLine(run,G){const pl=run.pl;let h='';
 if(run.errs.length&&run.finished)h+='<div class="err">'+esc(run.items.size?T('partialChains',{chains:[...run.failedChains].map(c=>CHAIN_NAME[c]||c).join(', ')}):T('allFailed'))+' <button type="button" class="sec" id="retryBtn">'+esc(T('retryBtn'))+'</button></div>';
 if(!run.finished)h+='<div class="loading" aria-busy="true"><span class="spin" aria-hidden="true"></span>'+esc(T('loadingN',{a:run.done,b:run.total}))+'</div>';
 if(run.mapped)h+='<div class="mut small">'+esc(T('mapped',{en:pl.phrase+(pl.size?' '+pl.size:'')}))+'</div>';
 if(G.prods.length)h+='<b>'+esc(T('resSummary',{q:run.q,n:G.prods.length,m:G.types.length}))+'</b>'+(run.fetchedAt?' <span class="mut small">· '+esc(T('fetchedAt',{t:fmtT(run.fetchedAt)}))+'</span>':'');
 else if(run.finished&&!run.errs.length)h+='<p class="panel nores">'+esc(T('sNoneFriendly',{q:run.q}))+'</p>';
 if(here&&(G.prods.length||run.finished))h+='<div class="mut small scope">'+esc(T('cmpScope',{place:mode==='gps'?T('youHere'):sel.place,r:radius,n:priceSlots().length}))+'</div>';
 return h}
function renderResults(){const box=$('#results'),run=view.run;$('#cats').innerHTML='';
 if(!run){box.innerHTML='';$('#sSt').innerHTML=view.msg||'';$('#moreWrap').innerHTML='';return}
 if(!here){$('#sSt').innerHTML='<span class="err">'+esc(T('needLoc'))+'</span>';box.innerHTML='';return}
 const G=groupRun(run);const words=run.pl.words;$('#sSt').innerHTML=statusLine(run,G);const rb=$('#retryBtn');if(rb)rb.onclick=()=>retrySearch(run);
 if(view.cmp){renderCmp(G,words);return}
 if(view.type!=='all'&&!G.types.some(t=>t.type===view.type))view.type='all';
 if(G.types.length)$('#cats').innerHTML='<span class="sr">'+esc(T('typesLabel'))+'</span><button data-cat="all" aria-pressed="'+(view.type==='all')+'">'+esc(T('catAll'))+' <span class="n">'+G.prods.length+'</span></button>'+
  G.types.map(t=>'<button data-cat="'+t.type+'" aria-pressed="'+(view.type===t.type)+'">'+esc(typeName(t.type))+' <span class="n">'+t.prods.length+'</span></button>').join('');
 let h='';
 // v1.3.2: brand groups (all categories, or only the chosen category chip). Inside a group: cheapest first.
 const bl=view.type==='all'?G.brands:G.brands.map(g=>({...g,prods:g.prods.filter(p=>p.type===view.type)})).filter(g=>g.prods.length);
 const nb=view.shown._b||10;h+='<p class="mut small bcount">'+esc(T('bCount',{n:bl.length}))+'</p>';
 for(const g of bl.slice(0,nb))h+=brandGrpHtml(g,words,view.shown[g.key]?g.prods.length:3);
 if(bl.length>nb)h+='<button class="sec wide" data-bmore="1">'+esc(T('bMore',{n:bl.length-nb}))+'</button>';
 box.innerHTML=h;bindCards(box,G);
 const more=run.finished&&Object.keys(run.more).length;$('#moreWrap').innerHTML=more?'<button class="sec" id="moreBtn">'+esc(T('sMore'))+'</button>':'';
 const mb=$('#moreBtn');if(mb)mb.onclick=()=>loadMore(run)}
const fromHtml=first=>esc(T('fromP',{p:'\u0001'})).replace('\u0001','<span class="cheap">'+esc(sortMode==='unit'&&first.bestU?unitTxt(first.bestU.u):money(first.best.c))+'</span>');
function brandGrpHtml(g,words,limit){const first=g.prods[0];const lbl=g.other?T('bOther'):g.label;
 return '<section class="bgrp" data-brand="'+esc(g.key)+'"><h3 class="bh">'+esc(lbl)+(g.hit?' <span class="bmatch">'+esc(T('bMatch'))+'</span>':'')+' <span class="mut small">· '+esc(T('nKinds',{n:g.prods.length}))+' · '+fromHtml(first)+'</span></h3>'+
 g.prods.slice(0,limit).map(p=>prodCard(p,openCards.has(p.key),words)).join('')+
 (g.prods.length>limit?'<button class="sec wide" data-bexp="'+esc(g.key)+'">'+esc(T('bShowAll',{n:g.prods.length,b:lbl}))+' ›</button>':'')+'</section>'}
function groupHtml(g,words,limit){const first=g.prods[0];
 const lbl=g.other?T('otherKinds'):(g.label||T('plain'));
 return '<div class="grp" data-sub="'+esc(g.key)+'"><h3 class="gh">'+esc(lbl)+' <span class="mut small">· '+esc(T('nKinds',{n:g.prods.length}))+' · '+fromHtml(first)+'</span></h3>'+
 g.prods.slice(0,limit).map(p=>prodCard(p,openCards.has(p.key),words)).join('')+'</div>'}
function renderCmp(G,words){const p=G.prods.find(x=>x.key===view.cmp);const box=$('#results');$('#moreWrap').innerHTML='';
 if(!p){box.innerHTML='<p class="panel">'+esc(T('cmpNone'))+'</p><button class="sec" id="cmpBack">'+esc(T('back'))+'</button>';$('#cmpBack').onclick=closeCmp;return}
 const t=G.types.find(x=>x.type===p.type);const g=t.groups.find(x=>x.prods.includes(p));
 const others=(g&&!g.other?g.prods:t.prods).filter(x=>x!==p).slice(0,12);
 box.innerHTML='<section id="cmp" aria-labelledby="cmpH"><button class="sec" id="cmpBack">'+esc(T('back'))+'</button><h2 id="cmpH" class="th">'+esc(T('cmpTitle'))+' · '+esc(typeName(p.type))+(g&&g.label&&!g.other?' · '+esc(g.label):'')+'</h2>'+
  prodCard(p,true,words)+(others.length?'<h3 class="gh">'+esc(T('sameGroup'))+'</h3>'+others.map(x=>prodCard(x,openCards.has(x.key),words)).join(''):'')+'</section>';
 $('#cmpBack').onclick=closeCmp;bindCards(box,G);$('#cmpBack').focus({preventScroll:true})}
function closeCmp(){view.cmp=null;renderResults()}
// v1.6.0: "Try again" re-asks only the requests that failed (the others are answered from the phone cache)
function retrySearch(run){const q=run.q;if(RUNS.get(run.key)===run)RUNS.delete(run.key);const r2=openRun(q,{type:view.type});if(r2)r2.q=q}
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
 if(sugRun===null&&sugComp.length){h+='<li class="hint" role="presentation">'+esc(T('sugPick'))+'</li>'+sugComp.map((c,i)=>{sugItems.push({kind:'term',term:c.term});return '<li role="option" id="sg'+i+'" class="opt term" data-i="'+i+'"><span class="nm">'+esc(c.term)+(c.brand?' <span class="mut small">· '+esc(T('brandTag'))+'</span>':c.term!==c.en?' <span class="mut small">('+esc(c.en)+')</span>':'')+'</span></li>'}).join('')}
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
 const score=p=>[p.hit?0:1,p.own&&p.sub.mode==='v'?0:(p.type==='fruit'||p.type==='veg')?1:2,p.pop<0?99:p.pop,-Math.min(p.of.length,30),p.name.split(' ').length];
 const cmp=(a,b)=>{const x=score(a),y=score(b);for(let i=0;i<5;i++)if(x[i]!==y[i])return x[i]-y[i];return a.best.c-b.best.c};
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
  if(!pl||(!r.mapped&&text.length<4&&!NZS.C[NZS.singular(text.toLowerCase())])||(!r.brand&&!r.mapped&&!NZS.C[NZS.singular(NZS.norm(text))]&&!NZS.TERM.has(text.toLowerCase())&&NZS.complete(text,LANG).some(c=>c.brand))){ // v1.3.2: also complete brand names (tip -> Tip Top, anch -> Anchor) // short/partial word: complete from the word list (0 requests)
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
// ===== v1.6.0 photo → food guess: recognised on the phone (photo/photo.js, loaded only after 📷 is tapped) =====
let photoP=null,camUrl=null;const camBox=$('#camBox');
function photoLib(){if(!photoP)photoP=new Promise((ok,no)=>{if(window.NZGPhoto)return ok(window.NZGPhoto);const s=document.createElement('script');s.src='photo/photo.js?v=1.6.0';
 s.onload=()=>window.NZGPhoto?ok(window.NZGPhoto):no(new Error('photo'));s.onerror=()=>no(new Error('photo.js'));document.head.appendChild(s)});photoP.catch(()=>{photoP=null});return photoP}
function camProg(p){const e=$('#camSt');if(e)e.textContent=p>=1?T('camThinking'):T('camLoading',{p:Math.round(p*100)});const b=$('#camBar');if(b)b.value=p}
function camPick(inp){inp.value='';inp.click();photoLib().then(P=>P.init(camProg)).catch(()=>{})} // start the one-time download while the camera is open
$('#camBtn').onclick=()=>camPick($('#camIn'));$('#galBtn').onclick=()=>camPick($('#galIn'));
const camName=o=>LANG==='zh-Hant'?o.zh+' '+o.en:LANG==='zh-Hans'?o.zs+' '+o.en:o.en;
async function camFile(f){if(!f)return;if(camUrl)URL.revokeObjectURL(camUrl);camUrl=URL.createObjectURL(f);const img='<img class="camPrev" alt="" src="'+camUrl+'">';
 camBox.innerHTML=img+'<div style="flex:1"><span class="small" id="camSt">'+esc(T('camThinking'))+'</span><progress class="camProg" id="camBar" max="1" value="0"></progress></div>';
 try{const P=await photoLib();const r=await P.classify(f,camProg);NZG_TEST.lastPhoto=r;
  camBox.innerHTML=img+'<div style="flex:1;min-width:0"><b class="small">'+esc(T('camGuess'))+'</b><div class="chips" id="camChips">'+
   r.top.map(o=>'<button type="button" data-q="'+esc(o.q)+'">'+esc(camName(o))+'<span class="pc">'+(o.p<0.01?'&lt;1':Math.round(o.p*100))+'%</span></button>').join('')+'</div>'+
   (r.top[0].p<0.3?'<p class="small" style="margin:0;color:var(--warn)">'+esc(T('camUnsure'))+'</p>':'')+
   '<p class="mut small" style="margin:.1rem 0 0">'+esc(T('camFix'))+' · '+esc(T('camTime',{s:(r.ms/1000).toFixed(1)}))+'</p></div>';
  camBox.querySelectorAll('#camChips button').forEach(b=>b.onclick=()=>{camBox.querySelectorAll('#camChips button').forEach(x=>x.setAttribute('aria-pressed',x===b));qIn.value=b.dataset.q;doSearch();$('#sSt').scrollIntoView({block:'start',behavior:'smooth'})});
 }catch(e){console.warn(e);camBox.innerHTML=img+'<p class="small" style="flex:1;color:var(--warn)">'+esc(T('camErr'))+'</p>'}}
$('#camIn').onchange=e=>camFile(e.target.files[0]);$('#galIn').onchange=e=>camFile(e.target.files[0]);
$('#sortP').onclick=()=>{sortMode='price';$('#sortP').setAttribute('aria-pressed',true);$('#sortU').setAttribute('aria-pressed',false);renderResults()};
$('#sortU').onclick=()=>{sortMode='unit';$('#sortU').setAttribute('aria-pressed',true);$('#sortP').setAttribute('aria-pressed',false);renderResults()};
window.NZG_TEST={NET,RUNS,RC,INFL,histSeries,HSH,HB,histTargets,get view(){return view},groupRun,priceSlots,get sel(){return sel},get PLACES(){return PLACES},pqSearch,get ALIAS(){return ALIAS}};
function offerHtml(p,o,best){const s=o.slot;
 return '<div class="pl'+(best?' best':'')+'" data-loc="'+esc(s.loc)+'" data-cents="'+o.c+'"><div class="who"><b>'+esc(s.label)+'</b> <span class="mut small">'+kmS(s.d)+'</span>'+
 (s.zone?'<div class="mut small">'+esc(T('nearestBranch',{store:s.store.name,d:kmS(s.d)}))+'</div>':'')+
 '<div class="mut small rec" data-obs="'+esc(o.obs)+'">'+esc(T('rec',{t:fmtT(o.obs)}))+' ('+esc(ago(o.obs))+')</div>'+
 '<a href="'+esc(productUrl(p))+'" target="_blank" rel="noopener" class="vlink">'+esc(T('verify'))+' ↗</a>'+(s.zone?'':' <span class="mut small">('+esc(T('verifyStore'))+')</span>')+'</div>'+
 '<div class="amt">'+(best?'<div class="badge">'+esc(T('cheapest'))+'</div>':'')+'<div class="price">'+money(o.c)+'</div>'+(o.u&&o.um?'<div class="mut small">'+esc(T('unit',{p:money(o.u),u:o.um}))+'</div>':'')+'</div></div>'} // v1.3.3: no 'Special' label (own use); only the cheapest price is red
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
  for(const p of d.prices||[])if(locSet.has(String(p.locationId)))pr[p.locationId]={c:p.priceCents,u:p.unitPriceCents,um:p.unitMeasure,obs:p.observedAt};
  it.prices=pr;it.savedAt=new Date().toISOString()}
 saveList();renderList();st.innerHTML=err?'<span class="err">'+esc(T('err',{msg:err}))+'</span>':esc(T('updated'))};
// ===== render all =====
function renderAll(){pickRender();if(pqOpen)pqRender();renderLoc();renderStores();renderResults();if(typeof sugRun!=='undefined'&&sugRun&&!sug.hidden)sugRender();if(!$('#v-list').hidden)renderList()}
// ===== PWA =====
let deferredPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').hidden=false});
$('#installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').hidden=true};
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
// ===== boot =====
setRadius(radius);
Promise.all(['data/stores.json','data/places.json'].map(u=>fetch(u).then(r=>{if(!r.ok)throw new Error('HTTP '+r.status);return r.json()})).concat(fetch('data/aliases.json').then(r=>r.ok?r.json():{aliases:[]}).catch(()=>({aliases:[]})))).then(([d,p,al])=>{DATA=d;PLACES=p;
 ALIAS={};for(const x of (al&&al.aliases)||[])ALIAS[x.city+'|'+x.area+'|'+x.place]=[x.zh,x.zhs];
 if(sel.place){const c=cityOf(sel.city),a=areaOf(c,sel.area),pl=placeOf(a,sel.place);if(pl){mode='place';here=[pl[1],pl[2]];hereLabel=sel.place}else sel={city:c?sel.city:'',area:a?sel.area:'',place:''}}
 applyLang()}).catch(e=>{$('#locSt').innerHTML='<span class="err">'+esc(T('err',{msg:e.message}))+'</span>'});
applyLang();
