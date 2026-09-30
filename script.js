/* ==========================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)
   ตรวจจับ element ของแต่ละหน้าแล้วทำงานเฉพาะหน้านั้น
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable tbody
   ========================================================== */

var ORDER_API_URL =
  "https://script.google.com/macros/s/AKfycbxo_Wap8QYoJJOLah2yn2_krw1_V9ll_2Xhx4iLVGlirKtWzXQScfY3kHTBuLH9ghbrfQ/exec";

var ORDERS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTQe0Z0ewnVwM4YVXbqZWulNl8ALhXop2aIWpOee_R95fWFxMRKns-NzyOY2Ze9eysEmu_jerUl5HCU/pub?gid=0&single=true&output=csv";

var MOODS = [
  { key: "all", label: "ทั้งหมด" },
  { key: "fresh", label: "Fresh" },
  { key: "sweet", label: "Sweet" },
  { key: "confident", label: "Confident" },
  { key: "romance", label: "Romance" }
];

var TYPE_LABELS = { spray: "สเปรย์", rollon: "โรลออน" };

document.addEventListener("DOMContentLoaded", function () {
  if (document.getElementById("product-list")) initProductPage();
  if (document.getElementById("orderForm")) initOrderPage();
  if (document.querySelector("#ordersTable tbody")) initAdminPage();
});

/* ---------- helpers ---------- */

function el(tag, className, text) {
  var node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function formatPrice(value) {
  var n = Number(value);
  return isNaN(n) ? String(value) : n.toLocaleString("th-TH");
}

function moodLabel(key) {
  for (var i = 0; i < MOODS.length; i++) {
    if (MOODS[i].key === key) return MOODS[i].label;
  }
  return key;
}

/* ==========================================================
   1) product.html
   ========================================================== */

function initProductPage() {
  var list = document.getElementById("product-list");
  var bar = document.getElementById("filter-bar");
  var products = [];

  var params = new URLSearchParams(window.location.search);
  var current = (params.get("mood") || "all").toLowerCase();
  var valid = MOODS.some(function (m) {
    return m.key === current;
  });
  if (!valid) current = "all";

  function renderFilters() {
    if (!bar) return;
    bar.innerHTML = "";
    MOODS.forEach(function (m) {
      var btn = el("button", "filter-btn", "");
      btn.type = "button";
      btn.dataset.mood = m.key === "all" ? "" : m.key;
      if (m.key !== "all") {
        btn.appendChild(el("span", "mood-dot"));
      }
      btn.appendChild(document.createTextNode(m.label));
      var active = m.key === current;
      if (active) btn.classList.add("active");
      btn.setAttribute("aria-pressed", active ? "true" : "false");
      btn.addEventListener("click", function () {
        current = m.key;
        syncUrl();
        renderFilters();
        renderProducts();
      });
      bar.appendChild(btn);
    });
  }

  function syncUrl() {
    if (!window.history || !window.history.replaceState) return;
    var url = new URL(window.location.href);
    if (current === "all") url.searchParams.delete("mood");
    else url.searchParams.set("mood", current);
    window.history.replaceState(null, "", url.toString());
  }

  function buildCard(p) {
    var card = el("article", "product-card");
    card.dataset.mood = p.mood;

    var img = document.createElement("img");
    img.src = p.image;
    img.alt = p.name;
    img.loading = "lazy";
    card.appendChild(img);

    var meta = el("div", "product-meta");
    meta.appendChild(el("span", "mood-dot"));
    meta.appendChild(document.createTextNode(moodLabel(p.mood)));
    card.appendChild(meta);

    card.appendChild(el("h3", "", p.name));

    var sizeText = (TYPE_LABELS[p.type] || p.type) + (p.size ? " " + p.size : "");
    card.appendChild(el("p", "product-meta", sizeText));

    card.appendChild(el("hr", "mood-line"));

    var foot = el("div", "product-foot");
    var price = el("span", "price", formatPrice(p.price));
    price.appendChild(el("small", "", "บาท"));
    foot.appendChild(price);

    var itemName = p.name + (p.size ? " " + p.size : "");
    var link = el("a", "btn btn-small", "สั่งซื้อ");
    link.href =
      "order.html?item=" +
      encodeURIComponent(itemName) +
      "&price=" +
      encodeURIComponent(p.price);
    foot.appendChild(link);

    card.appendChild(foot);
    return card;
  }

  function renderProducts() {
    list.innerHTML = "";
    var shown = products.filter(function (p) {
      return current === "all" || p.mood === current;
    });
    if (!shown.length) {
      list.appendChild(el("p", "empty-state", "ยังไม่มีสินค้าในหมวดนี้"));
      return;
    }
    shown.forEach(function (p) {
      list.appendChild(buildCard(p));
    });
  }

  renderFilters();

  fetch("products.json")
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then(function (data) {
      products = data;
      renderProducts();
    })
    .catch(function (error) {
      console.error(error);
      list.innerHTML = "";
      list.appendChild(
        el("p", "empty-state", "โหลดรายการสินค้าไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง")
      );
    });
}

/* ==========================================================
   2) order.html
   ========================================================== */

function setFieldValue(id, value) {
  var node = document.getElementById(id);
  if (!node) return;
  if ("value" in node) node.value = value;
  else node.textContent = value;
}

function getFieldValue(id) {
  var node = document.getElementById(id);
  if (!node) return "";
  return "value" in node ? node.value : node.textContent;
}

function initOrderPage() {
  var form = document.getElementById("orderForm");
  var params = new URLSearchParams(window.location.search);

  var item = params.get("item");
  var price = params.get("price");

  // เติมทั้งชื่อสินค้า (#items) และราคา (#total) ทันทีที่โหลดหน้า
  if (item !== null) setFieldValue("items", item);
  if (price !== null) setFieldValue("total", price);

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (form.reportValidity && !form.reportValidity()) return;

    var payload = {
      customerName: getFieldValue("customerName").trim(),
      contact: getFieldValue("contact").trim(),
      items: getFieldValue("items").trim(),
      total: getFieldValue("total").trim(),
      note: getFieldValue("note").trim()
    };

    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    fetch(ORDER_API_URL, {
      method: "POST",
      body: JSON.stringify(payload)
    })
      .then(function () {
        window.location.href = "thankyou.html";
      })
      .catch(function (error) {
        console.error(error);
        alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        if (submitBtn) submitBtn.disabled = false;
      });
  });
}

