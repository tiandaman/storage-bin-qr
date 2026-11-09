/* Storage Bins — single-page app. Data lives in Supabase (see supabase/schema.sql). */
const { SUPABASE_URL, SUPABASE_KEY } = window.APP_CONFIG;
// Read before the client consumes the URL: did we arrive from a password-reset email?
let recovering = /type=recovery/.test(location.hash);
const linkError = /error_description=([^&]+)/.exec(location.hash)?.[1];
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const BUCKET = "box-photos";

const app = document.getElementById("app");
const nav = document.getElementById("nav");

let session = null;
let loaded = false;
let boxes = [], items = [], photos = [];
let stopScanner = null;

/* ---------- helpers ---------- */
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const baseUrl = () => location.origin + location.pathname;
const boxUrl = (code) => baseUrl() + "#/box/" + encodeURIComponent(code);
const itemsIn = (id) => items.filter((i) => i.box_id === id);
const photosIn = (id) => photos.filter((p) => p.box_id === id);
const boxById = (id) => boxes.find((b) => b.id === id);
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

function qrSvg(text) {
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

async function must(promise) {
  const { data, error } = await promise;
  if (error) { toast(error.message); throw error; }
  return data;
}

function nextCode() {
  const nums = boxes.map((b) => parseInt((b.code.match(/\d+/) || ["0"])[0], 10) || 0);
  return "B-" + String(Math.max(0, ...nums) + 1).padStart(2, "0");
}

function highlight(text, term) {
  const s = esc(text);
  if (!term) return s;
  const i = s.toLowerCase().indexOf(esc(term).toLowerCase());
  if (i < 0) return s;
  const n = esc(term).length;
  return s.slice(0, i) + "<mark>" + s.slice(i, i + n) + "</mark>" + s.slice(i + n);
}

async function loadData() {
  const [b, i, p] = await Promise.all([
    sb.from("boxes").select("*").order("code"),
    sb.from("items").select("*").order("name"),
    sb.from("photos").select("*").order("created_at"),
  ]);
  const err = b.error || i.error || p.error;
  if (err) throw err;
  boxes = b.data; items = i.data; photos = p.data;
  loaded = true;
}
async function refresh() { await loadData(); route(); }

/* ---------- router ---------- */
async function route() {
  if (stopScanner) { stopScanner(); stopScanner = null; }
  if (!session) { nav.innerHTML = ""; return renderLogin(); }
  if (recovering) { nav.innerHTML = ""; return renderSetPassword(); }

  nav.innerHTML = `<a href="#/scan">Scan</a><a href="#/labels">Labels</a>
    <button class="link" id="signout">Sign out</button>`;
  $("#signout").onclick = () => sb.auth.signOut();

  if (!loaded) {
    try { await loadData(); }
    catch (e) { app.innerHTML = `<p class="err">Couldn't load data: ${esc(e.message)}</p>`; return; }
  }

  const [page, arg] = (location.hash.slice(2) || "").split("/");
  const key = arg ? decodeURIComponent(arg) : "";
  window.scrollTo(0, 0);
  if (page === "box" && key) return renderBox(key);
  if (page === "new") return renderBoxForm(null, key);
  if (page === "edit" && key) return renderBoxForm(boxes.find((b) => b.code === key));
  if (page === "labels") return renderLabels(key);
  if (page === "scan") return renderScan();
  renderHome();
}

/* ---------- login ---------- */
function renderLogin() {
  app.innerHTML = `
    <form class="card login" id="login">
      <h1>Sign in</h1>
      <p class="muted">Sign in once on this phone to see and edit your boxes.</p>
      <label for="em">Email</label>
      <input id="em" type="email" autocomplete="username" required>
      <label for="pw">Password</label>
      <input id="pw" type="password" autocomplete="current-password" required>
      <div class="row"><button class="grow">Sign in</button></div>
      <div class="row"><button type="button" class="link" id="forgot">Forgot password?</button></div>
      <p class="err" id="lerr">${linkError ? "That reset link didn't work: " + esc(decodeURIComponent(linkError.replace(/\+/g, " "))) + ". Request a new one." : ""}</p>
    </form>`;
  $("#login").onsubmit = async (e) => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword({ email: $("#em").value.trim(), password: $("#pw").value });
    if (error) $("#lerr").textContent = error.message;
  };
  $("#forgot").onclick = async () => {
    const email = $("#em").value.trim();
    const msg = $("#lerr");
    if (!email) { msg.textContent = "Type your email above first, then tap Forgot password."; $("#em").focus(); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: baseUrl() });
    msg.className = error ? "err" : "muted";
    msg.textContent = error ? error.message
      : "If that email has an account, a reset link is on its way. Open it on this device, then choose a new password.";
  };
}

