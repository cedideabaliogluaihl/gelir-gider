const KEY="gelirGiderV4";
let items=[];
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:2}).format(n);

function load(){try{const raw=localStorage.getItem(KEY);items=raw?JSON.parse(raw):[];if(!Array.isArray(items))items=[];}catch{items=[];}}
function save(){localStorage.setItem(KEY,JSON.stringify(items));render();}
function totals(rows){return{income:rows.filter(x=>x.type==="Gelir").reduce((s,x)=>s+x.amount,0),expense:rows.filter(x=>x.type==="Gider").reduce((s,x)=>s+x.amount,0),transfer:rows.filter(x=>x.type==="Kasa Transferi").reduce((s,x)=>s+x.amount,0)};}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

function isCardExpense(x){return x.type==="Gider" && x.payment==="Kredi Kartı" && !!x.card;}

function render(){
 const t=totals(items);
 $("totalIncome").textContent=money(t.income);$("totalExpense").textContent=money(t.expense);
 $("net").textContent=money(t.income-t.expense-t.transfer);$("totalTransfer").textContent=money(t.transfer);

 ["Kart 1","Kart 2","Kart 3"].forEach((card,i)=>{
   const v=items.filter(x=>isCardExpense(x)&&x.card===card).reduce((s,x)=>s+x.amount,0);
   $("card"+(i+1)).textContent=money(v);
 });
 $("cardsTotal").textContent=money(items.filter(isCardExpense).reduce((s,x)=>s+x.amount,0));

 const cardMonths=[...new Set(items.filter(isCardExpense).map(x=>x.date.slice(0,7)))].sort().reverse();
 $("cardMonthlyList").innerHTML=cardMonths.map(m=>{
   const vals=["Kart 1","Kart 2","Kart 3"].map(c=>items.filter(x=>isCardExpense(x)&&x.card===c&&x.date.startsWith(m)).reduce((s,x)=>s+x.amount,0));
   const total=vals.reduce((s,x)=>s+x,0),label=new Date(m+"-01T00:00:00").toLocaleDateString("tr-TR",{month:"long",year:"numeric"});
   return `<tr><td>${label}</td><td>${money(vals[0])}</td><td>${money(vals[1])}</td><td>${money(vals[2])}</td><td class="month-card-total">${money(total)}</td></tr>`;
 }).join("");
 $("cardMonthlyEmpty").style.display=cardMonths.length?"none":"block";

 const months=[...new Set(items.map(x=>x.date.slice(0,7)))].sort().reverse(),old=$("monthFilter").value;
 $("monthFilter").innerHTML='<option value="all">Tüm Aylar</option>'+months.map(m=>`<option value="${m}">${new Date(m+"-01T00:00:00").toLocaleDateString("tr-TR",{month:"long",year:"numeric"})}</option>`).join("");
 $("monthFilter").value=months.includes(old)?old:"all";
 const selected=$("monthFilter").value,filtered=selected==="all"?items:items.filter(x=>x.date.startsWith(selected)),mt=totals(filtered);
 $("monthIncome").textContent=money(mt.income);$("monthExpense").textContent=money(mt.expense);$("monthNet").textContent=money(mt.income-mt.expense-mt.transfer);$("monthTransfer").textContent=money(mt.transfer);

 const sorted=filtered.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
 $("list").innerHTML=sorted.map(x=>`<tr class="${x.type==="Gelir"?"income":x.type==="Gider"?"expense":"transfer"}">
 <td><input class="sel" type="checkbox" data-id="${x.id}"></td>
 <td>${new Date(x.date+"T00:00:00").toLocaleDateString("tr-TR")}</td><td>${escapeHtml(x.description)}</td><td>${x.type}</td>
 <td>${x.type==="Gider"?escapeHtml(x.payment||"Nakit"):"-"}</td><td>${x.card||"-"}</td><td class="amount">${money(x.amount)}</td></tr>`).join("");
 $("empty").style.display=sorted.length?"none":"block";
}

$("date").value=new Date().toISOString().slice(0,10);
function syncPayment(){const gider=$("type").value==="Gider";$("payment").disabled=!gider;$("card").disabled=!(gider&&$("payment").value==="Kredi Kartı");if($("card").disabled)$("card").value="";}
syncPayment();

$("form").addEventListener("submit",e=>{
 e.preventDefault();const type=$("type").value,description=$("description").value.trim(),amount=Number($("amount").value);
 if(!description)return alert("Açıklama gir.");if(!amount||amount<=0)return alert("Geçerli bir tutar gir.");
 const payment=type==="Gider"?$("payment").value:"";const card=payment==="Kredi Kartı"?$("card").value:"";
 if(type==="Gider"&&payment==="Kredi Kartı"&&!card)return alert("Kart seç.");
 items.push({id:Date.now(),date:$("date").value,description,type,payment,card,amount});
 $("description").value="";$("amount").value="";save();
});
$("type").addEventListener("change",syncPayment);$("payment").addEventListener("change",syncPayment);$("monthFilter").addEventListener("change",render);
$("clearBtn").addEventListener("click",()=>{const ids=[...document.querySelectorAll(".sel:checked")].map(x=>Number(x.dataset.id));if(!ids.length)return alert("Silmek için işlem seç.");if(confirm("Seçili işlemler silinsin mi?")){items=items.filter(x=>!ids.includes(x.id));save();}});
$("clearAllBtn").addEventListener("click",()=>{if(!items.length)return alert("Silinecek kayıt yok.");if(confirm("Bu uygulamadaki tüm kayıtlar silinecek. Devam edilsin mi?")){items=[];localStorage.removeItem(KEY);render();}});
$("exportBtn").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(items,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="gelir-gider-yedek.json";a.click();URL.revokeObjectURL(url);});
load();render();