/* ==========================================================
   3) admin.html
   ========================================================== */

/* parse CSV เอง: รองรับ "ข้อความในเครื่องหมายคำพูด", "" ในข้อความ, ขึ้นบรรทัดใหม่ในช่อง, CRLF */
function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = "";
  var inQuotes = false;

  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // ตัด BOM

  for (var i = 0; i < text.length; i++) {
    var c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }

  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(function (r) {
    return r.some(function (cell) {
      return cell.trim() !== "";
    });
  });
}

function initAdminPage() {
  var tbody = document.querySelector("#ordersTable tbody");
  var COLS = 6; // วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ

  function showMessage(message) {
    tbody.innerHTML = "";
    var tr = document.createElement("tr");
    var td = el("td", "empty-state", message);
    td.colSpan = COLS;
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  showMessage("กำลังโหลดรายการสั่งซื้อ...");

  fetch(ORDERS_CSV_URL, { cache: "no-store" })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then(function (text) {
      var rows = parseCSV(text);

      // ข้ามแถวหัวตาราง (คอลัมน์แรกของข้อมูลจริงเป็นวันเวลา จึงมีตัวเลขเสมอ)
      if (rows.length && !/\d/.test(rows[0][0] || "")) rows.shift();

      // ชีตเพิ่มแถวต่อท้ายตามลำดับเวลา จึงกลับลำดับให้ล่าสุดขึ้นก่อน
      rows.reverse();

      if (!rows.length) {
        showMessage("ยังไม่มีรายการสั่งซื้อ");
        return;
      }

      tbody.innerHTML = "";
      rows.forEach(function (r) {
        var tr = document.createElement("tr");
        for (var i = 0; i < COLS; i++) {
          tr.appendChild(el("td", "", r[i] !== undefined ? r[i] : ""));
        }
        tbody.appendChild(tr);
      });
    })
    .catch(function (error) {
      console.error(error);
      showMessage("โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง");
    });
}