function renderSetPassword() {
  app.innerHTML = `
    <form class="card login" id="setpw">
      <h1>Choose a new password</h1>
      <label for="np">New password</label>
      <input id="np" type="password" autocomplete="new-password" minlength="6" required>
      <label for="np2">Type it again</label>
      <input id="np2" type="password" autocomplete="new-password" minlength="6" required>
      <div class="row"><button class="grow">Save password</button></div>
      <p class="err" id="perr"></p>
    </form>`;
  $("#np").focus();
  $("#setpw").onsubmit = async (e) => {
    e.preventDefault();
    if ($("#np").value !== $("#np2").value) { $("#perr").textContent = "The passwords don't match."; return; }
    const { error } = await sb.auth.updateUser({ password: $("#np").value });
    if (error) { $("#perr").textContent = error.message; return; }
    recovering = false;
    toast("Password updated");
    location.hash = "#/";
    route();
  };
}

/* ---------- home + search ---------- */
function renderHome() {
  app.innerHTML = `
    <input id="q" type="search" placeholder="Search items, boxes, locations…" autocomplete="off">
    <div class="row"><a class="btn" href="#/new">+ New box</a></div>
    <div id="results"></div>`;
  const q = $("#q");
  try { q.value = sessionStorage.getItem("q") || ""; } catch {}
  const draw = () => {
    const term = q.value.trim();
    try { sessionStorage.setItem("q", term); } catch {}
    $("#results").innerHTML = term ? searchHtml(term) : boxListHtml(boxes);
  };
  q.oninput = draw;
  draw();
}

function boxListHtml(list, term = "") {
  if (!boxes.length) return `<div class="card empty">No boxes yet. Tap <b>+ New box</b> to add your first one.</div>`;
  if (!list.length) return "";
  return list.map((b) => `
    <a class="card boxlink" href="#/box/${encodeURIComponent(b.code)}">
      <span class="code">${esc(b.code)}</span>
      <span><span class="name">${highlight(b.name, term)}</span><br>
        <span class="sub">${b.location ? highlight(b.location, term) : "No location"}</span></span>
      <span class="count">${plural(itemsIn(b.id).length, "item")}</span>
    </a>`).join("");
}

function searchHtml(term) {
  const t = term.toLowerCase();
  const has = (s) => (s || "").toLowerCase().includes(t);
  const hitItems = items.filter((i) => has(i.name) || has(i.notes));
  const hitBoxes = boxes.filter((b) => has(b.name) || has(b.location) || has(b.code) || has(b.notes));
  if (!hitItems.length && !hitBoxes.length) return `<div class="card empty">Nothing matches “${esc(term)}”.</div>`;
  let html = "";
  if (hitItems.length) {
    html += `<h2>Items</h2><div class="card">` + hitItems.map((i) => {
      const b = boxById(i.box_id);
      return `<a class="hit" href="#/box/${encodeURIComponent(b.code)}">
        <b>${highlight(i.name, term)}</b>${i.quantity > 1 ? ` <span class="muted">×${i.quantity}</span>` : ""}<br>
        <span class="muted">in <span class="code">${esc(b.code)}</span> ${esc(b.name)}${b.location ? " · " + esc(b.location) : ""}</span>
      </a>`;
    }).join("") + `</div>`;
  }
  if (hitBoxes.length) html += `<h2>Boxes</h2>` + boxListHtml(hitBoxes, term);
  return html;
}

