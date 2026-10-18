'use strict';
// ===== config =====
const PROXY="https://nzgrocery-proxy.ytonywong.workers.dev";
const VERSION="1.0.0 (2026-10-18)";
const CHAIN_NAME={"paknsave":"PAK'nSAVE","new-world":"New World","countdown":"Woolworths","farro":"Farro","other":""};
const SEARCH_CHAINS=["paknsave","new-world","countdown","farro"];
const AREAS=[["CBD","Auckland CBD",-36.8485,174.7633],["Manukau","Manukau",-36.9928,174.8799],["Albany","Albany",-36.7275,174.6950],["Henderson","Henderson",-36.8785,174.6310],["Botany","Botany",-36.9318,174.9116],["Mt Roskill","Mt Roskill",-36.9100,174.7370]];
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
let DATA=null,here=null,hereLabel='',radius=+localStorage.getItem('nzgRadius')||20,filter='all',sortMode='price';
let lastSearch=null; // {q, products:Map, offsets:{chain:n|null}, fetchedAt}
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
 $('#r20').textContent=T('km',{n:20});$('#r30').textContent=T('km',{n:30});
 $('#area').innerHTML='<option value="">'+esc(T('areaPick'))+'</option>'+AREAS.map(a=>'<option value="'+esc(a[0])+'">'+esc(a[1])+'</option>').join('');
 if(hereLabel&&hereLabel!=='gps')$('#area').value=hereLabel;
 $('#ver').textContent='v'+VERSION+(DATA?' · OSM '+DATA.osmTimestamp.slice(0,10):'');
 renderAll()}
langSel.onchange=()=>{LANG=langSel.value;localStorage.setItem('nzgLang',LANG);applyLang()};
// ===== tabs =====
const TABS=['stores','search','list'];
function showTab(t){for(const x of TABS){$('#tb-'+x).setAttribute('aria-selected',x===t);$('#v-'+x).hidden=x!==t}if(t==='list')renderList()}
TABS.forEach(t=>$('#tb-'+t).onclick=()=>showTab(t));
// ===== location =====
function setRadius(r){radius=r;localStorage.setItem('nzgRadius',r);$('#r20').setAttribute('aria-pressed',r===20);$('#r30').setAttribute('aria-pressed',r===30);renderAll()}
$('#r20').onclick=()=>setRadius(20);$('#r30').onclick=()=>setRadius(30);
$('#locBtn').onclick=()=>{if(!navigator.geolocation){$('#locSt').textContent=T('locDenied',{msg:'n/a'});return}
 $('#locSt').textContent=T('locAsking');
 navigator.geolocation.getCurrentPosition(p=>{here=[p.coords.latitude,p.coords.longitude];hereLabel='gps';$('#area').value='';renderAll()},
  e=>{$('#locSt').innerHTML='<span class="err">'+esc(T('locDenied',{msg:e.message||e.code}))+'</span>'},{enableHighAccuracy:false,timeout:15000,maximumAge:0})};
$('#area').onchange=e=>{const a=AREAS.find(x=>x[0]===e.target.value);if(a){here=[a[2],a[3]];hereLabel=a[0]}else{here=null;hereLabel=''}renderAll()};
function renderLoc(){const st=$('#locSt');if(!here){st.textContent=T('locNone');return}
 const ns=nearby();const p=ns.filter(s=>s.kind==='priced'||s.kind==='zone').length;
 const from=hereLabel==='gps'?T('locHere'):T('locArea',{area:(AREAS.find(a=>a[0]===hereLabel)||[0,hereLabel])[1]});
 const outside=hv(here[0],here[1],-36.8485,174.7633)>70;
 st.innerHTML=esc(from)+' · '+esc(T('found',{n:ns.length,p}))+(outside?'<br><span class="err">'+esc(T('outside'))+'</span>':'')}
