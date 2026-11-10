(function(){
"use strict";
var PID=location.pathname.split("/")[2]||"";var BASE="/api/projects/"+encodeURIComponent(PID);
var ST=[["acik","Açık"],["devam","Devam ediyor"],["beklemede","Beklemede"],["cozuldu","Çözüldü"]];
var PR=[["kritik","Kritik"],["yuksek","Yüksek"],["orta","Orta"],["dusuk","Düşük"]];
var CAT=[["ci","CI / Vercel derlemesi"],["prod","Üretim hatası"],["aws","AWS güvenlik olayı"],["store","App Store / TestFlight"],["diger","Diğer"]];
var ENV=[["local","local"],["staging","staging"],["production","production"]];
var DST=[["bekliyor","Karar bekliyor"],["verildi","Karar verildi"],["uygulandi","Uygulandı"]];
var VIEWS=["kanban","liste","zaman","hafta","kararlar","hatirlatmalar","ayarlar"];
var SRC={vercel:"Vercel",github:"GitHub",apple:"App Store",aws:"AWS"};
var records=[],decisions=[],reminders=[],meta={services:[]},loaded=false,weekOff=0;
var F={q:"",status:"",owner:"",priority:"",area:""};
try{var s=JSON.parse(localStorage.getItem("nw-filters-"+PID)||"null");if(s)for(var k in F)if(typeof s[k]==="string")F[k]=s[k];}catch(e){}
function $(id){return document.getElementById(id)}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})}
function label(arr,key){for(var i=0;i<arr.length;i++)if(arr[i][0]===key)return arr[i][1];return key||""}
function pad(n){return n<10?"0"+n:""+n}
function ymd(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())}
function today(){return ymd(new Date())}
function day(v){if(!v)return"";v=String(v);return v.length===10?v:ymd(new Date(v))}
function fromYmd(s){var p=s.split("-");return new Date(+p[0],+p[1]-1,+p[2])}
function fmt(v,long){var s=day(v);if(!s)return"";var d=fromYmd(s);if(isNaN(d))return"";return d.toLocaleDateString("tr-TR",long?{day:"numeric",month:"long",year:"numeric",weekday:"long"}:{day:"numeric",month:"short"})}
function isDone(r){return r.status==="cozuldu"}
function isLate(r){return !isDone(r)&&r.dueDate&&r.dueDate<today()}
function prRank(r){var i=["kritik","yuksek","orta","dusuk"].indexOf(r.priority);return i<0?9:i}
function toast(m){var t=$("toast");t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(function(){t.hidden=true},3600)}
function fail(e){toast(e&&e.code==="invalid_argument"?"Bu görünümde değişiklik kaydedilemiyor.":e&&e.code==="quota_exceeded"?"Depolama doldu, eski kayıtları silmen gerekiyor.":"Kaydedilemedi, tekrar dene.")}
function view(){var h=location.hash.slice(1);return VIEWS.indexOf(h)>=0?h:"kanban"}

/* ---------- filtreler ---------- */
function opts(el,first,arr,val){el.innerHTML='<option value="">'+esc(first)+"</option>"+arr.map(function(a){return'<option value="'+esc(a[0])+'">'+esc(a[1])+"</option>"}).join("");el.value=val;if(el.value!==val){el.value=""}}
function uniq(key){var m={};records.forEach(function(r){if(r[key])m[r[key]]=1});return Object.keys(m).sort(function(a,b){return a.localeCompare(b,"tr")})}
function syncFilters(){
  opts($("f-status"),"Tüm durumlar",ST,F.status);
  opts($("f-priority"),"Tüm öncelikler",PR,F.priority);
  var ow=uniq("owner"),ar=uniq("area");
  opts($("f-owner"),"Tüm sorumlular",ow.map(function(x){return[x,x]}),F.owner);
  opts($("f-area"),"Tüm proje alanları",ar.map(function(x){return[x,x]}),F.area);
  $("dl-owner").innerHTML=ow.map(function(x){return'<option value="'+esc(x)+'">'}).join("");
  $("dl-area").innerHTML=ar.concat(["Web","Mobil iOS","Backend / API","Altyapı / AWS"]).filter(function(x,i,a){return a.indexOf(x)===i}).map(function(x){return'<option value="'+esc(x)+'">'}).join("");
}
function filtered(){
  var q=F.q.trim().toLocaleLowerCase("tr");
  return records.filter(function(r){
    if(F.status&&r.status!==F.status)return false;
    if(F.owner&&r.owner!==F.owner)return false;
    if(F.priority&&r.priority!==F.priority)return false;
    if(F.area&&r.area!==F.area)return false;
    if(q&&[r.title,r.errorMessage,r.nextAction,r.expectedFix,r.owner].join(" ").toLocaleLowerCase("tr").indexOf(q)<0)return false;
    return true;
  });
}
["status","owner","priority","area"].forEach(function(k){$("f-"+k).addEventListener("change",function(e){F[k]=e.target.value;saveF();render()})});
$("f-q").value=F.q;
$("f-q").addEventListener("input",function(e){F.q=e.target.value;saveF();render()});
function saveF(){try{localStorage.setItem("nw-filters-"+PID,JSON.stringify(F))}catch(e){}}

