const SETTINGS_KEY="gelirGiderSettingsV1";
const CAT_KEY="gelirGiderCategoriesV1";
let settings={cards:[{name:"Kart 1",limit:0},{name:"Kart 2",limit:0},{name:"Kart 3",limit:0}]};
let categories=["Genel","Market","Fatura","Kira","Yakıt","Yemek","Giyim","Sağlık","Diğer"];
const $=id=>document.getElementById(id);
function load(){try{let s=localStorage.getItem(SETTINGS_KEY);if(s){let q=JSON.parse(s);if(q&&Array.isArray(q.cards)&&q.cards.length===3)settings=q}let c=localStorage.getItem(CAT_KEY);if(c){let q=JSON.parse(c);if(Array.isArray(q)&&q.length)categories=q}}catch{}}
function save(){localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));localStorage.setItem(CAT_KEY,JSON.stringify(categories));}
function render(){settings.cards.forEach((c,i)=>{$("cardName"+(i+1)).value=c.name;$("cardLimit"+(i+1)).value=c.limit||""});$("categories").innerHTML=categories.map((c,i)=>`<div class="category-item"><span>${escapeHtml(c)}</span>${c!=="Genel"?`<button class="danger-outline cat-del" data-i="${i}">Sil</button>`:""}</div>`).join("");document.querySelectorAll(".cat-del").forEach(b=>b.addEventListener("click",()=>{categories.splice(Number(b.dataset.i),1);save();render()}))}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
$("saveCardsBtn").addEventListener("click",()=>{settings.cards=[1,2,3].map(i=>({name:$("cardName"+i).value.trim()||"Kart "+i,limit:Number($("cardLimit"+i).value)||0}));save();alert("Kart ayarları kaydedildi.")});
$("addCategoryBtn").addEventListener("click",()=>{let n=$("newCategory").value.trim();if(!n)return;if(categories.some(x=>x.toLowerCase()===n.toLowerCase()))return alert("Bu kategori zaten var.");categories.push(n);$("newCategory").value="";save();render()});
load();render();