/* ---------- box page ---------- */
function renderBox(code) {
  const box = boxes.find((b) => b.code === code);
  if (!box) {
    app.innerHTML = `<a class="back" href="#/">← All boxes</a>
      <div class="card empty">There's no box <b>${esc(code)}</b> yet.<br><br>
      <a class="btn" href="#/new/${encodeURIComponent(code)}">Create box ${esc(code)}</a></div>`;
    return;
  }
  const list = itemsIn(box.id);
  app.innerHTML = `
    <a class="back" href="#/">← All boxes</a>
    <div class="boxhead">
      <div>
        <span class="code">${esc(box.code)}</span>
        <h1>${esc(box.name)}</h1>
        <div class="muted">${box.location ? esc(box.location) : "No location set"}</div>
        ${box.notes ? `<p class="notes">${esc(box.notes)}</p>` : ""}
      </div>
      <a class="btn secondary" href="#/edit/${encodeURIComponent(box.code)}">Edit</a>
    </div>

    <form class="add" id="addForm">
      <input name="name" placeholder="Add an item…" required autocomplete="off">
      <input name="qty" class="qty" type="number" min="1" value="1" aria-label="Quantity">
      <button>Add</button>
    </form>

    <ul class="list card items" id="items">
      ${list.length ? list.map(itemRow).join("") : `<li class="empty">This box is empty.</li>`}
    </ul>

    <h2>Photos</h2>
    <div class="photos" id="photos">${photosIn(box.id).map((p) =>
      `<figure data-id="${p.id}"><img alt="Box photo" data-path="${esc(p.path)}"><button class="link" data-del="${p.id}">Remove</button></figure>`).join("")}</div>
    <label class="btn secondary photo-btn">+ Add photo
      <input type="file" accept="image/*" capture="environment" id="photoIn" hidden></label>

    <details class="card qr">
      <summary>QR label</summary>
      <div class="qrimg">${qrSvg(boxUrl(box.code))}</div>
      <div class="url muted">${esc(boxUrl(box.code))}</div>
      <div class="row"><a class="btn grow" href="#/labels/${encodeURIComponent(box.code)}">Print this label</a></div>
    </details>

    <div class="row end"><button class="danger" id="delBox">Delete box</button></div>`;

  $("#addForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const name = f.name.value.trim();
    if (!name) return;
    f.querySelector("button").disabled = true;
    try {
      await must(sb.from("items").insert({ box_id: box.id, name, quantity: Math.max(1, +f.qty.value || 1) }));
      await loadData();
      renderBox(code);
      $("#addForm input[name=name]").focus();
    } catch { f.querySelector("button").disabled = false; }
  };

  $("#items").onclick = (e) => {
    const btn = e.target.closest("button");
    const li = e.target.closest("li[data-id]");
    if (!li) return;
    const item = items.find((i) => i.id === li.dataset.id);
    if (!btn || btn.dataset.act === "edit") return editItem(li, item, box);
  };

  $("#delBox").onclick = async () => {
    if (!confirm(`Delete ${box.code} “${box.name}” and its ${plural(list.length, "item")}? This can't be undone.`)) return;
    const paths = photosIn(box.id).map((p) => p.path);
    if (paths.length) await sb.storage.from(BUCKET).remove(paths);
    await must(sb.from("boxes").delete().eq("id", box.id));
    toast("Box deleted");
    location.hash = "#/";
    await refresh();
  };

  $("#photoIn").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    toast("Uploading photo…");
    try {
      const blob = await shrinkImage(file);
      const path = `${box.id}/${Date.now()}.jpg`;
      await must(sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" }));
      await must(sb.from("photos").insert({ box_id: box.id, path }));
      await loadData();
      renderBox(code);
      toast("Photo added");
    } catch {}
  };

  $("#photos").onclick = async (e) => {
    const id = e.target.dataset.del;
    if (!id || !confirm("Remove this photo?")) return;
    const p = photos.find((x) => x.id === id);
    await sb.storage.from(BUCKET).remove([p.path]);
    await must(sb.from("photos").delete().eq("id", id));
    await loadData();
    renderBox(code);
  };

  loadPhotoUrls();
}

async function loadPhotoUrls() {
  const imgs = [...document.querySelectorAll("#photos img[data-path]")];
  if (!imgs.length) return;
  const { data } = await sb.storage.from(BUCKET).createSignedUrls(imgs.map((i) => i.dataset.path), 3600);
  (data || []).forEach((d, n) => {
    if (d.signedUrl) {
      imgs[n].src = d.signedUrl;
      imgs[n].onclick = () => window.open(d.signedUrl, "_blank");
    }
  });
}

function shrinkImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't read image"))), "image/jpeg", 0.8);
    };
    img.onerror = () => reject(new Error("Couldn't read image"));
    img.src = URL.createObjectURL(file);
  });
}

function itemRow(i) {
  return `<li data-id="${i.id}">
    <span class="iname">${esc(i.name)}${i.notes ? `<span class="inote">${esc(i.notes)}</span>` : ""}</span>
    ${i.quantity > 1 ? `<span class="iqty">×${i.quantity}</span>` : ""}
    <button class="secondary" data-act="edit" aria-label="Edit ${esc(i.name)}">Edit</button>
  </li>`;
}