/* ---------- parçalar ---------- */
function chips(r,withStatus){
  var h="";
  if(isLate(r))h+='<span class="chip late">Gecikti · '+esc(fmt(r.dueDate))+"</span>";
  h+='<span class="chip p-'+esc(r.priority)+'">'+esc(label(PR,r.priority))+"</span>";
  if(withStatus)h+='<span class="chip s-'+esc(r.status)+'">'+esc(label(ST,r.status))+"</span>";
  h+='<span class="chip">'+esc(label(CAT,r.category))+"</span>";
  if(r.env)h+='<span class="chip env-'+esc(r.env)+'">'+esc(r.env)+"</span>";
  if(r.area)h+='<span class="chip">'+esc(r.area)+"</span>";
  if(r.source&&SRC[r.source])h+='<span class="chip s-devam">'+SRC[r.source]+" · otomatik</span>";
  return h;
}
function sub(r){
  var a=[];if(r.owner)a.push(esc(r.owner));
  if(isDone(r)&&r.resolvedAt)a.push("çözüldü "+esc(fmt(r.resolvedAt)));
  else if(r.dueDate&&!isLate(r))a.push("hedef "+esc(fmt(r.dueDate)));
  if(r.updatedAt)a.push("güncellendi "+esc(fmt(r.updatedAt)));
  return a.join(" · ");
}
function cardHtml(r,inBoard){
  var cls="card p-"+esc(r.priority)+(isLate(r)?" is-late":"")+(isDone(r)?" is-done":"");
  var idx=ST.map(function(s){return s[0]}).indexOf(r.status),nx=ST[idx+1];
  if(inBoard)return'<div class="'+cls+'" role="button" tabindex="0" draggable="true" data-rec="'+esc(r.id)+'">'+
    '<div class="t">'+esc(r.title)+'</div><div class="meta">'+chips(r,false)+"</div>"+
    (r.nextAction&&!isDone(r)?'<div class="next"><b>Sonraki:</b> '+esc(r.nextAction)+"</div>":"")+
    '<div class="card-row"><span class="muted small">'+sub(r)+"</span>"+(nx?'<button type="button" class="adv" data-adv="'+esc(r.id)+'" data-to="'+nx[0]+'" title="'+esc(nx[1])+' sütununa taşı">'+esc(nx[1])+" →</button>":"")+"</div></div>";
  return'<div class="'+cls+'" role="button" tabindex="0" data-rec="'+esc(r.id)+'"><div class="main"><div class="t">'+esc(r.title)+"</div>"+
    (r.nextAction&&!isDone(r)?'<div class="next"><b>Sonraki:</b> '+esc(r.nextAction)+"</div>":"")+
    '<span class="muted small">'+sub(r)+'</span></div><div class="side">'+chips(r,true)+"</div></div>";
}
function sortRecs(a){return a.slice().sort(function(x,y){
  return (isDone(x)-isDone(y))||(isLate(y)-isLate(x))||(prRank(x)-prRank(y))||String(y.updatedAt||"").localeCompare(String(x.updatedAt||""));
})}

