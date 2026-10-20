'use strict';
// nzgrocery smart search engine (round 2). Pure functions: no DOM, no network.
// Baskt facts (tested 2026-10-19): /api/v1/items "q" is a plain SUBSTRING match on the product name
// (e.g. "tea" also matches "steak"), results are A–Z, max limit=100 per call (limit=200 is capped to 100),
// paging with offset/nextOffset/hasMore. Items carry brand, packSize, category, subcategory (no images).
(function(root){
// ---------- 1. localized terms -> English (6 languages). One concept = English stem + optional extra queries ----------
// Format: stem: [extra English queries (rarely needed), "zh terms|ja terms|ko terms|mi terms"]
const C={
apple:[[],"蘋果,苹果|りんご,リンゴ,林檎,アップル|사과,애플|āporo,aporo"],
banana:[[],"香蕉,蕉|バナナ|바나나|panana"],orange:[[],"橙,橙子,柳丁,柳橙|オレンジ|오렌지|ārani,arani"],
mandarin:[[],"柑,橘子,蜜柑,砂糖桔|みかん,ミカン|귤|manarini"],pear:[[],"梨,啤梨,西洋梨|なし,梨,洋梨|배|pea"],
kiwifruit:[[],"奇異果,奇异果,猕猴桃,獼猴桃|キウイ,キウイフルーツ|키위|huakiwi"],grape:[[],"提子,葡萄|ぶどう,ブドウ|포도|kerepi"],
strawberry:[[],"士多啤梨,草莓|いちご,イチゴ|딸기|rōpere,ropere"],blueberry:[[],"藍莓,蓝莓|ブルーベリー|블루베리|"],
avocado:[[],"牛油果,酪梨|アボカド|아보카도|awhokato"],lemon:[[],"檸檬,柠檬|レモン|레몬|rēmana,remana"],
mango:[[],"芒果|マンゴー|망고|"],pineapple:[[],"菠蘿,菠萝,鳳梨,凤梨|パイナップル|파인애플|painaporo"],
watermelon:[[],"西瓜|スイカ,すいか|수박|merengi"],peach:[[],"桃,水蜜桃|もも,桃|복숭아|pītiti,pititi"],
tomato:[[],"番茄,蕃茄,西紅柿,西红柿|トマト|토마토|tōmato"],potato:[[],"薯仔,馬鈴薯,马铃薯,土豆|じゃがいも,ジャガイモ|감자|rīwai,riwai"],
onion:[[],"洋蔥,洋葱|玉ねぎ,たまねぎ,タマネギ|양파|aniana"],carrot:[[],"紅蘿蔔,胡蘿蔔,胡萝卜,红萝卜|にんじん,人参,ニンジン|당근|kāreti,kareti"],
broccoli:[[],"西蘭花,西兰花,花椰菜|ブロッコリー|브로콜리|"],lettuce:[[],"生菜|レタス|상추|rētihi,retihi"],
cabbage:[[],"椰菜,包菜,卷心菜,高麗菜,高丽菜,白菜|キャベツ|양배추|kāpeti,kapeti"],cucumber:[[],"青瓜,黃瓜,黄瓜|きゅうり,キュウリ|오이|kūkama,kukama"],
mushroom:[[],"蘑菇,菇,冬菇|きのこ,マッシュルーム|버섯|harore"],garlic:[[],"蒜,大蒜,蒜頭|にんにく,ニンニク|마늘|kāriki,kariki"],
ginger:[[],"薑,姜,生薑,生姜|しょうが,生姜,ショウガ|생강|"],capsicum:[[],"燈籠椒,灯笼椒,甜椒,彩椒|ピーマン,パプリカ|피망,파프리카|"],
spinach:[[],"菠菜|ほうれん草|시금치|"],pumpkin:[[],"南瓜|かぼちゃ,カボチャ|호박|paukena"],kumara:[[],"番薯,紅薯,红薯,地瓜|さつまいも,サツマイモ|고구마|kūmara"],
corn:[[],"粟米,玉米|とうもろこし,コーン|옥수수|kānga,kanga"],
milk:[["milk 2l"],"牛奶,奶,鮮奶,鲜奶|牛乳,ミルク|우유|miraka"],bread:[["toast","sandwich bread"],"麵包,面包,方包|パン,食パン|빵|parāoa,paraoa"],
egg:[[],"雞蛋,鸡蛋,蛋|卵,たまご,玉子|계란,달걀|hēki,heki"],butter:[[],"牛油,黃油,黄油|バター|버터|pata"],
cheese:[[],"芝士,起司,奶酪,乳酪|チーズ|치즈|tīhi,tihi"],yoghurt:[[],"乳酪,酸奶,優格,优格,酸乳酪|ヨーグルト|요거트,요구르트|"],
cream:[[],"忌廉,奶油,鮮忌廉|クリーム,生クリーム|크림|kirīmi"],tofu:[[],"豆腐|豆腐|두부|"],
rice:[[],"米,白米,香米|米,お米,ご飯|쌀|raihi"],noodle:[[],"麵,面,麵條,面条,即食麵,方便面,公仔麵|麺,ラーメン,うどん|국수,라면|"],
pasta:[[],"意粉,意大利麵,意大利面,通心粉|パスタ,スパゲッティ|파스타|"],flour:[[],"麵粉,面粉|小麦粉|밀가루|puehu parāoa"],
sugar:[[],"糖,砂糖|砂糖|설탕|huka"],salt:[[],"鹽,盐|塩|소금|tote"],oil:[[],"油,食油,食用油|油,サラダ油|기름,식용유|hinu"],
"soy sauce":[[],"豉油,醬油,酱油,生抽|醤油,しょうゆ|간장|"],vinegar:[[],"醋|酢|식초|winika"],honey:[[],"蜜糖,蜂蜜|はちみつ,蜂蜜|꿀|honi"],
jam:[[],"果醬,果酱|ジャム|잼|tāmu"],chicken:[[],"雞,鸡,雞肉,鸡肉|鶏肉,チキン,とり肉|닭고기,닭|heihei"],
beef:[[],"牛肉|牛肉,ビーフ|소고기|mīti kau"],pork:[[],"豬肉,猪肉|豚肉,ポーク|돼지고기|poaka"],lamb:[[],"羊肉,羊|ラム,羊肉|양고기|rēme"],
fish:[[],"魚,鱼|魚,さかな|생선|ika"],salmon:[[],"三文魚,三文鱼,鮭魚,鲑鱼|サーモン,鮭|연어|hāmana"],prawn:[[],"蝦,虾,大蝦|えび,エビ|새우|kōura"],
sausage:[[],"腸仔,香腸,香肠|ソーセージ|소시지|tōtiti"],bacon:[[],"煙肉,培根|ベーコン|베이컨|pēkana"],ham:[[],"火腿|ハム|햄|"],
tea:[["tea bags","green tea"],"茶,茶包,綠茶,绿茶,紅茶,红茶,奶茶|お茶,茶,紅茶,緑茶|차,녹차,홍차|tī,ti"],coffee:[[],"咖啡|コーヒー|커피|kawhe"],
juice:[[],"果汁,汁|ジュース|주스|wai rēmana"],water:[[],"水,礦泉水,矿泉水|水,ミネラルウォーター|물,생수|wai"],
cereal:[[],"麥片,麦片,早餐穀物,穀物|シリアル|시리얼|"],biscuit:[[],"餅乾,饼干,曲奇|ビスケット,クッキー|비스킷,쿠키|pihikete"],
chocolate:[[],"朱古力,巧克力|チョコレート,チョコ|초콜릿|tiakarete"],chips:[[],"薯片|ポテトチップス|감자칩|"],
"ice cream":[[],"雪糕,冰淇淋|アイスクリーム,アイス|아이스크림|aihikirīmi"],"toilet paper":[[],"廁紙,厕纸,卫生纸,衛生紙|トイレットペーパー|화장지,휴지|"],
tissue:[[],"紙巾,纸巾|ティッシュ|티슈|"],detergent:[[],"洗衣粉,洗衣液|洗剤,洗濯洗剤|세제|"],"dishwashing liquid":[[],"洗潔精,洗洁精|食器用洗剤|주방세제|"],
shampoo:[[],"洗頭水,洗髮水,洗发水|シャンプー|샴푸|"],toothpaste:[[],"牙膏|歯磨き粉|치약|"],nappies:[[],"尿片,尿布|おむつ|기저귀|"],
"cat food":[[],"貓糧,猫粮|キャットフード|고양이 사료|"],"dog food":[[],"狗糧,狗粮|ドッグフード|강아지 사료,개 사료|"],
cider:[[],"西打|サイダー|사이다|"],pie:[[],"批,派|パイ|파이|pai"],
};
const TERM=new Map(),EN=new Set(Object.keys(C));
for(const [en,[x,s]] of Object.entries(C)){s.split('|').forEach((grp,li)=>grp.split(',').filter(Boolean).forEach(t=>{const k=t.toLowerCase();
  if(!TERM.has(k))TERM.set(k,{en,lang:['zh','ja','ko','mi'][li]})}))}
const CJK=/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;
// English singular/plural
function singular(w){if(w.length<=3||/ss$|us$|is$/.test(w))return w;
 if(/ies$/.test(w))return w.slice(0,-3)+'y';if(/(oes|ches|shes|xes|sses)$/.test(w))return w.slice(0,-2);if(/s$/.test(w))return w.slice(0,-1);return w}
function plural(w){if(/[^aeiou]y$/.test(w))return w.slice(0,-1)+'ies';if(/(s|x|ch|sh|o)$/.test(w))return w+'es';return w+'s'}
// CJK greedy longest-match segmentation over dictionary terms (蘋果汁 -> apple + juice)
function segCJK(s){const out=[];let i=0;const keys=[...TERM.keys()].filter(k=>CJK.test(k)).sort((a,b)=>b.length-a.length);
 while(i<s.length){if(/\s/.test(s[i])){i++;continue}const k=keys.find(k=>s.startsWith(k,i));if(k){out.push(TERM.get(k).en);i+=k.length}else{out.push(null);i++}}return out}
const SIZE_RE=/^(\d+(?:\.\d+)?)\s*(l|ml|g|kg|pk|ea)$/i;
// Resolve user text (any of 6 languages) -> {words:[english], size, unknown:[...], from}
// v1.3.2: phrase aliases for names users type in many ways (Baskt stores "L&P" as brand, Woolworths "l & p ... lemon & paeroa")
const PHR=[{re:/^(l ?(&|and|n|'n'|\+) ?p|landp|lnp|lemon ?(&|and|n)? ?paeroa|paeroa)$/,q:'l&p',brand:'l and p',extra:['paeroa']}];
// Brand index for detecting a brand inside the query ("tip top bread", "anchor milk", "vogels"). Ambiguous everyday words are skipped.
const BRAND_SKIP=new Set(['value','budget','oak','bell','assam','jazz','envy','mars','e2','primo','macro','picky','karma','sassy','champion','trident','highlander','ofi','mama','almighty','dazzle','smitten','the collective','real meals','essentials','countdown','woolworths','farro','phoenix','ceres','keri','eta','raro','so good','apple & pear','deep south','monteiths','moa','duck island','factory road']);
// Baskt's q is a literal substring: "vogels" does not find "Vogel's". For brands written with an apostrophe the query is
// the shared stem before it ("vogel" finds Vogel's and Vogels); short stems (pic's) keep the plain form.
function brandQuery(k){const v=KNOWN.concat(EXTRA_BRANDS).find(b=>norm(b)===k&&/'/.test(b));if(!v)return k;const st=v.split("'")[0].trim();return st.length>=4?st:k}
let BRANDS=null;function brandSet(){if(BRANDS)return BRANDS;BRANDS=new Map();for(const b of KNOWN.concat(EXTRA_BRANDS)){const k=norm(b);if(k&&!BRAND_SKIP.has(k)&&!BRAND_SKIP.has(b)&&!BRANDS.has(k))BRANDS.set(k,titleCase(b.replace(/'s\b/,"'s")))}return BRANDS}
// Resolve user text (any of 6 languages) -> {words:[english], size, unknown:[...], from, bq (Baskt query), brand, alt:[...]}
// v1.3.2: every Latin token goes through the SAME norm() as the product text (so &, ' and - never block a match:
// l&p = l and p, vogel's = vogels, tip-top = tip top); a brand inside the query becomes one phrase word and its own Baskt query.
function resolve(text,lang){let raw=String(text||'').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/(\d)\s+(l|ml|g|kg|pk)\b/g,'$1$2');if(!raw)return null;
 const out={words:[],size:null,unknown:[],mapped:false,text:raw,bq:null,brand:null,brandQ:null,alt:[],extra:null};
 const whole=TERM.get(raw);
 if(whole&&!(EN.has(raw)&&lang!=='mi')&&!(whole.lang==='mi'&&lang!=='mi'&&/^[a-z ]+$/.test(raw)&&!/[āēīōū]/.test(raw)&&raw.length<4)){out.words=whole.en.split(' ');out.mapped=true;return out}
 const rest=[];for(const tok of raw.split(/\s+/)){const m=tok.match(SIZE_RE);if(m&&!out.size){out.size=(+m[1])+m[2];continue}rest.push(tok)}
 const restS=rest.join(' ');
 for(const a of PHR)if(a.re.test(restS)){out.words=[a.brand];out.brand=a.brand;out.bq=a.q;out.brandQ=a.q;out.extra=a.extra;out.rawExtra=true;return out}
 let lat=[],changed=false;
 for(const tok of rest){
  if(CJK.test(tok)){const seg=segCJK(tok);if(seg.some(x=>x===null))out.unknown.push(tok);seg.filter(Boolean).forEach(e=>out.words.push(...e.split(' ')));out.mapped=true;continue}
  const t=TERM.get(tok);if(t&&!EN.has(tok)&&(t.lang!=='mi'||lang==='mi'||/[āēīōū]/.test(tok))){out.words.push(...t.en.split(' '));out.mapped=true;continue}
  const n=norm(tok);if(n!==tok)changed=true;if(!n)continue;
  if(/&/.test(tok)&&/\s/.test(n)){out.words.push(n);lat.push(n);continue} // m&m -> one phrase "m and m"
  for(const x of n.split(' ')){out.words.push(x);lat.push(x)}}
 // brand detection (longest run of words that is a known brand; also its plural/singular form: vogel = vogels)
 const B=brandSet();const w=out.words;let best=null;
 for(let i=0;i<w.length;i++)for(let j=w.length;j>i;j--){const k=w.slice(i,j).join(' ');const k2=/s$/.test(k)?null:k+'s';
  const hit=B.has(k)?k:(k2&&B.has(k2)?k2:null);if(hit&&(!best||j-i>best.n)){best={i,n:j-i,k:hit};break}}
 if(best){w.splice(best.i,best.n,best.k);out.brand=best.k;out.brandQ=brandQuery(best.k);if(w.length===1&&!out.size&&out.brandQ!==best.k){out.bq=out.brandQ;changed=false}}
 out.words=w.map(x=>x!==out.brand&&/^[a-z]+$/.test(x)?singular(x):x).filter((x,i,a)=>x&&a.indexOf(x)===i);
 if(changed&&lat.length){out.bq=rest.join(' ');const a=lat.join(' ');if(a!==out.bq&&!/&/.test(out.bq))out.alt.push(a)} // Baskt gets the raw text (vogel's) and the plain form (vogels / tip top)
 return out}
// Prefix completion for live suggestions (0 API calls): "app" -> apple, "蘋" -> 蘋果
function complete(text,lang){const t=String(text||'').trim().toLowerCase();if(!t)return[];
 const res=[];for(const [k,v] of TERM){if(k.startsWith(t)&&k!==t&&(v.lang!=='mi'||lang==='mi'))res.push({term:k,en:v.en})}
 for(const en of EN)if(en.startsWith(t)&&en!==t)res.push({term:en,en});
 if(!res.length&&t.length>=2&&/^[a-z0-9&' .-]+$/.test(t)){const nt=norm(t);for(const [k,lbl] of brandSet())if(k.startsWith(nt)&&k!==nt)res.push({term:lbl,en:k,brand:true})}
 const seen=new Set();return res.filter(r=>!seen.has(r.en)&&seen.add(r.en)).slice(0,8)}
const STOP=new Set(['free','range','fresh','organic','nz','new','zealand','large','small','big','mini','the','and','with','of','pack','low','fat','lite','light','trim','full','premium','natural','pure','classic','original','plain','extra','super','value','sweet','red','green','white','black','blue']);
// Plan the first-wave Baskt queries (per chain the app sends q + all Auckland locations + limit=100)
function plan(r){if(!r||!r.words.length)return null;const w=r.words;
 const phrase=w.join(' ');const ex=r.extra?r.extra:(w.length===1&&C[w[0]]&&!r.size)?C[w[0]][0]:(C[phrase]&&!r.size?C[phrase][0]:[]);
 const brandQ=r.brandQ&&(w.length>1||r.size||r.bq&&r.bq!==r.brandQ)?r.brandQ:null; // brand + more words (or a size): ask Baskt for the brand, filter on the phone
 const anchor=brandQ?null:(w.length>1?(w.find(x=>EN.has(x))||[...w].filter(x=>!STOP.has(x)).sort((a,b)=>b.length-a.length)[0]||w[0]):null);
 return {key:phrase+(r.size?' '+r.size:''),phrase,bq:r.bq||phrase,size:r.size,words:w,extra:ex,anchor:anchor&&anchor!==phrase?anchor:null,brand:r.brand||null,brandQ,alt:r.alt||[],rawExtra:!!r.rawExtra}}
// per-chain q (Foodstuffs names end in "(2l)", Farro "2l", Woolworths keeps size separately)
function chainQ(chain,words,size){const w=words;if(!size)return w;
 if(chain==='paknsave'||chain==='new-world')return w+' ('+size+')';if(chain==='farro')return w+' '+size;return w}
// ---------- 2. matching (Baskt's q is substring; we require whole words on the phone) ----------
const norm=s=>String(s||'').toLowerCase().replace(/[’']/g,'').replace(/&/g,' and ').replace(/[^a-z0-9.%+\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g,' ').trim();
function wordForms(w){const s=new Set([w,plural(w),singular(w)]);if(w==='yoghurt')['yogurt','yoghurts','yogurts'].forEach(x=>s.add(x));if(w==='kiwifruit')s.add('kiwi');if(w==='nappies'||w==='nappy')['nappy','nappies','nappie'].forEach(x=>s.add(x));if(w==='chip')s.add('chips');if(w==='tea')['teabag','teabags'].forEach(x=>s.add(x));return s}
// v1.3.2: one searchable text per product = name + brand + pack size + category + subcategory (Baskt has no description field),
// normalised the same way as the query. Synonyms only for matching (a "5 Star White Toast" loaf is bread).
const MATCH_SYN={bread:['toast','loaf','loaves']};
function hayOf(it){return ' '+norm([it.name,it.brand,it.packSize,it.category,it.subcategory].filter(x=>x!=null&&x!=='').join(' '))+' '}
function matches(it,words,size){const hay=hayOf(it);
 for(const w of words){if(/\s/.test(w)){if(!hay.includes(' '+w+' '))return false;continue}let ok=false;for(const f of [...wordForms(w),...(MATCH_SYN[w]||[])])if(hay.includes(' '+f+' ')){ok=true;break}if(!ok)return false}
 if(size){const z=(norm(it.name)+' '+norm(it.packSize)).replace(/(\d)\s+(l|ml|g|kg)\b/g,'$1$2').split(' ');if(!z.includes(size))return false}
 return true}
// does the product's brand match the brand (or any word) the user typed?
function brandHit(brand,pl){const b=' '+norm(brand)+' ';if(!brand)return false;if(pl.brand&&(b.includes(' '+pl.brand+' ')||(' '+pl.brand+' ').includes(b)))return true;
 return pl.words.some(w=>w.length>2&&!EN.has(w)&&b.includes(' '+w+' '))}
// well-known national brands per concept (used only to order brand groups; prices are never changed)
const POPULAR={bread:['tip top','vogels','molenberg','freyas','ploughmans bakery','ploughmans','burgen','natures fresh','abes'],
 milk:['anchor','meadow fresh','a2','lewis road creamery','puhoi valley','pams'],egg:['frenz','woodland','henergy','better eggs','pams','farmer brown','zeagold']};
function popRank(brand,words){const b=norm(brand);for(const w of words){const l=POPULAR[w];if(!l)continue;const i=l.findIndex(x=>b===x||b.startsWith(x+' '));if(i>=0)return i}return -1}
// ---------- 3. brand: Baskt field + cleanup / inference ----------
const KNOWN=("a2,alpro,anchor,meadow fresh,lewis road creamery,lewis road,puhoi valley,puhoi,kapiti,mainland,pams,pams finest,woolworths,macro,macro organic,essentials,countdown,value,budget,"+
"keri,just juice,charlie's,charlies,golden circle,fresh up,mother earth,annies,annie's,picky,phoenix,karma,karma drinks,most organics,benjer,e2,g-force,"+
"dilmah,bell,bell tea,twinings,tetley,lipton,choysa,red seal,pukka,ceres,ceres organics,healtheries,zealong,t2,"+
"wattie's,watties,heinz,eta,delmaine,sanitarium,uncle tobys,hubbards,kelloggs,kellogg's,vogel's,vogels,tip top,molenberg,freya's,freyas,ploughmans,ploughman's,"+
"cadbury,whittaker's,whittakers,nestle,arnott's,arnotts,griffin's,griffins,bluebird,copper kettle,proper crisps,ofi,natureland,only organic,rafferty's garden,raffertys garden,"+
"zeffer,scrumpy,monteith's,monteiths,orchard thieves,moa,old mout,rekorderlig,somersby,mac's,macs,speight's,speights,steinlager,heineken,"+
"dyc,coraltree organic,daily organics,barker's,barkers,anathoth farm,anathoth,craig's,craigs,maison therese,wild country,nana dunn,heartland,good sh*t,"+
"tegel,inghams,ingham's,hellers,hutton's,huttons,wilson hellaby,primo,farmland,kiwi bacon,freshpork,"+
"yummy fruit,natures quirks,nature's quirks,sassy,waipopo,jazz,envy,rockit,pacific rose,ambrosia,cosmic crisp,smitten,dazzle,the odd bunch,"+
"lindt,ferrero,mars,oreo,tim tam,nescafe,moccona,greggs,robert harris,l'affare,lafare,vittoria,"+
"tararua,clevedon valley,the collective,yoplait,activia,danone,fage,piako,primo,cyclops,"+
"apple & pear,nz apple products,new zealand apple products,real meals,freshfields,orihiro,naturkidz,vital zing,hiveenergy,iddy biddy,snacktacular,baby mum-mum,quarterpast,"+
"assam,wagh bakri,factory road,appleby farms,duck island,alchemy & tonic,almighty,farro,nz natural,kapiti ice cream,much moore,emma & tom's,"+
"jalna,deep south,tip top ice cream,talley's,talleys,mccain,birds eye,sealord,john west,greenseas,s&w,oak,leggo's,dolmio,raro,vitasoy,so good,sun rice,sunrice,uncle ben's,"+
"trident,maggi,indomie,nissin,mama,kikkoman,lee kum kee,ayam,blue dragon,chelsea,edmonds,champion,highlander,nutella,pic's,pics,marmite,vegemite,").split(',').filter(Boolean);
const EXTRA_BRANDS=['l&p','burgen','natures fresh','ploughmans bakery','abes','frenz','woodland','henergy','better eggs','farmer brown','zeagold','kalo','the odd bunch','odd bunch','pams','lewis road creamery','meadow fresh','anchor'];
const NOT_BRAND=new Set(['fresh fruit','fresh vegetables','fresh vegetable','fresh','fresh produce','loose','bakery','in store bakery','instore bakery','japanese','deli','fresh meat','butchery']);
function titleCase(s){return String(s||'').replace(/\s+/g,' ').trim().replace(/(^|[\s(&+\-\/])([a-z])/g,(m,a,b)=>a+b.toUpperCase())}
function makeBrandIndex(seenBrands,lowBrands){const m=new Map();
 for(const b of KNOWN)m.set(norm(b),titleCase(b));
 for(const b of lowBrands||[]){const k=norm(b);if(k&&k.length>2&&!NOT_BRAND.has(k)&&!m.has(k))m.set(k,titleCase(b))}  // Woolworths brand field (lower case) -> only used for Farro names
 for(const b of seenBrands||[]){const k=norm(b);if(k&&!NOT_BRAND.has(k))m.set(k,b)}  // casing from Foodstuffs brand field
 const keys=[...m.keys()].sort((a,b)=>b.length-a.length);return {m,keys}}
function longestPrefix(bi,text){const t=norm(text)+' ';for(const k of bi.keys){if(t.startsWith(k+' '))return k}return null}
// returns {brand, src}  src: baskt | cleaned | inferred | none
function brandOf(it,bi,type){let raw=String(it.brand==null?'':it.brand).trim();if(raw.length<2||/^\d+$/.test(raw))raw='';const k=norm(raw); // Baskt sometimes sends "0"
 if(it.chain==='paknsave'||it.chain==='new-world'){if(raw&&!NOT_BRAND.has(k))return{brand:raw,src:'baskt'};return{brand:'',src:'none'}}
 if(it.chain==='countdown'){ // Woolworths brand field = leading words of the name, sometimes incl. product line
  if(!raw||NOT_BRAND.has(k))return{brand:'',src:'none'};
  const p=longestPrefix(bi,raw);if(p)return{brand:bi.m.get(p),src:p===k?'baskt':'cleaned'};
  const w=k.split(' ');return{brand:titleCase(w.length>2?w.slice(0,2).join(' '):k),src:'cleaned'}}
 // Farro (and others): brand field empty -> leading words of the name that match a known brand
 if(raw&&!NOT_BRAND.has(k))return{brand:raw,src:'baskt'};
 const bx=bi.farro||bi;const p=longestPrefix(bx,it.name);if(p)return{brand:bx.m.get(p),src:'inferred'};return{brand:'',src:it.chain==='farro'?'unknown':'none'}}
// ---------- 4. product type (category chip): Baskt category/subcategory + generic name keyword rules ----------
const TYPES=['fruit','veg','drinks','tea','coffee','milk','dairy','bakery','frozen','sweets','snacks','cereal','sauces','pantry','meat','meals','baby','alcohol','health','nonfood','other'];
const FRUIT=/\b(apples?|bananas?|oranges?|mandarins?|pears?|kiwifruit|kiwi|grapes?|berr(y|ies)|strawberr(y|ies)|blueberr(y|ies)|raspberr(y|ies)|mangoe?s?|avocados?|lemons?|limes?|peach(es)?|nectarines?|plums?|cherr(y|ies)|melons?|watermelons?|pineapples?|feijoas?|tamarillos?|persimmons?|apricots?|grapefruit|tangelos?|passionfruit|lychees?|figs?|pomegranates?)\b/;
const R=(re)=>s=>re.test(s);
const ALC=/\b(wine|wines|pinot|sauvignon|chardonnay|merlot|shiraz|syrah|riesling|prosecco|champagne|ipa|lager|pilsner|stout|beer|beers|cider|gin|vodka|whisky|whiskey|rum|bourbon|tequila|chateauneuf|chateau|cru|brut|cuvee|pale ale)\b/;
function typeOf(it){const n=' '+norm(it.name)+' ';const cat=norm((it.category||'')+' / '+(it.subcategory||''));
 const sc=norm(it.subcategory||it.category||''); // the most specific category Baskt gives (Foodstuffs subcategory, else category)
 const has=re=>re.test(n),c=re=>re.test(cat),s=re=>re.test(sc);
 // non-food & health first (category wins)
 if(c(/\b(pet|dog|cat)\b/)||has(/\b(dog|cat|puppy|kitten) (food|biscuits|treats|roll)\b/))return'nonfood';
 if((c(/vitamin|supplement|sports nutrition|medical|first aid|pharmacy/)&&!has(/\b(biscuits?|cookies|crackers)\b/))||has(/\b(capsules|tablets|softgels|gummies|vitamins?|supplement|dietary)\b/)&&!has(/\bfruit (gummies|snacks)\b/)&&!has(/\b(tea|juice|drink)\b/))return'health';
 if(c(/health (and )?body/)&&has(/\b(bars?|protein|shakes?|snacks?|chocolate|powder)\b/))return'health';
 if(c(/health and body|health body|beauty|hair care|skin care|bath shower|personal care|household|cleaning|homewares|homeware|laundry|dishwashing|toilet|nursing/)||has(/\b(shampoo|conditioner|bodywash|body wash|lotion|soap|handwash|hand wash|detergent|deodorant|toothpaste|candle|towel|brush|teats?|wipes|nappies|nappy|spray|air freshener|refill|dishwash)\b/))return'nonfood';
 if(c(/\bbaby\b|toddler/)||has(/\b(toddler|infant|months)\b/)||has(/\d+\s*months?\s*\+?/)||has(/\bbaby (food|formula|rice|cereal|snacks?|puree|pouch|pouches|teether|rusks)\b/))return'baby';
 if(c(/fruit and vegetables|fruit and veg|^produce|vegetables|salad/)&&!c(/frozen|canned|dried|dressing|dips?\b/)&&!has(/\b(juice|drink|chips|bars?|yoghurt|cheese|dressing|sauce|dip)\b/)){if(c(/vegetables|salad/)&&!c(/\bfruit\b(?! and vegetables)/))return FRUIT.test(n)&&!has(/\b(kit|salad|chopped)\b/)?'fruit':'veg';
  return FRUIT.test(n)||c(/apples|pears|citrus|berries|stonefruit|\bfruit\b(?! and veg)/)?'fruit':'veg'}
 // ready meals / pies / sandwiches by category (avoids "Fridge, Deli & Eggs" being read as dairy) or name
 if(s(/easy meals|ready meals|single meals|frozen meals|ready to eat|meal kits|chilled soups|dumplings|sandwich/)||has(/\b(sandwich|sandwiches|steam(ed)? buns|dumplings|mac and cheese|mac n cheese)\b/)&&!has(/\bsandwich (bread|loaf|thins?)\b/)&&!s(/bread/))return'meals';
 if(has(/\b(paper|sheets|grater|knife|knives|storage bags|containers?|baking cups)\b/)&&!has(/\brice paper\b/))return'nonfood';
 if(s(/bakery|bread|cakes|muffins|pastries|pie warmer/)&&!has(/\b(milk|juice|drink)\b/))return'bakery';
 // snacks by the specific category (Foodstuffs "Chips, Nuts & Snacks", "Biscuits & Crackers"; Farro "potato crisps", "crackers") or name
 if(s(/chips|crisps|crackers|biscuits|snacks|popcorn|lunchbox|muesli bars/)&&!has(/\b(juice|drink|milk)\b/)||has(/\b(chips|crisps|crackers|crispies|thins|oatcakes?)\b/))return'snacks';
 if(has(/\bvinegar\b/)&&!has(/\bshot\b/)||has(/\b(sauce|chutney|relish|jam|marmalade|dressing|mayonnaise|ketchup|syrup|spread|pickled?|mustard|marinade|glaze|paste|honey)\b/)&&!has(/\b(cordial|drink|juice|water|tea|shot|soda)\b/)&&!has(/\bin [a-z ]*marinade\b/))return'sauces';
 if(has(/\b(coconut milk|coconut cream)\b/)&&c(/pantry|canned|grocery|asian|world/))return'pantry';
 if(has(/\b(mix|filling|tinned|canned|crystals)\b/)&&!has(/\b(juice|drink|tea)\b/))return'pantry';
 if(c(/beer|wine|cider|spirits|alcohol|seltzer|rtd/)&&!has(/vinegar|energy drink|soft drink|kombucha|\bwater\b/))return'alcohol';
 if(c(/beverages|drinks|wine/)&&s(/\b(hazy|ipa|lager|craft beer|red wine|white wine|sparkling wine|rose|france|italy|spain|australia|portugal|germany|chile|argentina)\b/))return'alcohol';
 if(has(ALC)&&!has(/\b(vinegar|chocolate|choc|ice cream|cake|fudge|tea|sauce|raisin|gummies|chips|cheese|ginger beer|root beer)\b/)&&!c(/dips|antipasto|spreads|condiments/))return'alcohol';
 if(has(/\b(flavou?red milk|chocolate milk|choc milk|milkshakes?|milk drink)\b/))return'milk';
 if(c(/^frozen/)&&!has(/\b(pies?|buns?|dumplings|meals?|pizzas?|pastry|cakes?|bread)\b/)&&!has(/\b(ice ?cream|gelato|sorbet)\b/))return'frozen';
 if(has(/\b(ice ?cream|icecream|frozen yoghurt|ice blocks?|gelato|sorbet)\b/)||c(/icecream|ice cream|ice blocks/))return'frozen';
 if((has(/\btea\b/)&&!has(/\btea (cake|cakes|towel|towels|loaf|light|lights|cups?)\b/)&&!has(/\b(teaspoon|teaspoons|tea tree)\b/)||c(/\btea\b/)&&!has(/\b(cake|cakes)\b/))&&!has(/\b(soba|noodles?)\b/))return'tea';
 if(has(/\b(coffee|espresso|latte|cappuccino)\b/)&&!has(/\b(cake|cheesecake|slice|chocolate|biscuits?)\b/)||c(/\bcoffee\b/))return'coffee';
 if(has(/\b(pie|pies|cake|cakes|muffins?|crumble|danish|pastry|pastries|pasty|pasties|tart|tarts|strudel|turnover|loaf|bread|scones?|donuts?|doughnuts?|pudding|cheesecake|slice|croissants?|buns?|brioche|bagels?|wraps?|pita)\b/)&&!has(/\b(mix|kit|flavou?red? milk|bars?|granola|muesli|bites|cereal|yoghurt|ice cream|squares)\b/)&&!s(/milk/))return'bakery';
 if(has(/\b(juice|smoothie|cordial|soda|sparkling|kombucha|lemonade|fizz|nectar|cola|drink|drinks|water|beverage|shot|electrolyte|tonic)\b/)&&!has(/\bmilk\b/)||c(/juice|smoothie|soft drinks|cordial|syrups|energy drinks|kombucha|functional|\bwater\b|beverages/)&&!has(/\bmilk\b/))return'drinks';
 if(has(/\bmilk\b/)&&!has(/\b(chocolate|choc|biscuits?|cookies|bar|bars|soap|powder formula|cheese|halloumi|haloumi|scamorza|mozzarella|feta|gouda|cheddar|edam|brie|camembert|ricotta|quark|havarti|parmesan|yoghurt|butter|stout|ale)\b/)&&!s(/cheese|yoghurt/))return'milk';
 if(has(/\b(yoghurts?|yogurts?|cheese|halloumi|haloumi|scamorza|mozzarella|feta|gouda|cheddar|edam|brie|camembert|ricotta|quark|havarti|parmesan|butter|cream|custard|dip|eggs?|kefir|labneh)\b/)||s(/yoghurt|cheese|butter|cream|eggs|dairy/))return'dairy';
 if(has(/\b(chocolate|choc|lollies|lolly|candy|jelly|jellies|marshmallows?|licorice|liquorice|toffee|fudge|gum|caramel)\b/)||s(/chocolate|sweets|lollies|confectionery/))return'sweets';
 if(s(/cereal|oats|porridge|muesli|granola/))return'cereal';
 if(has(/\b(dried|snacks?|bars?|rolls|flats|sticks|bites|biscuits?|cookies|muesli|granola|rings|chews|puffs|nuts|popcorn|rusks)\b/)||c(/snack|biscuits|chips|crackers|bulk foods|lunchbox|dried fruit|nuts/))return'snacks';
 if(c(/cereal|oats|porridge|muesli/))return'cereal';
 if(c(/meat|poultry|seafood|beef|pork|lamb|chicken|deli meats|sausages|butchery|fish|steaks/)||has(/\b(pork|beef|chicken|lamb|sausages?|steaks?|fish|salmon|ham|bacon|turkey|mince|fillets?)\b/))return'meat';
 if(c(/ready meals|meal kits|easy meals|soups|frozen meals|pizza/))return'meals';
 if(c(/frozen/))return'frozen';
 if(c(/fruit and vegetables|fruit and veg|produce|^fruit|vegetables|salad/)&&!c(/dressing/)){if(c(/vegetables|salad/)&&!c(/fruit$|\bfruit\b(?! and vegetables)/))return FRUIT.test(n)&&!has(/\b(kit|salad|chopped)\b/)?'fruit':'veg';
  return FRUIT.test(n)||c(/apples|pears|citrus|berries|stonefruit|\bfruit\b(?! and vegetables)/)?'fruit':'veg'}
 if(c(/fridge|chilled|deli/))return'dairy';
 if(c(/pantry|grocery|canned|baking|world foods|pasta|rice|noodles|oil|condiments|spreads|desserts|packets|herbs|spices/))return'pantry';
 if(c(/drinks/))return'drinks';
 return'other'}
// ---------- 5. size, unit price, sub-group (variety / product kind), merge across chains ----------
function sizeOf(it){let s=norm(it.packSize).replace(/\s+/g,'');
 if(/^(kg|perkg|loose|1kg?loose)$/.test(s))s='kg';if(/^(each|ea|1ea|1pk)$/.test(s))s='ea';s=s.replace(/^single(can|bottle)$/,'$1');
 if((s==='ea'||s==='prepacked'||!s)){const m=norm(it.name).match(/(\d+(?:\.\d+)?)\s?(kg|g|ml|l)\b(?!.*\d+(?:\.\d+)?\s?(kg|g|ml|l)\b)/);if(m)s=(+m[1])+m[2]}
 return s}
const UNIT={'1kg':['kg',1],'100g':['kg',10],'1l':['L',1],'100ml':['L',10],'1ea':['ea',1],'ea':['ea',1],'100ea':['ea',.01],'each':['ea',1],'100':['100',1]};
function unitNorm(cents,measure){if(cents==null||!measure)return null;const u=UNIT[String(measure).toLowerCase()];if(!u)return{u:String(measure),c:cents};return{u:u[0],c:Math.round(cents*u[1])}}
const FILL=new Set(['woolworths','countdown','bags','bag','teabags','sachets','sachet','pods','pouches','leaf','bottle','can','carton','tin','jar','fresh','fruit','loose','prepacked','each','ea','per','kg','nz','the','and','of','bag','pack','pk','x','beverage','100%','pure','premium','natural','classic','original','new','zealand','with','in','a','g','ml','l']);
const ALIAS={'sweetango':'sweet tango','pink lady cripps':'pink lady','cripps pink':'pink lady','cripps pink lady':'pink lady','gala':'royal gala','royal gala':'royal gala','granny':'granny smith'};
function residualWords(it,brand){let n=norm(it.name).replace(/\((?:[^)]*)\)/g,' ').replace(/\b\d+(\.\d+)?\s?(kg|g|ml|l|pk|ea|ct|pack)\b/g,' ').replace(/\b\d+\s?x\s?\d+(\.\d+)?\s?(g|ml|l)?\b/g,' ');
 let w=n.split(' ').filter(Boolean);const b=norm(brand).split(' ').filter(Boolean);
 if(b.length&&w.slice(0,b.length).join(' ')===b.join(' '))w=w.slice(b.length);
 return w.filter(x=>!/^\d+(\.\d+)?%?$/.test(x))}
// Sub-group inside a category. ownType = the category where the searched word is the product itself (data-driven: the
// majority type of items whose name ENDS with the word, e.g. "Envy Apples" -> fruit, "Green Tea" -> tea, "Blue Milk" -> milk).
// Items of ownType are grouped by variety/flavour (the other words: Envy, Royal Gala, English Breakfast, Lite …);
// items of other categories by their head noun (apple JUICE, apple cider VINEGAR, apple PIE …).
function subGroup(it,brand,type,words,ownType){let w=residualWords(it,brand);const forms=new Set();for(const q of words)for(const f of wordForms(q))forms.add(f);
 const organic=w.includes('organic');w=w.filter(x=>!FILL.has(x)&&x!=='organic');
 const qi=w.findIndex(x=>forms.has(x));let label,mode;
 const own=ownType?type===ownType:(qi===-1||qi===w.length-1);
 if(own||type==='fruit'||type==='veg'||qi===-1){mode='v';
  let v=w.filter(x=>!forms.has(x)&&!((type==='fruit'||type==='veg')&&FRUIT.test(x))).join(' ');v=ALIAS[v]||v;
  if(type==='fruit'||type==='veg')v=v.replace(/\b(kids|snackers|bag)\b/g,' ').replace(/\s+/g,' ').trim(),v=ALIAS[v]||v;
  label=v?titleCase(v.split(' ').slice(0,type==='fruit'||type==='veg'?3:2).join(' ')):''}
 else{mode='h';const head=w[w.length-1];label=titleCase(singular(head))}
 const key='g:'+(label?label.toLowerCase().split(' ').map(singular).join(' '):'-');
 return{key,label,organic,mode,last:qi!==-1&&qi===w.length-1}}
function productKey(it,brand){const w=residualWords(it,brand).filter(x=>!FILL.has(x)).map(singular).sort();return norm(brand)+'|'+w.join(' ')+'|'+sizeOf(it)}
// Build: items(raw Baskt) -> products (same item merged across chains) -> sub-groups -> type groups
function build(items,prices,words,opts){opts=opts||{};const seen=[];for(const it of items)if((it.chain==='paknsave'||it.chain==='new-world')&&it.brand)seen.push(it.brand);
 const bi=makeBrandIndex(seen);bi.farro=makeBrandIndex(seen,items.filter(it=>it.chain==='countdown'&&it.brand).map(it=>it.brand));const pre=[];const cnt={};
 for(const it of items){const type=typeOf(it);const b=brandOf(it,bi,type);let brand=b.brand,bsrc=b.src;
  if(type==='fruit'||type==='veg'){const a=subGroup(it,brand,type,words,type),z=subGroup(it,'',type,words,type); // Woolworths/Farro: the variety (Envy, Jazz) sits in the brand / at the start of the name
   if(brand&&z.label&&(!a.label||norm(z.label).includes(norm(brand)))){brand='';bsrc='none'}if(bsrc==='unknown')bsrc='none'}
  const probe=subGroup(it,brand,type,words,null);if(probe.last)cnt[type]=(cnt[type]||0)+1;pre.push({it,type,brand,bsrc})}
 const ownType=Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0];const own=ownType?ownType[0]:null;
 const prods=new Map();
 for(const {it,type,brand,bsrc} of pre){const sg=subGroup(it,brand,type,words,own);
  const pk=type+'|'+productKey(it,brand);let p=prods.get(pk);
  const disp=(it.chain==='countdown'||it.chain==='farro'&&it.name===it.name.toLowerCase())?titleCase(it.name):it.name;
  if(!p){p={key:pk,type,brand,brandSrc:bsrc,name:disp,size:sizeOf(it),packSize:it.packSize,sub:sg,own:type===own,items:[]};prods.set(pk,p)}
  if(it.chain==='paknsave'||it.chain==='new-world'){p.name=it.name;if(bsrc==='baskt'&&brand){p.brand=brand;p.brandSrc='baskt'}}
  p.items.push({id:it.id,chain:it.chain,name:it.name,brand:it.brand,size:it.packSize,sku:it.externalSku,gtin:it.gtin||null,category:it.category,subcategory:it.subcategory,prices:prices[it.id]||{}})}
 const out=[...prods.values()];out.ownType=own;return out}
const api={brandQuery,hayOf,brandHit,popRank,brandSet,POPULAR,MATCH_SYN,C,TERM,resolve,complete,plan,chainQ,matches,singular,plural,typeOf,brandOf,makeBrandIndex,sizeOf,unitNorm,subGroup,productKey,build,TYPES,titleCase,norm,wordForms};
if(typeof module!=='undefined')module.exports=api;else root.NZS=api;
})(typeof window!=='undefined'?window:globalThis);
