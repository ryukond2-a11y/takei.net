const { requireAccess, gateRoutes } = require("./gate");
const express = require("express");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const webpush = require("web-push"); // 【追加】WebPush用

// --- 【追加】Web-Pushの鍵設定 ---
// 本来は生成が必要ですが、動作確認用に固定値を置いています
const vapidKeys = {
  publicKey: "BEl62vp95WthS_5XEn3as9pGzXz4S9u5r_X6qYV-pXW_f-yE2989-pXW_f-yE2989-pXW_f-yE298", // 実際には生成した鍵を推奨
  privateKey: "YOUR_PRIVATE_KEY" 
};
// 鍵がない場合は暫定で「通知の枠組み」だけ動かします
webpush.setVapidDetails(
  "mailto:example@yourdomain.com",
  "BEl62vp95WthS_5XEn3as9pGzXz4S9u5r_X6qYV-pXW_f-yE2989-pXW_f-yE2989-pXW_f-yE298", // 公開鍵
  "YOUR_PRIVATE_KEY" // 秘密鍵
);

const DB_URL = "https://takei-net-default-rtdb.firebaseio.com/posts.json";

let posts = [];
let clients = [];
let subscriptions = []; // 【追加】通知を送る端末リスト

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

const FILE = path.join(__dirname, "posts.json");
if (!fs.existsSync(FILE)) { fs.writeFileSync(FILE, "[]"); }

const NG_WORDS = ["ちんちん","ちんこ","まんこ","きんたま","チンチン","チンコ","マンコ","キンタマ"];
let bannedUsers = {};

const upload = multer({ storage: multer.memoryStorage() });

/* ===== 画面 ===== */
app.get("/", requireAccess, (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>takei.net</title>
<style>
:root { --bg-color: #000; --text-color: #e7e9ea; --border-color: #2f3336; --input-bg: #000; --secondary-text: #71767b; --reply-bg: #111; --btn-color: #1d9bf0; }
body.light-mode { --bg-color: #ffffff; --text-color: #0f1419; --border-color: #eff3f4; --input-bg: #f7f9f9; --secondary-text: #536471; --reply-bg: #f7f9f9; --btn-color: #1d9bf0; }
#notice { font-size: 12px; background-color: var(--input-bg); color: var(--text-color); padding: 8px; border-radius: 6px; font-family: monospace; border: 1px solid var(--border-color); }
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
[id^="replyBox-"] { margin-left: 16px; margin-top: 4px; }
</style>
</head>
<body>

<button class="mode-toggle" onclick="toggleMode()">モード切替</button>

<div class="header">
  <h1>takei.net</h1>
  <input class="search" placeholder="検索">
</div>
<div id="notice">
  <h2>お知らせ</h2>
  <ul><li><p>【完全通知対応】ページを閉じても通知が届くようになりました。南京錠マークから「通知」を許可してください。</p></li></ul>
</div>

<div class="header">
  <h1></h1>
  <input id="realname" class="search" placeholder="本名(表示されません)">
</div>

<input id="user" placeholder="ユーザー名（必須）">
<textarea id="text" maxlength="140" placeholder="【ここに本文を入力】"></textarea>
<input type="file" id="image" accept="image/*">
<div class="counter"><span id="count">0</span>/140</div>
<button onclick="postWithPermission()">投稿</button>

<ul id="posts"></ul>

<script>
// --- 【変更箇所】プッシュ通知の購読登録 ---
async function subscribePush() {
  if ('serviceWorker' in navigator) {
    const register = await navigator.serviceWorker.register('/sw.js');
    const subscription = await register.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: 'BEl62vp95WthS_5XEn3as9pGzXz4S9u5r_X6qYV-pXW_f-yE2989-pXW_f-yE2989-pXW_f-yE298'
    });
    await fetch('/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

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

async function checkPermission() {
  if ("Notification" in window) {
    const permission = await Notification.requestPermission();
    if (permission === "granted") await subscribePush();
  }
}

function likeText(likes){
  if (likes >= 10) return "(ﾟ∀ﾟ)ｷﾀｺレ!!";
  return "(・∀・)ｲｲネ!!";
}

textEl.addEventListener("input", () => countEl.textContent = textEl.value.length);

function escape(str) {
  return str.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}

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

async function load() {
  const res = await fetch("/posts");
  const data = await res.json();
  data.forEach((p) => addPost(p, true));
}

const es = new EventSource("/events");
es.onmessage = e => {
  const p = JSON.parse(e.data);
  const existing = document.querySelector("li[data-id='" + p.id + "']");
  if (existing) {
    existing.querySelector(".likeCount").textContent = p.likes ?? 0;
    const repliesDiv = existing.querySelector(".replies");
    repliesDiv.innerHTML = (p.replies || []).map(r => "<div class='reply'>" + escape(r.text) + "<br><small>" + new Date(r.time).toLocaleString() + "</small></div>").join("");
    return;
  }
  addPost(p, true);
};

function postWithPermission() { checkPermission(); post(); }

async function post(){
  const user = userEl.value.trim() || "匿名";
  const text = textEl.value.trim();
  const realname = realnameEl.value.trim();
  if (!realname || !text) return;
  
  let imageData = null;
  if(imageEl.files[0]){
    imageData = await new Promise(r => { const f = new FileReader(); f.onload = ()=> r(f.result); f.readAsDataURL(imageEl.files[0]); });
  }

  await fetch("/post",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ user, text, image: imageData, realname })
  });
  textEl.value = ""; imageEl.value = "";
}

async function likePost(id){ await fetch("/like/" + id, { method: "POST" }); }
function showReplyBox(id){ document.getElementById("replyBox-" + id).style.display = "block"; }
async function sendReply(id){
  const input = document.getElementById("replyInput-" + id);
  await fetch("/reply/" + id,{ method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ text: input.value }) });
  input.value = "";
}

