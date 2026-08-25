import { firebaseReady, getItems, getSettings, saveItems } from "./firebase-core.js";

let items=[];
let settings={};
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:2}).format(n);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
function isCard(x){return x.type==="Gider"&&x.payment==="Kredi Kartı"&&x.card?.startsWith("c")}
function installments(x){return Math.max(1,Number(x.installments)||1)}
function ym(d){return String(d).slice(0,7)}
function due(x,m){if(!isCard(x))return 0;const s=ym(x.date);const diff=(+m.slice(0,4)-+s.slice(0,4))*12+(+m.slice(5)-+s.slice(5));return diff>=0&&diff<installments(x)?x.amount/installments(x):0}
function currentMonth(){return new Date().toISOString().slice(0,7)}
function monthLabel(m){return new Date(m+"-01T00:00:00").toLocaleDateString("tr-TR",{month:"long",year:"numeric"})}
function populateCategories(){const type=$("type")?.value,sel=$("category");if(!sel)return;const arr=type==="Gelir"?settings.incomeCategories:settings.expenseCategories;sel.innerHTML=arr.map(x=>`<option>${esc(x)}</option>`).join("")}
function render(){
 const m=currentMonth(),label=monthLabel(m),current=items.filter(x=>x.date?.startsWith(m));
 const income=current.filter(x=>x.type==="Gelir").reduce((s,x)=>s+x.amount,0);
 const cashExpense=current.filter(x=>x.type==="Gider"&&!isCard(x)).reduce((s,x)=>s+x.amount,0);
 const cardExpense=items.reduce((s,x)=>s+due(x,m),0);
 const expense=cashExpense+cardExpense;
 const transfer=current.filter(x=>x.type==="Kasa Transferi").reduce((s,x)=>s+x.amount,0);
 $("totalIncome").textContent=money(income);$("totalExpense").textContent=money(expense);$("net").textContent=money(income-expense-transfer);$("totalTransfer").textContent=money(transfer);
 $("currentMonthLabel").textContent=label;$("transactionsTitle").textContent=`${label} İşlemleri`;
 $("cardSummary").innerHTML=settings.cards.map((c,i)=>{const value=items.reduce((s,x)=>s+due(x,m)*(x.card==="c"+i),0),limit=Number(c.limit)||0;return `<div><span>${esc(c.name)}</span><strong>${money(value)}</strong><small>Bu ay harcama</small><small>Limit: ${money(limit)} · Kalan: ${money(limit-value)}</small></div>`}).join("");
 $("monthIncome").textContent=money(income);$("monthExpense").textContent=money(expense);$("monthNet").textContent=money(income-expense-transfer);$("monthTransfer").textContent=money(transfer);
 const sorted=current.slice().sort((a,b)=>b.date.localeCompare(a.date)||(b.id-a.id));
 $("list").innerHTML=sorted.map(x=>`<tr class="${x.type==="Gelir"?"income":x.type==="Gider"?"expense":"transfer"}"><td><input class="sel" type="checkbox" data-id="${x.id}"></td><td>${new Date(x.date+"T00:00:00").toLocaleDateString("tr-TR")}</td><td>${esc(x.description)}</td><td>${esc(x.category||"Genel")}</td><td>${esc(x.type)}</td><td>${esc(x.payment||"-")}</td><td>${isCard(x)?esc(settings.cards[+x.card.slice(1)]?.name||"-"):"-"}</td><td>${isCard(x)?(installments(x)>1?installments(x)+" taksit":"Tek çekim"):"-"}</td><td class="amount">${money(isCard(x)?x.amount/installments(x):x.amount)}</td></tr>`).join("");
 $("empty").style.display=sorted.length?"none":"block";
}
function sync(){const g=$("type").value==="Gider",c=g&&$("payment").value==="Kredi Kartı";$("payment").disabled=!g;$("card").disabled=!c;$("installmentBox").hidden=!c;populateCategories()}
async function save(){await saveItems(items);render()}

async function main(){
 const data=await firebaseReady();items=data.items;settings=data.settings;
 $("date").value=currentMonth()+"-"+String(new Date().getDate()).padStart(2,"0");
 $("card").innerHTML='<option value="">Kart seç</option>'+settings.cards.map((c,i)=>`<option value="c${i}">${esc(c.name)}</option>`).join("");
 $("type").onchange=sync;$("payment").onchange=sync;
 $("installment").onchange=()=>{$("installmentFields").hidden=!$("installment").checked};
 $("amount").oninput=()=>{const box=$("installmentPreview");if(!$("installment").checked){box.textContent="";return}const a=Number($("amount").value),n=Number($("installmentCount").value)||1;box.textContent=a>0?`Aylık taksit: ${money(a/n)}`:""};
 $("installmentCount").onchange=$("amount").oninput;
 $("form").onsubmit=async e=>{e.preventDefault();const type=$("type").value,amount=Number($("amount").value),payment=type==="Gider"?$("payment").value:"",card=payment==="Kredi Kartı"?$("card").value:"",description=$("description").value.trim();if(!description)return alert("Açıklama gir.");if(!amount||amount<=0)return alert("Geçerli tutar gir.");if((type==="Gelir"||type==="Gider")&&!$("category").value)return alert("Kategori seç.");if(payment==="Kredi Kartı"&&!card)return alert("Kart seç.");const count=payment==="Kredi Kartı"&&$("installment").checked?Number($("installmentCount").value)||1:1;items.push({id:Date.now(),date:$("date").value,description,type,payment,card,category:type==="Kasa Transferi"?"Kasa Transferi":$("category").value,amount,installments:count});$("description").value="";$("amount").value="";$("installment").checked=false;$("installmentFields").hidden=true;$("installmentPreview").textContent="";try{await save()}catch(err){alert("Firebase kaydı başarısız: "+err.message)}};
 $("clearBtn").onclick=async()=>{const ids=[...document.querySelectorAll(".sel:checked")].map(x=>+x.dataset.id);if(!ids.length)return alert("Silmek için işlem seç.");if(confirm("Seçili işlemler silinsin mi?")){items=items.filter(x=>!ids.includes(x.id));await save()}};
 $("clearAllBtn").onclick=async()=>{if(confirm("Tüm kayıtlar silinecek. Bu işlem geri alınamaz. Devam edilsin mi?")){items=[];await save()}};
 $("exportBtn").onclick=()=>{const a=document.createElement("a"),u=URL.createObjectURL(new Blob([JSON.stringify(items,null,2)],{type:"application/json"}));a.href=u;a.download="gelir-gider-yedek.json";a.click();URL.revokeObjectURL(u)};
 sync();render();
}
main().catch(e=>{console.error(e);const el=document.getElementById("empty");if(el)el.textContent="Firebase bağlantısı kurulamadı: "+e.message});
