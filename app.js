const KEY="gelirGiderV4";
const SETTINGS_KEY="gelirGiderSettingsV1";
let items=[];
let settings={cards:[
 {name:"Kart 1",limit:0},{name:"Kart 2",limit:0},{name:"Kart 3",limit:0}
]};
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:2}).format(n);
function load(){try{const a=localStorage.getItem(KEY);items=a?JSON.parse(a):[];if(!Array.isArray(items))items=[];const s=localStorage.getItem(SETTINGS_KEY);if(s){const q=JSON.parse(s);if(q&&Array.isArray(q.cards)&&q.cards.length===3)settings=q;}}catch{items=[];}}
function save(){localStorage.setItem(KEY,JSON.stringify(items));render();}
function saveSettings(){localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));render();}
function totals(r){return{income:r.filter(x=>x.type==="Gelir").reduce((s,x)=>s+x.amount,0),expense:r.filter(x=>x.type==="Gider").reduce((s,x)=>s+x.amount,0),transfer:r.filter(x=>x.type==="Kasa Transferi").reduce((s,x)=>s+x.amount,0)};}
function isCardExpense(x){return x.type==="Gider"&&x.payment==="Kredi Kartı"&&!!x.card;}
function esc(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function refreshCardControls(){const sel=$("card"),old=sel.value;sel.innerHTML='<option value="">Kart seç</option>'+settings.cards.map((c,i)=>`<option value="c${i}">${esc(c.name)}</option>`).join("");if([...sel.options].some(o=>o.value===old))sel.value=old;$("mh1").textContent=settings.cards[0].name;$("mh2").textContent=settings.cards[1].name;$("mh3").textContent=settings.cards[2].name;}
function renderSettings(){settings.cards.forEach((c,i)=>{$("cardName"+(i+1)).value=c.name;$("cardLimit"+(i+1)).value=c.limit||"";});refreshCardControls();}
function render(){
 const t=totals(items);$("totalIncome").textContent=money(t.income);$("totalExpense").textContent=money(t.expense);$("net").textContent=money(t.income-t.expense-t.transfer);$("totalTransfer").textContent=money(t.transfer);
 $("cardSummary").innerHTML=settings.cards.map((c,i)=>{const spent=items.filter(x=>isCardExpense(x)&&x.card==="c"+i).reduce((s,x)=>s+x.amount,0);const left=Math.max(0,(Number(c.limit)||0)-spent);return `<div><span>${esc(c.name)}</span><strong>${money(spent)}</strong><small>Limit: ${money(Number(c.limit)||0)} · Kalan: ${money(left)}</small></div>`;}).join("");
 const cm=[...new Set(items.filter(isCardExpense).map(x=>x.date.slice(0,7)))].sort().reverse();
 $("cardMonthlyList").innerHTML=cm.map(m=>{const v=settings.cards.map((c,i)=>items.filter(x=>isCardExpense(x)&&x.card==="c"+i&&x.date.startsWith(m)).reduce((s,x)=>s+x.amount,0));const total=v.reduce((s,x)=>s+x,0),label=new Date(m+"-01T00:00:00").toLocaleDateString("tr-TR",{month:"long",year:"numeric"});return `<tr><td>${label}</td><td>${money(v[0])}</td><td>${money(v[1])}</td><td>${money(v[2])}</td><td class="month-card-total">${money(total)}</td></tr>`;}).join("");$("cardMonthlyEmpty").style.display=cm.length?"none":"block";
 const months=[...new Set(items.map(x=>x.date.slice(0,7)))].sort().reverse(),old=$("monthFilter").value;$("monthFilter").innerHTML='<option value="all">Tüm Aylar</option>'+months.map(m=>`<option value="${m}">${new Date(m+"-01T00:00:00").toLocaleDateString("tr-TR",{month:"long",year:"numeric"})}</option>`).join("");$("monthFilter").value=months.includes(old)?old:"all";
 const sel=$("monthFilter").value,filtered=sel==="all"?items:items.filter(x=>x.date.startsWith(sel)),mt=totals(filtered);$("monthIncome").textContent=money(mt.income);$("monthExpense").textContent=money(mt.expense);$("monthNet").textContent=money(mt.income-mt.expense-mt.transfer);$("monthTransfer").textContent=money(mt.transfer);
 const sorted=filtered.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);$("list").innerHTML=sorted.map(x=>`<tr class="${x.type==="Gelir"?"income":x.type==="Gider"?"expense":"transfer"}"><td><input class="sel" type="checkbox" data-id="${x.id}"></td><td>${new Date(x.date+"T00:00:00").toLocaleDateString("tr-TR")}</td><td>${esc(x.description)}</td><td>${esc(x.category||"Genel")}</td><td>${x.type}</td><td>${x.type==="Gider"?esc(x.payment||"Nakit"):"-"}</td><td>${x.card&&x.card.startsWith("c")?esc(settings.cards[Number(x.card.slice(1))]?.name||"-"):"-"}</td><td class="amount">${money(x.amount)}</td></tr>`).join("");$("empty").style.display=sorted.length?"none":"block";
}
$("date").value=new Date().toISOString().slice(0,10);
function sync(){const gider=$("type").value==="Gider";$("payment").disabled=!gider;$("card").disabled=!(gider&&$("payment").value==="Kredi Kartı");if($("card").disabled)$("card").value="";}
$("saveCardsBtn").addEventListener("click",()=>{settings.cards=[1,2,3].map(i=>({name:$("cardName"+i).value.trim()||"Kart "+i,limit:Number($("cardLimit"+i).value)||0}));saveSettings();alert("Kart ayarları kaydedildi.");});
$("type").addEventListener("change",sync);$("payment").addEventListener("change",sync);$("monthFilter").addEventListener("change",render);
$("form").addEventListener("submit",e=>{e.preventDefault();const type=$("type").value,description=$("description").value.trim(),amount=Number($("amount").value);if(!description)return alert("Açıklama gir.");if(!amount||amount<=0)return alert("Geçerli bir tutar gir.");const payment=type==="Gider"?$("payment").value:"",card=payment==="Kredi Kartı"?$("card").value:"";if(type==="Gider"&&payment==="Kredi Kartı"&&!card)return alert("Kart seç.");items.push({id:Date.now(),date:$("date").value,description,type,payment,card,category:type==="Gider"?$("category").value:"Genel",amount});$("description").value="";$("amount").value="";save();});
$("clearBtn").addEventListener("click",()=>{const ids=[...document.querySelectorAll(".sel:checked")].map(x=>Number(x.dataset.id));if(!ids.length)return alert("Silmek için işlem seç.");if(confirm("Seçili işlemler silinsin mi?")){items=items.filter(x=>!ids.includes(x.id));save();}});
$("clearAllBtn").addEventListener("click",()=>{if(!items.length)return alert("Silinecek kayıt yok.");if(confirm("Tüm işlemler silinecek. Devam edilsin mi?")){items=[];localStorage.removeItem(KEY);render();}});
$("exportBtn").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({settings,items},null,2)],{type:"application/json"}),u=URL.createObjectURL(blob),a=document.createElement("a");a.href=u;a.download="gelir-gider-yedek.json";a.click();URL.revokeObjectURL(u);});
load();renderSettings();sync();render();