document.addEventListener('click', checkPermission, { once: true });
load();
</script>
</body>
</html>
`);
});

/* ===== API ===== */

// --- 【変更箇所】Service Worker (バックグラウンド受信機) ---
app.get("/sw.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.send(`
    self.addEventListener('push', e => {
      const data = e.data.json();
      self.registration.showNotification(data.title, { body: data.body, icon: '/favicon.ico' });
    });
  `);
});

// --- 【変更箇所】購読情報の保存 ---
app.post("/subscribe", (req, res) => {
  subscriptions.push(req.body);
  res.status(201).json({});
});

app.get("/posts", (req, res) => {
  res.json(posts.map((p, i) => ({ ...p, index: i })).sort((a, b) => a.time - b.time));
});

app.post("/post", async (req, res) => {
  const { user, text, image, realname } = req.body;
  const post = { id: Date.now(), user, realname, text, image, time: Date.now(), likes: 0, replies: [] };
  posts.unshift(post);
  await saveDB();

  // --- 【変更箇所】全購読者へプッシュ通知を送信 ---
  subscriptions.forEach(sub => {
    webpush.sendNotification(sub, JSON.stringify({ title: "新着投稿: " + user, body: text }))
      .catch(e => console.log("通知失敗"));
  });

  clients.forEach(c => c.write("data:" + JSON.stringify(post) + "\n\n"));
  res.sendStatus(200);
});

app.post("/like/:id", async (req, res) => {
  const post = posts.find(p => p.id === Number(req.params.id));
  if (post) {
    post.likes = (post.likes || 0) + 1;
    await saveDB();
    clients.forEach(c => c.write("data:" + JSON.stringify(post) + "\n\n"));
    res.sendStatus(200);
  }
});

app.post("/reply/:id", (req,res)=>{
  const post = posts.find(p => p.id === Number(req.params.id));
  if(post) {
    post.replies.push({ text: req.body.text, time: Date.now() });
    saveDB();
    clients.forEach(c => c.write("data:" + JSON.stringify(post) + "\n\n"));
  }
  res.sendStatus(200);
});

app.get("/events", requireAccess, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  clients.push(res);
  req.on("close", () => { clients = clients.filter(c => c !== res); });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server Running"));