function editItem(li, item, box) {
  if (li.classList.contains("editing")) return;
  li.classList.add("editing");
  const others = boxes.filter((b) => b.id !== box.id);
  li.innerHTML = `
    <div class="row"><input class="grow" name="name" value="${esc(item.name)}" aria-label="Item name">
      <input class="qty" name="qty" type="number" min="1" value="${item.quantity}" aria-label="Quantity"></div>
    <div class="row"><input class="grow" name="notes" value="${esc(item.notes || "")}" placeholder="Notes (optional)"></div>
    ${others.length ? `<div class="row"><select name="move" aria-label="Move to box">
      <option value="">Keep in ${esc(box.code)}</option>
      ${others.map((b) => `<option value="${b.id}">Move to ${esc(b.code)} — ${esc(b.name)}</option>`).join("")}
    </select></div>` : ""}
    <div class="row"><button data-act="save" class="grow">Save</button>
      <button data-act="cancel" class="secondary">Cancel</button>
      <button data-act="delete" class="danger">Delete</button></div>`;
  const field = (n) => li.querySelector(`[name=${n}]`);
  field("name").focus();
  li.onclick = async (e) => {
    const act = e.target.dataset.act;
    if (!act) return;
    e.stopPropagation();
    if (act === "cancel") return renderBox(box.code);
    if (act === "delete") {
      if (!confirm(`Delete “${item.name}”?`)) return;
      await must(sb.from("items").delete().eq("id", item.id));
      toast("Item deleted");
    }
    if (act === "save") {
      const name = field("name").value.trim();
      if (!name) return field("name").focus();
      const patch = { name, quantity: Math.max(1, +field("qty").value || 1), notes: field("notes").value.trim() || null };
      const move = field("move")?.value;
      if (move) patch.box_id = move;
      await must(sb.from("items").update(patch).eq("id", item.id));
      toast(move ? `Moved to ${boxById(move).code}` : "Saved");
    }
    await loadData();
    renderBox(box.code);
  };
}

/* ---------- new / edit box ---------- */
function renderBoxForm(box, presetCode = "") {
  const isNew = !box;
  if (!isNew && !box) { location.hash = "#/"; return; }
  app.innerHTML = `
    <a class="back" href="${isNew ? "#/" : "#/box/" + encodeURIComponent(box.code)}">← Back</a>
    <h1>${isNew ? "New box" : "Edit " + esc(box.code)}</h1>
    <form id="boxForm">
      <label for="f-code">Box code (printed on the label)</label>
      <input id="f-code" name="code" required value="${esc(isNew ? presetCode || nextCode() : box.code)}" ${isNew ? "" : "disabled"}>
      <label for="f-name">Name</label>
      <input id="f-name" name="name" required placeholder="e.g. Christmas decorations" value="${esc(box?.name || "")}">
      <label for="f-loc">Location</label>
      <input id="f-loc" name="location" placeholder="e.g. Garage, shelf 2" value="${esc(box?.location || "")}" list="locs">
      <datalist id="locs">${[...new Set(boxes.map((b) => b.location).filter(Boolean))].map((l) => `<option value="${esc(l)}">`).join("")}</datalist>
      <label for="f-notes">Notes</label>
      <textarea id="f-notes" name="notes">${esc(box?.notes || "")}</textarea>
      <div class="row"><button class="grow">${isNew ? "Create box" : "Save"}</button></div>
    </form>
    ${isNew ? "" : `<p class="muted">The box code can't change, so printed labels keep working.</p>`}`;
  if (isNew) $("#f-name").focus();
  $("#boxForm").onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const row = { name: f.name.value.trim(), location: f.location.value.trim() || null, notes: f.notes.value.trim() || null };
    let code = box?.code;
    if (isNew) {
      code = f.code.value.trim().toUpperCase();
      if (boxes.some((b) => b.code === code)) { toast(`${code} already exists`); return; }
      await must(sb.from("boxes").insert({ ...row, code }));
    } else {
      await must(sb.from("boxes").update(row).eq("id", box.id));
    }
    await loadData();
    location.hash = "#/box/" + encodeURIComponent(code);
  };
}