// ===== stores tab =====
const FILTERS=[['all','fAll'],['priced','fPriced'],['cn','fCn'],['ko','fKo'],['other','fOther']];
function renderStores(){
 $('#chips').innerHTML=FILTERS.map(([k,l])=>'<button data-f="'+k+'" aria-pressed="'+(filter===k)+'">'+esc(T(l))+'</button>').join('');
 $('#chips').querySelectorAll('button').forEach(b=>b.onclick=()=>{filter=b.dataset.f;renderStores()});
 const box=$('#storeList');if(!here){box.innerHTML='<p class="panel">'+esc(T('needLoc'))+'</p>';return}
 const ns=nearby().filter(s=>filter==='all'||(filter==='priced'?(s.kind==='priced'||s.kind==='zone'):filter==='other'?(s.kind==='other'||s.kind==='noprice'):s.kind===filter));
 box.innerHTML=ns.map(s=>{const k={priced:['','kPriced'],zone:['','kZone'],cn:['cn','kCn'],ko:['ko','kKo'],other:['o','kOther'],noprice:['o','kNoprice']}[s.kind];
  const nm=s.nameZh&&LANG.startsWith('zh')&&!s.name.includes(s.nameZh)?s.nameZh+' '+s.name:s.name;
  return '<article class="card" data-kind="'+s.kind+'"><span class="dist">'+kmS(s.d)+'</span><h3>'+esc(nm)+'</h3>'+(s.addr?'<div class="mut small">'+esc(s.addr)+'</div>':'')+
  '<span class="badge '+k[0]+'">'+esc(T(k[1]))+'</span><div class="links">'+(s.web?'<a href="'+esc(s.web)+'" target="_blank" rel="noopener">'+esc(T('web'))+' ↗</a>':'')+
  '<a href="'+gmap(s)+'" target="_blank" rel="noopener">'+esc(T('nav'))+'</a><a href="'+amap(s)+'" target="_blank" rel="noopener">'+esc(T('apple'))+'</a></div></article>'}).join('');
}
// ===== search =====
function ingest(json,chain,products){const d=json.data||{};const locSet=new Set(DATA.chainLocIds[chain]||[]);
 for(const it of d.items||[]){if(!products.has(it.id))products.set(it.id,{id:it.id,chain:it.chain||chain,name:it.name,brand:it.brand,size:it.packSize,sku:it.externalSku,prices:{}})}
 for(const p of d.latestPrices||[]){const pr=products.get(p.itemId);if(!pr||!locSet.has(String(p.locationId)))continue;
  pr.prices[p.locationId]={c:p.priceCents,u:p.unitPriceCents,um:p.unitMeasure,promo:p.promoFlag?(p.promoLabel||1):0,obs:p.observedAt}}}
// Baskt "q" is a plain substring match on the product name (no brand, sorted A–Z), so we
// build a per-chain query: Foodstuffs names end in "(2l)", Farro in "2l", Woolworths keeps size separate.
const SIZE_RE=/^(\d+(?:\.\d+)?)\s*(l|ml|g|kg|pk|ea)$/i;
function parseQuery(q){const words=[],raw=q.toLowerCase().replace(/(\d)\s+(l|ml|g|kg|pk)\b/g,'$1$2').split(/\s+/).filter(Boolean);let size=null;
 for(const w of raw){const m=w.match(SIZE_RE);if(m&&!size)size=(+m[1])+m[2].toLowerCase();else words.push(w)}return{words,size}}
function chainQuery(c,pq){const w=pq.words.join(' ');if(!pq.size)return w;
 if(c==='paknsave'||c==='new-world')return w?w+' ('+pq.size+')':'('+pq.size+')';
 if(c==='farro')return w?w+' '+pq.size:pq.size;return w||pq.size}
function matchesQuery(it,pq){const hay=(it.name+' '+(it.brand||'')+' '+(it.packSize||'')).toLowerCase().replace(/\s+(l|ml|g|kg)\b/g,'$1');
 if(!pq.words.every(w=>hay.includes(w)))return false;if(pq.size&&!hay.replace(/[()]/g,' ').split(/[\s,]+/).includes(pq.size))return false;return true}
