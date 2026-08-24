const KEY="gelirGiderV1";
let items=JSON.parse(localStorage.getItem(KEY)||"[]");
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY",maximumFractionDigits:2}).format(n);
const today=new Date();
$("date").value=today.toISOString().slice(0,10);
$("card").disabled=false;

function save(){localStorage.setItem(KEY,JSON.stringify(items)); 
$("clearAllBtn").addEventListener("click",()=>{
  if(!items.length)return alert("Silinecek kayıt yok.");
  if(confirm("TÜM gelir, gider, kasa ve kart kayıtları silinecek. Devam edilsin mi?")){
    items=[];
    localStorage.removeItem(KEY);
    render();
  }
});

render();}
function totals(rows){
  return {
    income:rows.filter(x=>x.type==="Gelir").reduce((s,x)=>s+x.amount,0),
    expense:rows.filter(x=>x.type==="Gider").reduce((s,x)=>s+x.amount,0),
    transfer:rows.filter(x=>x.type==="Kasa Transferi").reduce((s,x)=>s+x.amount,0)
  };
}
function render(){
  const t=totals(items);
  $("totalIncome").textContent=money(t.income);
  $("totalExpense").textContent=money(t.expense);
  $("net").textContent=money(t.income-t.expense-t.transfer);
  $("totalTransfer").textContent=money(t.transfer);
  $("totalAssets").textContent=money(t.income-t.expense);

  ["Kart 1","Kart 2","Kart 3"].forEach((c,i)=>{
    const v=items.filter(x=>x.type==="Gider"&&x.card===c).reduce((s,x)=>s+x.amount,0);
    $("card"+(i+1)).textContent=money(v);
  });
  const ct=items.filter(x=>x.type==="Gider"&&x.card).reduce((s,x)=>s+x.amount,0);
  $("cardsTotal").textContent=money(ct);

  const months=[...new Set(items.map(x=>x.date.slice(0,7)))].sort().reverse();
  const current=$("monthFilter").value;
  $("monthFilter").innerHTML='<option value="all">Tüm Aylar</option>'+months.map(m=>`<option value="${m}">${new Date(m+"-01").toLocaleDateString("tr-TR",{month:"long",year:"numeric"})}</option>`).join("");
  $("monthFilter").value=months.includes(current)?current:"all";

  const selected=$("monthFilter").value;
  const filtered=selected==="all"?items:items.filter(x=>x.date.startsWith(selected));
  const mt=totals(filtered);
  $("monthIncome").textContent=money(mt.income);
  $("monthExpense").textContent=money(mt.expense);
  $("monthNet").textContent=money(mt.income-mt.expense-mt.transfer);
  $("monthTransfer").textContent=money(mt.transfer);
  $("monthAssets").textContent=money(mt.income-mt.expense);

  $("list").innerHTML=filtered.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`
    <tr class="${x.type==="Gelir"?"income":x.type==="Gider"?"expense":"transfer"}">
      <td><input class="sel" type="checkbox" data-id="${x.id}"></td>
      <td>${new Date(x.date+"T00:00:00").toLocaleDateString("tr-TR")}</td>
      <td>${escapeHtml(x.description)}</td><td>${x.type}</td><td>${x.card||"-"}</td>
      <td class="amount">${money(x.amount)}</td>
    </tr>`).join("");
}
function escapeHtml(s){return s.replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

$("form").addEventListener("submit",e=>{
  e.preventDefault();
  const type=$("type").value;
  const amount=Number($("amount").value);
  if(!amount||amount<=0)return alert("Geçerli bir tutar gir.");
  items.push({id:Date.now(),date:$("date").value,description:$("description").value.trim(),type,card:type==="Gider"?$("card").value:"",amount});
  $("description").value="";$("amount").value="";
  save();
});
$("type").addEventListener("change",()=>{$("card").disabled=$("type").value!=="Gider";});
$("monthFilter").addEventListener("change",render);
$("clearBtn").addEventListener("click",()=>{
  const ids=[...document.querySelectorAll(".sel:checked")].map(x=>Number(x.dataset.id));
  if(!ids.length)return alert("Silmek için işlem seç.");
  if(confirm("Seçili işlemler silinsin mi?")){items=items.filter(x=>!ids.includes(x.id));save();}
});
$("exportBtn").addEventListener("click",()=>{
  const blob=new Blob([JSON.stringify(items,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="gelir-gider-yedek.json";a.click();URL.revokeObjectURL(a.href);
});
render();