/* ---------- görünümler ---------- */
function vKanban(list){
  return'<div class="board">'+ST.map(function(s){
    var items=sortRecs(list.filter(function(r){return r.status===s[0]}));
    return'<section class="col" data-col="'+s[0]+'"><h3>'+esc(s[1])+"<span>"+items.length+"</span></h3>"+
      (items.length?items.map(function(r){return cardHtml(r,true)}).join(""):'<div class="empty">Kayıt yok</div>')+"</section>";
  }).join("")+"</div>";
}
function vList(list){
  if(!list.length)return'<div class="empty">Bu filtrelere uyan kayıt yok.</div>';
  return'<div class="list">'+sortRecs(list).map(function(r){return cardHtml(r,false)}).join("")+"</div>";
}
function vTimeline(list){
  var ev=[],t=today();
  list.forEach(function(r){
    if(r.createdAt)ev.push({d:day(r.createdAt),k:"Açıldı",c:"",r:r});
    if(isDone(r)&&r.resolvedAt)ev.push({d:day(r.resolvedAt),k:"Çözüldü",c:"ev-done",r:r});
    if(!isDone(r)&&r.dueDate)ev.push({d:r.dueDate,k:r.dueDate<t?"Hedef tarih geçti":"Hedef tarih",c:r.dueDate<t?"ev-late":"ev-due",r:r});
  });
  if(!ev.length)return'<div class="empty">Bu filtrelere uyan kayıt yok.</div>';
  var g={};ev.forEach(function(e){(g[e.d]=g[e.d]||[]).push(e)});
  return'<div class="tl">'+Object.keys(g).sort().reverse().map(function(d){
    var tag=d===t?"Bugün · ":d>t?"Yaklaşan · ":"";
    return'<section class="tl-day'+(d===t?" today":"")+'"><h3>'+tag+esc(fmt(d,true))+'</h3><div class="tl-items">'+
      g[d].map(function(e){return'<button type="button" class="tl-ev '+e.c+'" data-rec="'+esc(e.r.id)+'"><span class="k">'+e.k+'</span><span class="t" style="font-weight:600">'+esc(e.r.title)+'</span><span class="meta">'+chips(e.r,true)+"</span></button>"}).join("")+"</div></section>";
  }).join("")+"</div>";
}
function weekRange(){var d=new Date();d.setHours(12,0,0,0);var w=(d.getDay()+6)%7;d.setDate(d.getDate()-w+weekOff*7);var e=new Date(d);e.setDate(e.getDate()+6);return[ymd(d),ymd(e)]}
function weekData(){
  var w=weekRange(),a=w[0],b=w[1];
  function inW(v){var s=day(v);return s&&s>=a&&s<=b}
  return{a:a,b:b,
    opened:records.filter(function(r){return inW(r.createdAt)}),
    resolved:records.filter(function(r){return isDone(r)&&inW(r.resolvedAt)}),
    crit:records.filter(function(r){return !isDone(r)&&r.priority==="kritik"}),
    late:records.filter(isLate),
    dec:decisions.filter(function(d){return d.status!=="bekliyor"&&inW(d.decidedAt)}),
    pend:decisions.filter(function(d){return d.status==="bekliyor"})};
}
function miniRec(r){return'<button type="button" class="row" data-rec="'+esc(r.id)+'"><span class="t">'+esc(r.title)+'</span><span class="meta">'+chips(r,true)+"</span></button>"}
function decRow(d){return'<button type="button" class="row d-'+esc(d.status)+'" data-dec="'+esc(d.id)+'"><span class="t">'+esc(d.title)+"</span>"+(d.note?'<span class="note">'+esc(d.note)+"</span>":"")+
  '<span class="meta"><span class="chip">'+esc(label(DST,d.status))+"</span>"+(d.owner?'<span class="chip">'+esc(d.owner)+"</span>":"")+(d.decidedAt?'<span class="muted small">karar '+esc(fmt(d.decidedAt))+"</span>":"")+"</span></button>"}