async function runSearch(q,more){
 if(!DATA)return;if(!more){const pq=parseQuery(q);lastSearch={q,pq,products:new Map(),st:Object.fromEntries(SEARCH_CHAINS.map(c=>[c,{q:chainQuery(c,pq),offset:0,fallback:false}])),fetchedAt:null}}
 const S=lastSearch;$('#sSt').textContent=T('searching');$('#moreWrap').innerHTML='';
 const errs=[];
 await Promise.all(SEARCH_CHAINS.filter(c=>S.st[c].offset!==null&&DATA.chainLocIds[c]).map(async c=>{const st=S.st[c];
  for(let attempt=0;attempt<2;attempt++){
   if(!st.q||st.q.length<2){st.offset=null;return}
   // locationId = ALL Auckland Baskt locations of the chain (the same for every user) → no location leak
   const params={q:st.q,chain:c,locationId:DATA.chainLocIds[c].join(','),limit:25};if(st.offset)params.offset=st.offset;
   try{const r=await api('/api/v1/items',params);const d=r.json.data||{};
    const keep={...d,items:(d.items||[]).filter(it=>matchesQuery(it,S.pq))};ingest({data:keep},c,S.products);
    const pg=d.pagination||{};st.offset=pg.hasMore?pg.nextOffset:null;if(r.fetchedAt&&(!S.fetchedAt||r.fetchedAt<S.fetchedAt))S.fetchedAt=r.fetchedAt;
    // nothing found with the full phrase (e.g. brand isn't in Foodstuffs names) → one retry with the last word
    // (usually the product: "anchor butter" → "butter"), brand/words then checked on the phone
    if(!more&&!st.fallback&&!(d.items||[]).length&&S.pq.words.length>1){st.fallback=true;st.q=chainQuery(c,{words:[S.pq.words[S.pq.words.length-1]],size:S.pq.size});st.offset=0;continue}
   }catch(e){errs.push(e.message);st.offset=null}
   return}}));
 if(S!==lastSearch)return;S.err=errs[0];renderResults()}
function offersFor(p,slots){const out=[];for(const s of slots){if(s.chain!==p.chain)continue;const pr=p.prices[s.loc];if(pr)out.push({...pr,slot:s})}
 return out.sort((a,b)=>sortMode==='unit'&&a.u&&b.u?a.u-b.u:a.c-b.c)}
const openCards=new Set();
function renderResults(){const box=$('#results'),S=lastSearch;if(!S){box.innerHTML='';$('#sSt').textContent='';return}
 if(!here){$('#sSt').innerHTML='<span class="err">'+esc(T('needLoc'))+'</span>';box.innerHTML='';return}
 const slots=priceSlots();const rows=[];
 for(const p of S.products.values()){const of=offersFor(p,slots);if(of.length)rows.push({p,of})}
 rows.sort((a,b)=>sortMode==='unit'?((a.of[0].u||1e12)-(b.of[0].u||1e12)):(a.of[0].c-b.of[0].c));
 $('#sSt').innerHTML=(S.err?'<div class="err">'+esc(T('err',{msg:S.err}))+'</div>':'')+(S.fetchedAt?esc(T('fetchedAt',{t:fmtT(S.fetchedAt)}))+' · ':'')+esc(rows.length?T('sCount',{n:rows.length}):T('sNone'));
 box.innerHTML=rows.map(({p,of},i)=>{const open=openCards.has(p.id);const show=open?of:of.slice(0,4);
  return '<article class="card prod" data-id="'+esc(p.id)+'"><h3>'+esc(p.name)+'</h3><div class="mut small">'+esc([CHAIN_NAME[p.chain],p.brand,p.size].filter(Boolean).join(' · '))+'</div>'+
  show.map((o,j)=>offerHtml(p,o,j===0)).join('')+
  (of.length>4?'<button class="sec more" data-id="'+esc(p.id)+'">'+esc(open?T('showLess'):T('showAll',{n:of.length}))+'</button> ':'')+
  '<button class="pri add" data-id="'+esc(p.id)+'">'+esc(T('add'))+'</button><div class="chooserBox"></div></article>'}).join('');
 box.querySelectorAll('.more').forEach(b=>b.onclick=()=>{const id=b.dataset.id;openCards.has(id)?openCards.delete(id):openCards.add(id);renderResults()});
 box.querySelectorAll('.add').forEach(b=>b.onclick=()=>addFlow(S.products.get(b.dataset.id),b));
 $('#moreWrap').innerHTML=Object.values(S.st).some(v=>v.offset)?'<button class="sec" id="moreBtn">'+esc(T('sMore'))+'</button>':'';
 const mb=$('#moreBtn');if(mb)mb.onclick=()=>runSearch(S.q,true)}
