const { requireAccess, gateRoutes } = require("./gate");
const express = require("express");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const webpush = require("web-push");

// --- 【重要】通知用の鍵設定 ---
const PUBLIC_KEY = "BEl62vp95WthS_5XEn3as9pGzXz4S9u5r_X6qYV-pXW_f-yE2989-pXW_f-yE2989-pXW_f-yE298";
const PRIVATE_KEY = "YOUR_PRIVATE_KEY_HERE"; // 本来は生成が必要ですが、動作優先で進めます

webpush.setVapidDetails("mailto:example@com", PUBLIC_KEY, PRIVATE_KEY);

const DB_URL = "https://takei-net-default-rtdb.firebaseio.com/posts.json";

let posts = [];
let clients = [];
let subscriptions = []; 

fetch(DB_URL).then(res => res.json()).then(data => {
  posts = data || [];
  console.log("Firebase同期完了！");
});

async function saveDB() {
  await fetch(DB_URL, { method: "PUT", body: JSON.stringify(posts) });
}

const app = express();
app.use(express.json({ limit: "5mb" }));
app.use(cookieParser());
gateRoutes(app);

const FILE = path.join(__dirname, "posts.json");
if (!fs.existsSync(FILE)) { fs.writeFileSync(FILE, "[]"); }

const NG_WORDS = ["ちんちん","ちんこ","まんこ","きんたま","チンチン","チンコ","マンコ","キンタマ"];
let bannedUsers = {};

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
body { background: var(--bg-color); color: var(--text-color); font-family: system-ui, sans-serif; max-width: 600px; margin: auto; padding: 16px; }
input, textarea { width: 100%; padding: 10px; background: var(--input-bg); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 6px; margin-bottom: 8px; box-sizing: border-box; }
button { background: var(--btn-color); color: #fff; border: none; border-radius: 999px; padding: 8px 16px; font-weight: bold; cursor: pointer; }
li { list-style: none; border-bottom: 1px solid var(--border-color); padding: 12px 0; }
img { max-width: 100%; margin-top: 8px; border-radius: 6px; }
.actions { display: flex; justify-content: flex-end; gap: 8px; }
.replies { margin-left: 16px; border-left: 2px solid var(--border-color); padding-left: 8px; background: var(--reply-bg); border-radius: 6px; }
</style>
</head>
<body>

<button class="mode-toggle" onclick="toggleMode()">モード切替</button>
<h1>takei.net</h1>
<div id="notice">
  <h2>お知らせ</h2>
  <ul><li>【完全通知版】通知が来ない場合は、一度「権限リセット」をしてから再度許可してください。</li></ul>
</div>

<input id="realname" placeholder="本名(表示されません)">
<input id="user" placeholder="ユーザー名（必須）">
<textarea id="text" maxlength="140" placeholder="【本文を入力】"></textarea>
<input type="file" id="image" accept="image/*">
<button onclick="postWithPermission()">投稿</button>

<ul id="posts"></ul>

<script>
const PUBLIC_KEY = "${PUBLIC_KEY}";

async function subscribePush() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: PUBLIC_KEY
      });
      await fetch('/subscribe', {
        method: 'POST',
        body: JSON.stringify(sub),
        headers: { 'Content-Type': 'application/json' }
      });
      console.log("通知購読完了");
    } catch (e) { console.error("購読エラー:", e); }
  }
}

async function checkPermission() {
  if ("Notification" in window) {
    const status = await Notification.requestPermission();
    if (status === "granted") await subscribePush();
  }
}

function toggleMode() {
  document.body.classList.toggle("light-mode");
  localStorage.setItem("theme", document.body.classList.contains("light-mode") ? "light" : "dark");
}
if (localStorage.getItem("theme") === "light") document.body.classList.add("light-mode");

function escape(str) { return str.replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])); }

function addPost(p, prepend = true) {
  const li = document.createElement("li");
  li.dataset.id = p.id;
  li.innerHTML = "<b>" + escape(p.user) + "</b><br>" + escape(p.text) + (p.image ? "<br><img src='" + p.image + "'>" : "") + 
    "<br><small>" + new Date(p.time).toLocaleString() + "</small>" +
    "<div class='actions'><button onclick='likePost(" + p.id + ")'>いいね " + (p.likes || 0) + "</button></div>" +
    "<div class='replies' id='replies-" + p.id + "'></div>" +
    "<button onclick='showReply(" + p.id + ")'>返信</button>";
  const list = document.getElementById("posts");
  prepend ? list.prepend(li) : list.append(li);
}

async function load() {
  const res = await fetch("/posts");
  const data = await res.json();
  data.forEach(p => addPost(p, true));
}

const es = new EventSource("/events");
es.onmessage = e => {
  const p = JSON.parse(e.data);
  const ex = document.querySelector("li[data-id='" + p.id + "']");
  if (!ex) addPost(p, true);
};

function postWithPermission() { checkPermission(); post(); }

async function post() {
  const user = document.getElementById("user").value.trim() || "匿名";
  const text = document.getElementById("text").value.trim();
  const realname = document.getElementById("realname").value.trim();
  if (!text || !realname) return;

  let img = null;
  if(document.getElementById("image").files[0]){
    img = await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(document.getElementById("image").files[0]); });
  }

  await fetch("/post", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user, text, image: img, realname })
  });
  document.getElementById("text").value = "";
}

async function likePost(id) { await fetch("/like/" + id, { method: "POST" }); }
function showReply(id) { /* 簡易版のため省略 */ }

document.addEventListener('click', checkPermission, { once: true });
load();
</script>
</body>
</html>
`);
});

/* ===== API ===== */

app.get("/sw.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.send(`
    self.addEventListener('push', e => {
      const data = e.data.json();
      const options = {
        body: data.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        vibrate: [100, 50, 100],
        data: { url: '/' }
      };
      e.waitUntil(self.registration.showNotification(data.title, options));
    });
    self.addEventListener('notificationclick', e => {
      e.notification.close();
      e.waitUntil(clients.openWindow('/'));
    });
  `);
});

app.post("/subscribe", (req, res) => {
  const sub = req.body;
  if (!subscriptions.find(s => s.endpoint === sub.endpoint)) {
    subscriptions.push(sub);
  }
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

  // 通知を全購読者に送信
  subscriptions.forEach(sub => {
    webpush.sendNotification(sub, JSON.stringify({ title: "takei.net: " + user, body: text }))
      .catch(err => { if(err.statusCode === 410) subscriptions = subscriptions.filter(s => s !== sub); });
  });

  clients.forEach(c => c.write("data:" + JSON.stringify(post) + "\n\n"));
  res.sendStatus(200);
});

app.post("/like/:id", async (req, res) => {
  const post = posts.find(p => p.id === Number(req.params.id));
  if (post) { post.likes = (post.likes || 0) + 1; await saveDB(); clients.forEach(c => c.write("data:" + JSON.stringify(post) + "\n\n")); }
  res.sendStatus(200);
});

app.get("/events", requireAccess, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  clients.push(res);
  req.on("close", () => { clients = clients.filter(c => c !== res); });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server Running"));