function block(title,items,fn,empty){return'<div class="sec"><h3>'+esc(title)+' <span class="muted small">'+items.length+"</span></h3>"+(items.length?items.map(fn).join(""):'<div class="empty">'+esc(empty)+"</div>")+"</div>"}
function vWeek(){
  var w=weekData();
  return'<div class="sec" style="gap:14px"><div class="weekbar"><h2>'+esc(fmt(w.a))+" – "+esc(fmt(w.b))+(weekOff===0?' <span class="muted small">bu hafta</span>':"")+'</h2><div style="display:flex;gap:6px"><button type="button" class="btn sm" data-week="-1">← Önceki</button><button type="button" class="btn sm" data-week="1"'+(weekOff>=0?" disabled":"")+'>Sonraki →</button><button type="button" class="btn sm" id="copyWeek">Özeti kopyala</button></div></div>'+
    '<div class="stats"><div class="stat acc"><b>'+w.opened.length+'</b><span>bu hafta açılan</span></div><div class="stat done"><b>'+w.resolved.length+'</b><span>bu hafta çözülen</span></div><div class="stat crit"><b>'+w.crit.length+'</b><span>açık kritik (şu an)</span></div><div class="stat warn"><b>'+w.late.length+"</b><span>geciken (şu an)</span></div></div>"+
    '<div class="cols2">'+block("Çözülenler",w.resolved,miniRec,"Bu hafta çözülen kayıt yok.")+block("Açılanlar",w.opened,miniRec,"Bu hafta açılan kayıt yok.")+"</div>"+
    '<div class="cols2">'+block("Bu hafta verilen kararlar",w.dec,decRow,"Bu hafta karar kaydı yok.")+block("Karar bekleyen maddeler",w.pend,decRow,"Bekleyen madde yok.")+"</div></div>";
}
function weekText(){
  var w=weekData(),L=[((meta.project&&meta.project.name)||"Proje")+" haftalık özet ("+fmt(w.a)+" – "+fmt(w.b)+")","Açılan: "+w.opened.length+" | Çözülen: "+w.resolved.length+" | Açık kritik: "+w.crit.length+" | Geciken: "+w.late.length];
  function sec(t,arr,fn){if(arr.length){L.push("",t+":");arr.forEach(function(x){L.push("- "+fn(x))})}}
  function rl(r){return r.title+" ["+label(PR,r.priority)+", "+label(ST,r.status)+"]"+(r.nextAction&&!isDone(r)?" → "+r.nextAction:"")}
  sec("Çözülenler",w.resolved,rl);sec("Açılanlar",w.opened,rl);sec("Açık kritikler",w.crit,rl);sec("Gecikenler",w.late,rl);
  sec("Verilen kararlar",w.dec,function(d){return d.title+(d.note?": "+d.note:"")});sec("Karar bekleyenler",w.pend,function(d){return d.title});
  return L.join("\n");
}
function vDecisions(){
  function by(s){return decisions.filter(function(d){return d.status===s}).sort(function(a,b){return String(b.decidedAt||b.createdAt||"").localeCompare(String(a.decidedAt||a.createdAt||""))})}
  return'<div class="sec" style="gap:14px"><div><button type="button" class="btn primary" id="addDecision">+ Karar maddesi</button></div>'+block("Karar bekliyor",by("bekliyor"),decRow,"Bekleyen madde yok.")+block("Karar verildi",by("verildi"),decRow,"Henüz karar kaydı yok.")+block("Uygulandı",by("uygulandi"),decRow,"Uygulanan karar yok.")+"</div>";
}
function vAttn(){
  var el=$("attn"),v=view();
  var items=records.filter(function(r){return !isDone(r)&&(r.priority==="kritik"||isLate(r))}).sort(function(a,b){return(isLate(b)-isLate(a))||(prRank(a)-prRank(b))});
  if(!items.length||VIEWS.indexOf(v)>3){el.hidden=true;return}
  var c=items.filter(function(r){return r.priority==="kritik"}).length,l=items.filter(isLate).length;
  el.hidden=false;
  el.innerHTML="<h2>Önce bunlar <b>"+c+" kritik</b> <i>"+l+' geciken</i></h2><div class="attn-list">'+items.map(function(r){
    return'<button type="button" class="attn-item" data-rec="'+esc(r.id)+'"><strong>'+esc(r.title)+'</strong><span class="meta">'+(isLate(r)?'<span class="chip late">Gecikti · '+esc(fmt(r.dueDate))+"</span>":"")+(r.priority==="kritik"?'<span class="chip p-kritik">Kritik</span>':"")+'<span class="chip s-'+esc(r.status)+'">'+esc(label(ST,r.status))+"</span></span></button>"}).join("")+"</div>";
}
function render(){
  var v=view();
  document.querySelectorAll("nav.tabs a").forEach(function(a){if(a.getAttribute("href")==="#"+v)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});
  $("filters").hidden=VIEWS.indexOf(v)>2;
  var open=records.filter(function(r){return !isDone(r)}).length;
  $("sub").textContent=loaded?open+" açık kayıt · "+records.length+" toplam":"Geliştirme ve operasyon kayıtları";
  vAttn();
  if(!loaded){return}
  var m=$("view");
  if(v==="hafta")m.innerHTML=vWeek();
  else if(v==="kararlar")m.innerHTML=vDecisions();
  else if(v==="hatirlatmalar")m.innerHTML=vReminders();
  else if(v==="ayarlar")m.innerHTML=vSettings();
  else if(!records.length)m.innerHTML='<div class="empty">Henüz kayıt yok. Sağ üstteki “+ Kayıt” ile ilkini ekle.</div>';
  else{var list=filtered();m.innerHTML=v==="liste"?vList(list):v==="zaman"?vTimeline(list):vKanban(list)}
}
window.addEventListener("hashchange",render);

