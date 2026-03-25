const { requireAccess, gateRoutes } = require("./gate");
const express = require("express");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");
const multer = require("multer");

const DB_URL = "https://takei-net-default-rtdb.firebaseio.com/posts.json";

let posts = [];
let clients = [];

fetch(DB_URL)
  .then(res => res.json())
  .then(data => {
    posts = data || [];
    console.log("Firebase同期完了！");
  });

async function saveDB() {
  await fetch(DB_URL, {
    method: "PUT",
    body: JSON.stringify(posts)
  });
}

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
gateRoutes(app);

// --- 【変更点1】PWA設定ファイルのエンドポイント追加 ---
app.get("/manifest.json", (req, res) => {
  res.json({
    "short_name": "takei.net",
    "name": "takei.net 掲示板アプリ",
    "display": "standalone",
    "start_url": "/",
    "background_color": "#000000",
    "theme_color": "#1d9bf0",
    "icons": [
      {
        "src": "https://via.placeholder.com/192/1d9bf0/ffffff?text=T",
        "sizes": "192x192",
        "type": "image/png"
      },
      {
        "src": "https://via.placeholder.com/512/1d9bf0/ffffff?text=Takei",
        "sizes": "512x512",
        "type": "image/png"
      }
    ]
  });
});

app.get("/sw.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.send("self.addEventListener('fetch', function(e){});");
});
// --- 【変更点1 終了】 ---

const FILE = path.join(__dirname, "posts.json");
if (!fs.existsSync(FILE)) { fs.writeFileSync(FILE, "[]"); }

const NG_WORDS = ["ちんちん","ちんこ","まんこ","きんたま","チンチン","チンコ","マンコ","キンタマ"];
let bannedUsers = {};

const upload = multer({ storage: multer.memoryStorage() });

app.get("/", requireAccess, (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>takei.net</title>

<link rel="manifest" href="/manifest.json">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">

<style>
:root {
  --bg-color: #000;
  --text-color: #e7e9ea;
  --border-color: #2f3336;
  --input-bg: #000;
  --secondary-text: #71767b;
  --reply-bg: #111;
  --btn-color: #1d9bf0;
}
body.light-mode {
  --bg-color: #ffffff;
  --text-color: #0f1419;
  --border-color: #eff3f4;
  --input-bg: #f7f9f9;
  --secondary-text: #536471;
  --reply-bg: #f7f9f9;
  --btn-color: #1d9bf0;
}

/* 【変更点3】追加要求バナーのスタイル */
#install-banner {
  display: none;
  background: var(--btn-color);
  color: white;
  padding: 12px;
  text-align: center;
  font-weight: bold;
  cursor: pointer;
  position: sticky;
  top: 0;
  z-index: 1000;
  border-radius: 0 0 10px 10px;
}

#notice { font-size: 12px; background-color: var(--input-bg); color: var(--text-color); padding: 8px; border-radius: 6px; font-family: monospace; border: 1px solid var(--border-color); }
#notice h2 { font-size: 14px; margin-bottom: 4px; }
#notice ul { margin: 0; padding-left: 16px; }
body { background: var(--bg-color); color: var(--text-color); font-family: system-ui, sans-serif; max-width: 600px; margin: auto; padding: 16px; transition: background 0.3s, color 0.3s; }
input, textarea { width: 100%; padding: 10px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 8px; box-sizing: border-box; }
textarea { resize: none; height: 80px; }
button { background: var(--btn-color); color: #fff; border: none; border-radius: 999px; padding: 8px 16px; font-weight: bold; cursor: pointer; }
.counter { text-align: right; color: var(--secondary-text); font-size: 12px; margin-bottom: 8px; }
li { list-style: none; border-bottom: 1px solid var(--border-color); padding: 12px 0; display: flex; flex-direction: column; }
small { color: var(--secondary-text); }
img { max-width: 100%; margin-top: 8px; border-radius: 6px; }
.mode-toggle { position: sticky; top: 10px; float: right; z-index: 100; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--border-color); padding: 5px 12px; border-radius: 20px; font-size: 12px; }
.actions { margin-top: 6px; display: flex; justify-content: flex-end; gap: 8px; }
.actions button { background: transparent; color: var(--secondary-text); border: none; padding: 0; font-size: 12px; cursor: pointer; }
.replies { margin-left: 16px; border-left: 2px solid var(--border-color); padding-left: 8px; margin-top: 8px; font-size: 0.9em; background-color: var(--reply-bg); border-radius: 6px; }
.replies div { padding: 4px 0; border-bottom: 1px solid var(--border-color); }
</style>
</head>
<body>

<div id="install-banner" onclick="handleInstallClick()">📱 takei.net をアプリとして追加する</div>

<button class="mode-toggle" onclick="toggleMode()">モード切替</button>
<div class="header"><h1>takei.net</h1><input class="search" placeholder="検索"></div>
<div id="notice">
  <h2>お知らせ</h2>
  <ul><li><p>【アプリ化対応】ホーム画面に追加して利用できるようになりました。バグ等はryukond2@gmail.comまで。【Ver.4.2.0】</p></li></ul>
</div>
<div class="header"><h1></h1><input id="realname" class="search" placeholder="本名(表示されません)"></div>
<input id="user" placeholder="ユーザー名（必須）">
<textarea id="text" maxlength="140" placeholder="【ここに本文を入力】"></textarea>
<input type="file" id="image" accept="image/*">
<div class="counter"><span id="count">0</span>/140</div>
<button onclick="postWithPermission()">投稿</button>
<ul id="posts"></ul>

<script>
// --- 【変更点5】PWA制御ロジックの追加 ---
let deferredPrompt;
const installBanner = document.getElementById('install-banner');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBanner.style.display = 'block';
});