/* ---------- labels ---------- */
function renderLabels(only = "") {
  if (!boxes.length) { app.innerHTML = `<div class="card empty">Add a box first, then print its label here.</div>`; return; }
  const on = (b) => !only || b.code === only;
  app.innerHTML = `
    <div class="noprint">
      <h1>Print QR labels</h1>
      <p class="muted">Pick the boxes, then print. Each label is about 2.5 inches wide; tape it on or use sticker paper.</p>
      <div class="row"><button id="all" class="secondary">Select all</button><button id="none" class="secondary">Select none</button>
        <button id="print" class="grow">Print</button></div>
      <ul class="list card pick">${boxes.map((b) => `
        <li><input type="checkbox" id="c-${b.id}" data-id="${b.id}" ${on(b) ? "checked" : ""}>
        <label for="c-${b.id}" style="margin:0;color:inherit"><span class="code">${esc(b.code)}</span> ${esc(b.name)}</label></li>`).join("")}
      </ul>
    </div>
    <div class="sheet">${boxes.map((b) => `
      <div class="label ${on(b) ? "" : "off"}" id="l-${b.id}">
        ${qrSvg(boxUrl(b.code))}
        <div class="lc">${esc(b.code)}</div><div class="ln">${esc(b.name)}</div>
      </div>`).join("")}</div>`;
  const sync = () => boxes.forEach((b) => $(`#l-${b.id}`).classList.toggle("off", !$(`#c-${b.id}`).checked));
  app.querySelectorAll(".pick input").forEach((c) => (c.onchange = sync));
  $("#all").onclick = () => { app.querySelectorAll(".pick input").forEach((c) => (c.checked = true)); sync(); };
  $("#none").onclick = () => { app.querySelectorAll(".pick input").forEach((c) => (c.checked = false)); sync(); };
  $("#print").onclick = () => window.print();
}

/* ---------- built-in scanner (backup for the phone camera) ---------- */
async function renderScan() {
  app.innerHTML = `
    <a class="back" href="#/">← All boxes</a>
    <h1>Scan a box</h1>
    <p class="muted">Your phone's normal camera app also opens these codes directly.</p>
    <video id="cam" playsinline muted style="width:100%;border-radius:12px;background:#000"></video>
    <p id="scanMsg" class="muted">Starting camera…</p>`;
  let stream, raf, stopped = false;
  stopScanner = () => { stopped = true; cancelAnimationFrame(raf); stream?.getTracks().forEach((t) => t.stop()); };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
  } catch (e) {
    $("#scanMsg").textContent = "Couldn't open the camera. Allow camera access, or use your phone's camera app instead.";
    return;
  }
  if (stopped) return stopScanner();
  const video = $("#cam");
  video.srcObject = stream;
  await video.play();
  $("#scanMsg").textContent = "Point the camera at a box label.";

  let detect;
  if ("BarcodeDetector" in window) {
    const bd = new BarcodeDetector({ formats: ["qr_code"] });
    detect = async () => (await bd.detect(video))[0]?.rawValue;
  } else {
    await loadScript("https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js");
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d", { willReadFrequently: true });
    detect = async () => {
      c.width = video.videoWidth; c.height = video.videoHeight;
      if (!c.width) return;
      ctx.drawImage(video, 0, 0);
      return jsQR(ctx.getImageData(0, 0, c.width, c.height).data, c.width, c.height)?.data;
    };
  }
  const tick = async () => {
    if (stopped) return;
    try {
      const text = await detect();
      const m = text && text.match(/#\/box\/([^?#]+)/);
      if (m) { location.hash = "#/box/" + m[1]; return; }
      if (text) $("#scanMsg").textContent = "That QR code isn't a box label.";
    } catch {}
    raf = requestAnimationFrame(tick);
  };
  tick();
}

function loadScript(src) {
  return new Promise((res, rej) => {
    if ([...document.scripts].some((s) => s.src === src)) return res();
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = () => rej(new Error("Failed to load " + src));
    document.head.appendChild(s);
  });
}

/* ---------- start ---------- */
window.addEventListener("hashchange", route);
sb.auth.onAuthStateChange((event, s) => {
  const had = !!session;
  session = s;
  if (event === "PASSWORD_RECOVERY") { recovering = true; route(); }
  else if (event === "SIGNED_OUT") { loaded = false; boxes = items = photos = []; route(); }
  else if (event === "INITIAL_SESSION" || (event === "SIGNED_IN" && !had)) route();
});