/* ---------- yazma ---------- */
function need(){return true}
async function api(method,path,body){
  var r=await fetch(path,{method:method,headers:body?{"Content-Type":"application/json"}:undefined,body:body?JSON.stringify(body):undefined,cache:"no-store"});
  if(r.status===401){location.href="/login";throw new Error("Oturum kapandı")}
  var j=null;try{j=await r.json()}catch(e){}
  if(!r.ok)throw new Error((j&&j.error)||("Hata "+r.status));
  return j;
}
function write(p){return p.then(load).catch(function(e){toast(e.message||"Kaydedilemedi, tekrar dene.")})}
function setStatus(id,to){
  var r=records.find(function(x){return x.id===id});if(!r||r.status===to||!need())return;
  write(api("PUT",BASE+"/data/records/"+id,{status:to,resolvedAt:to==="cozuldu"?(r.resolvedAt||today()):""}));
}
function sel(id,arr,val){return'<select id="'+id+'">'+arr.map(function(a){return'<option value="'+a[0]+'"'+(a[0]===val?" selected":"")+">"+esc(a[1])+"</option>"}).join("")+"</select>"}
function openDlg(html){var d=$("dlg");d.innerHTML=html;if(d.showModal){if(!d.open)d.showModal()}else d.setAttribute("open","");d.scrollTop=0}
function closeDlg(){var d=$("dlg");if(d.close&&d.open)d.close();else d.removeAttribute("open")}
function val(id){return $(id).value.trim()}
function safeUrl(u){return /^https?:\/\//i.test(u||"")?u:""}
function editRecord(id){
  var r=id?records.find(function(x){return x.id===id}):null;
  if(id&&!r)return;
  r=r||{title:"",category:"ci",area:"",owner:"",status:"acik",priority:"orta",env:"production",sourceUrl:"",createdAt:today(),dueDate:"",errorMessage:"",expectedFix:"",nextAction:"",resolvedAt:""};
  var u=safeUrl(r.sourceUrl);
  openDlg('<div class="dlg-head"><h2>'+(id?"Kaydı düzenle":"Yeni kayıt")+'</h2><button type="button" class="btn sm ghost" data-close>Kapat</button></div><form class="body" id="recForm" novalidate>'+
  '<label class="full">Başlık<input type="text" id="r-title" required value="'+esc(r.title)+'" placeholder="Örn. main dalında Vercel derlemesi düşüyor"></label>'+
  "<label>Kategori"+sel("r-category",CAT,r.category)+"</label><label>Durum"+sel("r-status",ST,r.status)+"</label>"+
  "<label>Öncelik"+sel("r-priority",PR,r.priority)+"</label><label>Ortam"+sel("r-env",ENV,r.env)+"</label>"+
  '<label>Sorumlu<input type="text" id="r-owner" list="dl-owner" value="'+esc(r.owner)+'"></label><label>Proje alanı<input type="text" id="r-area" list="dl-area" value="'+esc(r.area)+'" placeholder="Web, Mobil iOS…"></label>'+
  '<label class="full">Kaynak bağlantısı<input type="url" id="r-sourceUrl" value="'+esc(r.sourceUrl)+'" placeholder="https://…">'+(u?'<a class="src" href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">Kaynağı aç ↗</a>':"")+"</label>"+
  '<label class="full">Hata mesajı<textarea id="r-errorMessage" class="mono">'+esc(r.errorMessage)+"</textarea></label>"+
  '<label class="full">Beklenen çözüm<textarea id="r-expectedFix">'+esc(r.expectedFix)+"</textarea></label>"+
  '<label class="full">Sonraki aksiyon<input type="text" id="r-nextAction" value="'+esc(r.nextAction)+'"></label>'+
  '<label>Oluşturulma tarihi<input type="date" id="r-createdAt" value="'+esc(day(r.createdAt))+'"></label><label>Hedef tarih<input type="date" id="r-dueDate" value="'+esc(r.dueDate||"")+'"></label>'+
  '<label>Çözülme tarihi<input type="date" id="r-resolvedAt" value="'+esc(day(r.resolvedAt))+'"></label><label>Son güncelleme<input type="text" id="r-updatedAt" disabled value="'+esc(r.updatedAt?new Date(r.updatedAt).toLocaleString("tr-TR",{dateStyle:"medium",timeStyle:"short"}):"—")+'"></label>'+
  '<div class="dlg-foot"><div>'+(id?'<button type="button" class="btn danger" data-del="records/'+esc(id)+'">Sil</button>':"")+'</div><div><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></div></form>');
  $("recForm").addEventListener("submit",function(e){
    e.preventDefault();
    if(!val("r-title")){toast("Başlık gerekli.");$("r-title").focus();return}
    if(!need())return;
    var d={title:val("r-title"),category:val("r-category"),status:val("r-status"),priority:val("r-priority"),env:val("r-env"),owner:val("r-owner"),area:val("r-area"),sourceUrl:val("r-sourceUrl"),errorMessage:$("r-errorMessage").value.trim(),expectedFix:$("r-expectedFix").value.trim(),nextAction:val("r-nextAction"),createdAt:val("r-createdAt")||today(),dueDate:val("r-dueDate"),resolvedAt:val("r-resolvedAt"),updatedAt:new Date().toISOString()};
    if(d.status==="cozuldu"&&!d.resolvedAt)d.resolvedAt=today();
    if(d.status!=="cozuldu")d.resolvedAt="";
    write(api(id?"PUT":"POST",BASE+"/data/records"+(id?"/"+id:""),d));closeDlg();
  });
}
function editDecision(id){
  var d=id?decisions.find(function(x){return x.id===id}):null;
  if(id&&!d)return;
  d=d||{title:"",note:"",status:"bekliyor",owner:"",decidedAt:"",createdAt:today()};
  openDlg('<div class="dlg-head"><h2>'+(id?"Karar maddesini düzenle":"Yeni karar maddesi")+'</h2><button type="button" class="btn sm ghost" data-close>Kapat</button></div><form class="body" id="decForm" novalidate>'+
  '<label class="full">Madde<input type="text" id="d-title" required value="'+esc(d.title)+'" placeholder="Örn. IAM anahtarları 90 günde bir döndürülecek"></label>'+
  '<label class="full">Karar ve gerekçe<textarea id="d-note">'+esc(d.note)+"</textarea></label>"+
  "<label>Durum"+sel("d-status",DST,d.status)+'</label><label>Sorumlu<input type="text" id="d-owner" list="dl-owner" value="'+esc(d.owner)+'"></label>'+
  '<label>Karar tarihi<input type="date" id="d-decidedAt" value="'+esc(d.decidedAt||"")+'"></label><label>Eklenme tarihi<input type="date" id="d-createdAt" value="'+esc(day(d.createdAt))+'"></label>'+
  '<div class="dlg-foot"><div>'+(id?'<button type="button" class="btn danger" data-del="decisions/'+esc(id)+'">Sil</button>':"")+'</div><div><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></div></form>');
  $("decForm").addEventListener("submit",function(e){
    e.preventDefault();
    if(!val("d-title")){toast("Madde başlığı gerekli.");$("d-title").focus();return}
    if(!need())return;
    var o={title:val("d-title"),note:$("d-note").value.trim(),status:val("d-status"),owner:val("d-owner"),decidedAt:val("d-decidedAt"),createdAt:val("d-createdAt")||today(),updatedAt:new Date().toISOString()};
    if(o.status!=="bekliyor"&&!o.decidedAt)o.decidedAt=today();
    write(api(id?"PUT":"POST",BASE+"/data/decisions"+(id?"/"+id:""),o));closeDlg();
  });
}
$("addRecord").addEventListener("click",function(){editRecord(null)});
$("dlg").addEventListener("click",function(e){
  var t=e.target;
  if(t===this||t.closest("[data-close]")){closeDlg();return}
  var del=t.closest("[data-del]");
  if(del){
    if(!del.dataset.sure){del.dataset.sure="1";del.textContent="Emin misin? Kalıcı olarak sil";return}
    write(api("DELETE",BASE+"/data/"+del.dataset.del));closeDlg();
  }
});
document.addEventListener("click",function(e){
  var t=e.target;
  if(t.closest("#addDecision")){editDecision(null);return}
  if(t.closest("#addReminder")){editReminder(null);return}
  var rd=t.closest("[data-remdone]");if(rd){write(api("PUT",BASE+"/data/reminders/"+rd.dataset.remdone,{done:rd.dataset.to==="1"}));return}
  var rm=t.closest("[data-rem]");if(rm&&!t.closest("dialog")){editReminder(rm.dataset.rem);return}
  if(t.closest("#saveProject")){write(api("PUT",BASE,{name:val("s-name"),notifyEmail:val("s-email"),defaultOwner:val("s-owner"),members:val("s-members")}).then(function(){toast("Proje ayarları kaydedildi.")}));return}
  var ss=t.closest("[data-svc-save]");if(ss){var vals={};SVCF[ss.dataset.svcSave].forEach(function(f){var el=$("c-"+f[0]);if(!el)return;var v=el.value.trim();if(f[2]&&!v)return;vals[f[0]]=v});write(api("PUT",BASE+"/credentials",{values:vals}).then(function(){toast("Bağlantı kaydedildi.")}));return}
  var sc=t.closest("[data-svc-clear]");if(sc){if(!sc.dataset.sure){sc.dataset.sure="1";sc.textContent="Emin misin? Kaldır";return}write(api("PUT",BASE+"/credentials",{clear:sc.dataset.svcClear}));return}
  var dp=t.closest("#delProject");if(dp){if(!dp.dataset.sure){dp.dataset.sure="1";dp.textContent="Emin misin? Tüm kayıtlarıyla sil";return}api("DELETE",BASE).then(function(){location.href="/"}).catch(function(e){toast(e.message)});return}
  if(t.closest("#runNow")){toast("Servisler kontrol ediliyor…");write(api("POST",BASE+"/run",{}).then(function(j){toast("Kontrol bitti: "+j.created+" yeni kayıt.")}));return}
  if(t.closest("#mailNow")){toast("Özet gönderiliyor…");write(api("POST",BASE+"/run",{mail:true}).then(function(j){toast("Özet "+j.mailedTo+" adresine gönderildi.")}));return}
  if(t.closest("#logout")){api("POST","/api/auth/logout",{}).then(function(){location.href="/login"});return}
  var adv=t.closest("[data-adv]");if(adv){e.stopPropagation();setStatus(adv.dataset.adv,adv.dataset.to);return}
  var wk=t.closest("[data-week]");if(wk){weekOff=Math.min(0,weekOff+ +wk.dataset.week);render();return}
  if(t.closest("#copyWeek")){var txt=weekText();try{navigator.clipboard.writeText(txt).then(function(){toast("Haftalık özet kopyalandı.")},function(){toast("Kopyalanamadı.")})}catch(x){toast("Kopyalanamadı.")}return}
  var rec=t.closest("[data-rec]");if(rec&&!t.closest("dialog")){editRecord(rec.dataset.rec);return}
  var dec=t.closest("[data-dec]");if(dec){editDecision(dec.dataset.dec)}
});
document.addEventListener("keydown",function(e){
  if((e.key==="Enter"||e.key===" ")&&e.target.matches&&e.target.matches("div[data-rec]")){e.preventDefault();editRecord(e.target.dataset.rec)}
});
/* sürükle bırak (masaüstü) */
var dragId=null;
document.addEventListener("dragstart",function(e){var c=e.target.closest&&e.target.closest("[data-rec][draggable]");if(c){dragId=c.dataset.rec;try{e.dataTransfer.setData("text/plain",dragId);e.dataTransfer.effectAllowed="move"}catch(x){}}});
document.addEventListener("dragover",function(e){var c=e.target.closest&&e.target.closest("[data-col]");if(c&&dragId){e.preventDefault();c.classList.add("over")}});
document.addEventListener("dragleave",function(e){var c=e.target.closest&&e.target.closest("[data-col]");if(c&&!c.contains(e.relatedTarget))c.classList.remove("over")});
document.addEventListener("drop",function(e){var c=e.target.closest&&e.target.closest("[data-col]");if(c&&dragId){e.preventDefault();c.classList.remove("over");setStatus(dragId,c.dataset.col)}dragId=null});
document.addEventListener("dragend",function(){dragId=null});

/* ---------- hatırlatmalar ---------- */
function remRow(m){
  var late=!m.done&&m.dueDate&&m.dueDate<today();
  return'<div class="row'+(m.done?" is-done":"")+'" role="button" tabindex="0" data-rem="'+esc(m.id)+'"><div class="row-line"><span class="t">'+esc(m.title)+'</span><button type="button" class="adv" data-remdone="'+esc(m.id)+'" data-to="'+(m.done?"0":"1")+'">'+(m.done?"Geri al":"Tamamlandı")+"</button></div>"+
    (m.note?'<span class="note">'+esc(m.note)+"</span>":"")+'<span class="meta">'+(m.dueDate?'<span class="chip'+(late?" late":"")+'">'+(late?"Gecikti · ":"")+esc(fmt(m.dueDate))+"</span>":'<span class="chip">tarihsiz</span>')+"</span></div>";
}
function vReminders(){
  var p=reminders.filter(function(m){return !m.done}).sort(function(a,b){return String(a.dueDate||"9").localeCompare(String(b.dueDate||"9"))});
  var d=reminders.filter(function(m){return m.done});
  return'<div class="sec" style="gap:14px"><div><button type="button" class="btn primary" id="addReminder">+ Hatırlatma</button></div><span class="muted small">Tarihi gelen hatırlatmalar, tamamlandı işaretlenene kadar her sabah mail özetine girer.</span>'+block("Bekleyen",p,remRow,"Bekleyen hatırlatma yok.")+block("Tamamlanan",d,remRow,"Tamamlanan yok.")+"</div>";
}
function editReminder(id){
  var m=id?reminders.find(function(x){return x.id===id}):null;
  if(id&&!m)return;
  m=m||{title:"",note:"",dueDate:today(),done:false};
  openDlg('<div class="dlg-head"><h2>'+(id?"Hatırlatmayı düzenle":"Yeni hatırlatma")+'</h2><button type="button" class="btn sm ghost" data-close>Kapat</button></div><form class="body" id="remForm" novalidate>'+
  '<label class="full">Yapılacak<input type="text" id="m-title" required value="'+esc(m.title)+'" placeholder="Örn. Apple geliştirici sertifikasını yenile"></label>'+
  '<label class="full">Not<textarea id="m-note">'+esc(m.note)+"</textarea></label>"+
  '<label>Hatırlatma tarihi<input type="date" id="m-dueDate" value="'+esc(m.dueDate||"")+'"></label><label>Durum'+sel("m-done",[["0","Bekliyor"],["1","Tamamlandı"]],m.done?"1":"0")+"</label>"+
  '<div class="dlg-foot"><div>'+(id?'<button type="button" class="btn danger" data-del="reminders/'+esc(id)+'">Sil</button>':"")+'</div><div><button type="button" class="btn ghost" data-close>Vazgeç</button><button type="submit" class="btn primary">Kaydet</button></div></div></form>');
  $("remForm").addEventListener("submit",function(e){
    e.preventDefault();
    if(!val("m-title")){toast("Başlık gerekli.");$("m-title").focus();return}
    var o={title:val("m-title"),note:$("m-note").value.trim(),dueDate:val("m-dueDate"),done:val("m-done")==="1"};
    write(api(id?"PUT":"POST",BASE+"/data/reminders"+(id?"/"+id:""),o));closeDlg();
  });
}
/* ---------- ayarlar ---------- */
var SVCF={vercel:[["vercelToken","Token",1],["vercelTeamId","Takım ID (isteğe bağlı)",0],["vercelProjects","Vercel proje adları (virgülle; boşsa hepsi)",0]],github:[["githubToken","Token",1],["githubRepos","Depolar (sahip/depo, virgülle)",0]],apple:[["ascKeyId","Key ID",0],["ascIssuerId","Issuer ID",0],["ascPrivateKey",".p8 dosyasının içeriği",2],["ascAppId","App ID (isteğe bağlı)",0]],aws:[["awsAccessKeyId","Access key ID",0],["awsSecretAccessKey","Secret access key",1]]};
function vSettings(){
  var p=meta.project||{},cr=meta.credentials||{values:{},set:{}},adm=!!meta.admin;
  var sv=(meta.services||[]).map(function(s){
    var chip=!s.configured?'<span class="chip">Bağlı değil</span>':s.ranAt?(s.ok?'<span class="chip ok">Çalışıyor</span>':'<span class="chip bad">Hata</span>'):'<span class="chip">Henüz çalışmadı</span>';
    var form="";
    if(adm)form='<details><summary class="src">'+(s.configured?"Bağlantıyı düzenle":"Bağla")+'</summary><div class="svc-form">'+SVCF[s.key].map(function(f){
      var id="c-"+f[0],ph=f[2]&&cr.set[f[0]]?"Kayıtlı. Değiştirmek için yeni değer gir":"";
      return"<label>"+esc(f[1])+(f[2]===2?'<textarea id="'+id+'" class="mono" placeholder="'+ph+'"></textarea>':'<input type="'+(f[2]?"password":"text")+'" id="'+id+'" autocomplete="off" value="'+esc(f[2]?"":(cr.values[f[0]]||""))+'" placeholder="'+ph+'">')+"</label>";
    }).join("")+'<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn primary sm" data-svc-save="'+s.key+'">Kaydet</button>'+(s.configured?'<button type="button" class="btn danger sm" data-svc-clear="'+s.key+'">Bağlantıyı kaldır</button>':"")+"</div></div></details>";
    return'<div class="svc"><div class="row-line"><strong>'+esc(s.label)+"</strong>"+chip+"</div>"+
      (s.message||s.ranAt?'<span class="muted small">'+esc(s.message||"")+(s.ranAt?" · "+esc(new Date(s.ranAt).toLocaleString("tr-TR",{dateStyle:"medium",timeStyle:"short"})):"")+"</span>":"")+form+"</div>";
  }).join("");
  var proj=adm?'<div class="sec"><h3>Proje</h3><div class="pform"><label>Proje adı<input type="text" id="s-name" value="'+esc(p.name||"")+'"></label><label>Bildirim adresi<input type="text" id="s-email" inputmode="email" value="'+esc(p.notifyEmail||"")+'" placeholder="ornek@alan.com"></label>'+
    '<label>Otomatik kayıtların sorumlusu<input type="text" id="s-owner" value="'+esc(p.defaultOwner||"")+'"></label><label>Üyeler (e-posta, virgülle)<input type="text" id="s-members" value="'+esc(p.members||"")+'" placeholder="Bu projeye girebilecek diğer kişiler"></label></div>'+
    '<div><button type="button" class="btn primary" id="saveProject">Kaydet</button></div><span class="muted small">Günlük özet ve hatırlatmalar her sabah 08:00 civarında bildirim adresine gider.'+(meta.mailConfigured?"":" Mail gönderimi için RESEND_API_KEY tanımlı değil.")+"</span></div>":"";
  return'<div class="sec" style="gap:18px">'+proj+'<div class="sec"><h3>Bağlı servisler</h3>'+(adm?'<span class="muted small">Token\'lar veritabanında şifreli saklanır ve kaydedildikten sonra bir daha gösterilmez.</span>':"")+sv+"</div>"+
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" id="runNow">Şimdi kontrol et</button><button type="button" class="btn" id="mailNow">Özet mailini şimdi gönder</button><button type="button" class="btn ghost" id="logout">Çıkış yap</button>'+(adm?'<button type="button" class="btn danger" id="delProject">Projeyi sil</button>':"")+"</div></div>";
}
/* ---------- veri ---------- */
function note(m){var s=$("status");if(m){s.textContent=m;s.hidden=false}else s.hidden=true}
async function load(){
  try{var s=await api("GET",BASE+"/state");records=s.records||[];decisions=s.decisions||[];reminders=s.reminders||[];meta=s.meta||{services:[]};note("");if(meta.project){$("pname").textContent=meta.project.name;document.title=meta.project.name+" · Night Watch"}}
  catch(e){note("Kayıtlara ulaşılamadı: "+(e.message||""))}
  loaded=true;
  var ae=document.activeElement;if(view()==="ayarlar"&&ae&&/^(INPUT|TEXTAREA)$/.test(ae.tagName)&&$("view").contains(ae))return;
  syncFilters();render();
}
document.addEventListener("keydown",function(e){
  if((e.key==="Enter"||e.key===" ")&&e.target.matches&&e.target.matches("div[data-rem]")){e.preventDefault();editReminder(e.target.dataset.rem)}
});
document.addEventListener("visibilitychange",function(){if(!document.hidden&&!$("dlg").open)load()});
syncFilters();render();load();
})();
