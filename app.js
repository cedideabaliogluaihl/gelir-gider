const KEY = "gelirGiderV4";
let items = [];

const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 2
}).format(n);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    items = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(items)) items = [];
  } catch {
    items = [];
  }
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(items));
  render();
}

function totals(rows) {
  return {
    income: rows.filter(x => x.type === "Gelir").reduce((s,x) => s + x.amount, 0),
    expense: rows.filter(x => x.type === "Gider").reduce((s,x) => s + x.amount, 0),
    transfer: rows.filter(x => x.type === "Kasa Transferi").reduce((s,x) => s + x.amount, 0)
  };
}

function render() {
  const t = totals(items);

  $("totalIncome").textContent = money(t.income);
  $("totalExpense").textContent = money(t.expense);
  $("net").textContent = money(t.income - t.expense - t.transfer);
  $("totalTransfer").textContent = money(t.transfer);

  ["Kart 1","Kart 2","Kart 3"].forEach((card, i) => {
    const value = items
      .filter(x => x.type === "Gider" && x.card === card)
      .reduce((s,x) => s + x.amount, 0);
    $("card" + (i + 1)).textContent = money(value);
  });

  $("cardsTotal").textContent = money(
    items.filter(x => x.type === "Gider" && x.card)
      .reduce((s,x) => s + x.amount, 0)
  );

  const months = [...new Set(items.map(x => x.date.slice(0,7)))].sort().reverse();
  const oldMonth = $("monthFilter").value;
  $("monthFilter").innerHTML =
    '<option value="all">Tüm Aylar</option>' +
    months.map(m => `<option value="${m}">${new Date(m+"-01T00:00:00").toLocaleDateString("tr-TR",{month:"long",year:"numeric"})}</option>`).join("");
  $("monthFilter").value = months.includes(oldMonth) ? oldMonth : "all";

  const selected = $("monthFilter").value;
  const filtered = selected === "all" ? items : items.filter(x => x.date.startsWith(selected));
  const mt = totals(filtered);

  $("monthIncome").textContent = money(mt.income);
  $("monthExpense").textContent = money(mt.expense);
  $("monthNet").textContent = money(mt.income - mt.expense - mt.transfer);
  $("monthTransfer").textContent = money(mt.transfer);

  const sorted = filtered.slice().sort((a,b) => {
    const d = b.date.localeCompare(a.date);
    return d || b.id - a.id;
  });

  $("list").innerHTML = sorted.map(x => `
    <tr class="${x.type === "Gelir" ? "income" : x.type === "Gider" ? "expense" : "transfer"}">
      <td><input class="sel" type="checkbox" data-id="${x.id}"></td>
      <td>${new Date(x.date+"T00:00:00").toLocaleDateString("tr-TR")}</td>
      <td>${escapeHtml(x.description)}</td>
      <td>${x.type}</td>
      <td>${x.card || "-"}</td>
      <td class="amount">${money(x.amount)}</td>
    </tr>
  `).join("");

  $("empty").style.display = sorted.length ? "none" : "block";
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
}

$("date").value = new Date().toISOString().slice(0,10);
$("card").disabled = false;

$("form").addEventListener("submit", e => {
  e.preventDefault();

  const type = $("type").value;
  const description = $("description").value.trim();
  const amount = Number($("amount").value);

  if (!description) return alert("Açıklama gir.");
  if (!amount || amount <= 0) return alert("Geçerli bir tutar gir.");

  items.push({
    id: Date.now(),
    date: $("date").value,
    description,
    type,
    card: type === "Gider" ? $("card").value : "",
    amount
  });

  $("description").value = "";
  $("amount").value = "";
  save();
});

$("type").addEventListener("change", () => {
  $("card").disabled = $("type").value !== "Gider";
  if ($("card").disabled) $("card").value = "";
});

$("monthFilter").addEventListener("change", render);

$("clearBtn").addEventListener("click", () => {
  const ids = [...document.querySelectorAll(".sel:checked")]
    .map(x => Number(x.dataset.id));

  if (!ids.length) return alert("Silmek için işlem seç.");

  if (confirm("Seçili işlemler silinsin mi?")) {
    items = items.filter(x => !ids.includes(x.id));
    save();
  }
});

$("clearAllBtn").addEventListener("click", () => {
  if (!items.length) return alert("Silinecek kayıt yok.");

  if (confirm("Bu uygulamadaki tüm kayıtlar silinecek. Devam edilsin mi?")) {
    items = [];
    localStorage.removeItem(KEY);
    render();
  }
});

$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(items, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "gelir-gider-yedek.json";
  a.click();
  URL.revokeObjectURL(url);
});

load();
render();