async function handleInstallClick() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') installBanner.style.display = 'none';
    deferredPrompt = null;
  }
}

// iOS Safari向けの判定（Safariは自動表示できないため手動で案内）
const isIos = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
const isStandalone = ('standalone' in window.navigator) && (window.navigator.standalone);
if (isIos && !isStandalone) {
  installBanner.innerText = "☝️ 共有から『ホーム画面に追加』でアプリ化！";
  installBanner.style.display = 'block';
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
// --- 【変更点5 終了】 ---

const textEl = document.getElementById("text");
const countEl = document.getElementById("count");
const userEl = document.getElementById("user");
const imageEl = document.getElementById("image");
const realnameEl = document.getElementById("realname");

function toggleMode() {
  document.body.classList.toggle("light-mode");
  localStorage.setItem("theme", document.body.classList.contains("light-mode") ? "light" : "dark");
}
if (localStorage.getItem("theme") === "light") document.body.classList.add("light-mode");

function checkPermission() {
  if ("Notification" in window && Notification.permission === "default") { Notification.requestPermission(); }
}

function likeText(likes){
  if (likes >= 100) return "(ﾟ∀ﾟ)ｱﾋｬﾋｬﾋｬ!!";
  if (likes >= 10) return "(ﾟ∀ﾟ)ｷﾀｺレ!!";
  return "(・∀・)ｲｲネ!!";
}

textEl.addEventListener("input", () => countEl.textContent = textEl.value.length);
function escape(str) { return str.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }

function addPost(p, prepend = true) {
  const li = document.createElement("li");
  let imgHTML = p.image ? "<img src='" + p.image + "'>" : "";
  let repliesHTML = (p.replies || []).map(r => "<div class='reply'>" + escape(r.text) + "<br><small>" + new Date(r.time).toLocaleString() + "</small></div>").join("");

  li.innerHTML = "<b>" + escape(p.user) + "</b><br>" + escape(p.text) + "<br>" + imgHTML +
    "<small>" + new Date(p.time).toLocaleString() + "</small>" +
    "<div class='actions'><button onclick='likePost(" + p.id + ")'><span class='likeText'>" + likeText(p.likes ?? 0) + "</span> <span class='likeCount'>" + (p.likes ?? 0) + "</span></button></div>" +
    "<div class='replies' id='replies-" + p.id + "'>" + repliesHTML + "</div>" +
    "<button onclick='showReplyBox(" + p.id + ")'>返信</button>" +
    "<div id='replyBox-" + p.id + "' style='display:none;'><input id='replyInput-" + p.id + "' placeholder='返信を書く'><button onclick='sendReply(" + p.id + ")'>送信</button></div>";
  li.dataset.id = p.id;
  const list = document.getElementById("posts");
  prepend ? list.prepend(li) : list.append(li);
}

const es = new EventSource("/events");
es.onmessage = e => {
  const p = JSON.parse(e.data);
  const existing = document.querySelector("li[data-id='" + p.id + "']");
  if (existing) {
    existing.querySelector(".likeCount").textContent = p.likes ?? 0;
    existing.querySelector(".likeText").textContent = likeText(p.likes ?? 0);
    const rDiv = existing.querySelector(".replies");
    if(rDiv) rDiv.innerHTML = (p.replies || []).map(r => "<div class='reply'>" + escape(r.text) + "<br><small>" + new Date(r.time).toLocaleString() + "</small></div>").join("");
    return;
  }
  addPost(p, true);
};

async function post(){
  const user = userEl.value.trim() || "匿名";
  const text = textEl.value.trim();
  const realname = realnameEl.value.trim();
  if (!realname) { alert("本名を入力してください"); return; }
  if (!text || containsNG(text)) return;
  let imageData = null;
  if(imageEl.files[0]){
    imageData = await new Promise(r => { const rd = new FileReader(); rd.onload = () => r(rd.result); rd.readAsDataURL(imageEl.files[0]); });
  }
  await fetch("/post",{ method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ user, text, image: imageData, realname }) });
  textEl.value = ""; imageEl.value = "";
}
function containsNG(t){ return NG_WORDS.some(w => t.includes(w)); }
function postWithPermission() { checkPermission(); post(); }
function likePost(id){ fetch("/like/" + id, { method: "POST" }); }
function showReplyBox(id){ const b = document.getElementById("replyBox-" + id); b.style.display = b.style.display === "none" ? "block" : "none"; }
async function sendReply(id){
  const i = document.getElementById("replyInput-" + id);
  if(!i.value.trim()) return;
  await fetch("/reply/" + id, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ text: i.value }) });
  i.value = "";
}