function offerHtml(p,o,best){const s=o.slot;
 return '<div class="pl'+(best?' best':'')+'" data-loc="'+esc(s.loc)+'" data-cents="'+o.c+'"><div class="who"><b>'+esc(s.label)+'</b> <span class="mut small">'+kmS(s.d)+'</span>'+
 (s.zone?'<div class="mut small">'+esc(T('nearestBranch',{store:s.store.name,d:kmS(s.d)}))+'</div>':'')+
 '<div class="mut small rec" data-obs="'+esc(o.obs)+'">'+esc(T('rec',{t:fmtT(o.obs)}))+' ('+esc(ago(o.obs))+')</div>'+
 '<a href="'+esc(productUrl(p))+'" target="_blank" rel="noopener" class="vlink">'+esc(T('verify'))+' ↗</a>'+(s.zone?'':' <span class="mut small">('+esc(T('verifyStore'))+')</span>')+'</div>'+
 '<div class="amt">'+(best?'<div class="badge">'+esc(T('cheapest'))+'</div>':'')+'<div class="price">'+money(o.c)+'</div>'+(o.u&&o.um?'<div class="mut small">'+esc(T('unit',{p:money(o.u),u:o.um}))+'</div>':'')+
 (o.promo?'<div class="promo">'+esc(T('promo'))+(typeof o.promo==='string'?' · '+esc(o.promo):'')+'</div>':'')+'</div></div>'}
$('#sForm').onsubmit=e=>{e.preventDefault();const q=$('#q').value.trim();if(q.length<2)return;openCards.clear();runSearch(q,false)};
$('#sortP').onclick=()=>{sortMode='price';$('#sortP').setAttribute('aria-pressed',true);$('#sortU').setAttribute('aria-pressed',false);renderResults()};
$('#sortU').onclick=()=>{sortMode='unit';$('#sortU').setAttribute('aria-pressed',true);$('#sortP').setAttribute('aria-pressed',false);renderResults()};
// ===== shopping list =====
const slim=p=>({id:p.id,chain:p.chain,name:p.name,brand:p.brand,size:p.size,sku:p.sku,prices:p.prices,savedAt:new Date().toISOString()});
// PAK'nSAVE and New World (both Foodstuffs) share product codes: add the twin automatically
function withTwins(p){const out=[slim(p)];if(!lastSearch||!p.sku)return out;
 for(const q of lastSearch.products.values())if(q.id!==p.id&&q.sku===p.sku&&q.chain!==p.chain&&['paknsave','new-world'].includes(q.chain)&&['paknsave','new-world'].includes(p.chain))out.push(slim(q));return out}
function addFlow(p,btn){const box=btn.parentElement.querySelector('.chooserBox');
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
 for(const l of list)for(const it of l.items){const d=fresh[it.id];if(!d)continue;const locSet=new Set(DATA.chainLocIds[it.chain]||[]);const pr={};
  for(const p of d.prices||[])if(locSet.has(String(p.locationId)))pr[p.locationId]={c:p.priceCents,u:p.unitPriceCents,um:p.unitMeasure,promo:p.promoFlag?(p.promoLabel||1):0,obs:p.observedAt};
  it.prices=pr;it.savedAt=new Date().toISOString()}
 saveList();renderList();st.innerHTML=err?'<span class="err">'+esc(T('err',{msg:err}))+'</span>':esc(T('updated'))};
// ===== render all =====
function renderAll(){renderLoc();renderStores();renderResults();if(!$('#v-list').hidden)renderList()}
// ===== PWA =====
let deferredPrompt=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;$('#installBtn').hidden=false});
$('#installBtn').onclick=async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;$('#installBtn').hidden=true};
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
// ===== boot =====
setRadius(radius===30?30:20);
fetch('data/stores.json').then(r=>r.json()).then(d=>{DATA=d;applyLang()}).catch(e=>{$('#locSt').innerHTML='<span class="err">'+esc(T('err',{msg:e.message}))+'</span>'});
applyLang();