fetch("/posts").then(res => res.json()).then(data => data.forEach(p => addPost(p, true)));
document.addEventListener('click', checkPermission, { once: true });
</script>
</body>
</html>
`);
});

app.get("/posts", (req, res) => res.json(posts.slice().sort((a,b)=>a.time-b.time)));

app.post("/post", async (req, res) => { 
  const { user, text, image, realname } = req.body;
  if (!text?.trim() || NG_WORDS.some(w => text.includes(w))) return res.sendStatus(400);
  const post = { id: Date.now(), user: user || "匿名", realname: realname.trim(), text: text.trim().slice(0, 140), image: image || null, time: Date.now(), likes: 0, replies: [] };
  const gasUrl = "https://script.google.com/macros/s/AKfycbyqUjSZDsU2kcob3XH6FIJTgYX9ApNQV6m9m_y2u77B_Eglw2ahw902YOK3k4d0UZxBbQ/exec";
  try { fetch(gasUrl, { method: "POST", body: JSON.stringify(post) }); } catch (err) {}
  posts.unshift(post);
  await saveDB(); 
  clients.forEach((c) => c.write("data:" + JSON.stringify(post) + "\n\n"));
  res.sendStatus(200);
});

app.post("/like/:id", async (req, res) => {
  const id = Number(req.params.id);
  const post = posts.find(p => p.id === id);
  if (post) {
    post.likes = (post.likes || 0) + 1;
    await saveDB();
    clients.forEach(c => c.write("data:" + JSON.stringify(post) + "\n\n"));
    res.sendStatus(200);
  } else { res.sendStatus(404); }
});

app.post("/reply/:id", (req,res)=>{
  const id = Number(req.params.id);
  const post = posts.find(p=>p.id===id);
  if(!post) return res.sendStatus(404);
  post.replies.push({ text: req.body.text, time: Date.now() });
  saveDB(); 
  clients.forEach(c => c.write("data:" + JSON.stringify(post) + "\n\n"));
  res.sendStatus(200);
});

app.get("/events", requireAccess, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  clients.push(res);
  req.on("close", () => { clients = clients.filter((c) => c !== res); });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`サーバー起動: http://localhost:${PORT}`));
