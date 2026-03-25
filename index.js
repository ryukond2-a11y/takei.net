const { requireAccess, gateRoutes } = require("./gate");
const express = require("express");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");
const multer = require("multer"); // 画像アップロード用

// URLの最後に「posts.json」をつけるのがコツです！
const DB_URL = "https://takei-net-default-rtdb.firebaseio.com/posts.json";

// 【修正箇所1】宣言はここ1回だけにする
let posts = [];
let clients = [];

// 起動時にFirebaseからデータを取ってくる
fetch(DB_URL)
  .then(res => res.json())
  .then(data => {
    posts = data || [];
    console.log("Firebase同期完了！");
  });

// 保存用の関数を作る
async function saveDB() {
  await fetch(DB_URL, {
    method: "PUT",
    body: JSON.stringify(posts)
  });
}

const app = express();
app.use(express.json({ limit: "5mb" })); // JSON大きめで画像対応
app.use(cookieParser());
gateRoutes(app);

const FILE = path.join(__dirname, "posts.json");

if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, "[]");
}

// 【修正箇所2】二重宣言を回避（let posts = ... を削除）
// データは上のfetchで読み込まれるため、ここは不要

// NGワードと投稿禁止タイマー
const NG_WORDS = [
  "ちんちん",
  "ちんこ",
  "まんこ",
  "きんたま",
  "チンチン",
  "チンコ",
  "マンコ",
  "キンタマ",
];
let bannedUsers = {}; // { username: timestamp }
// 【追加】削除用パスワード
const DELETE_PASSWORD = "1234"; // ←好きなパスワードに変更
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
#notice {
  font-size: 12px;
  background-color: #000;
  color: #eee;
  padding: 8px;
  border-radius: 6px;
  font-family: monospace;
}
#notice h2 {
  font-size: 14px;
  margin-bottom: 4px;
}
#notice ul {
  margin: 0;
  padding-left: 16px;
}
#notice li {
  margin-bottom: 2px;
}
body { background: #000; color: #e7e9ea; font-family: system-ui, sans-serif; max-width: 600px; margin: auto; padding: 16px; }
input, textarea { width: 100%; padding: 10px; background: #000; color: #fff; border: 1px solid #2f3336; border-radius: 6px; margin-bottom: 8px; }
textarea { resize: none; height: 80px; }
button { background: #1d9bf0; color: #fff; border: none; border-radius: 999px; padding: 8px 16px; font-weight: bold; cursor: pointer; }
.deleteBtn { background: #f33; margin-left: 10px; }
.counter { text-align: right; color: #71767b; font-size: 12px; margin-bottom: 8px; }
li { list-style: none; border-bottom: 1px solid #2f3336; padding: 12px 0; display: flex; flex-direction: column; }
small { color: #71767b; }
img { max-width: 100%; margin-top: 8px; border-radius: 6px; }
.actions {
  margin-top: 6px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.actions button {
  background: transparent;
  color: #71767b;
  border: none;
  padding: 0;
  font-size: 12px;
  cursor: pointer;   
}
.replies {
  margin-left: 16px;
  border-left: 2px solid #2f3336;
  padding-left: 8px;
  margin-top: 8px;
  font-size: 0.9em;
  background-color: #111;
  border-radius: 6px;
}
.replies div {
  padding: 4px 0;
  border-bottom: 1px solid #2f3336;
}
[id^="replyBox-"] {
  margin-left: 16px;
  margin-top: 4px;
}
[id^="replyBox-"] input {
  width: calc(100% - 60px);
  display: inline-block;
}
[id^="replyBox-"] button {
  display: inline-block;
  margin-left: 4px;
  padding: 4px 8px;
  font-size: 0.8em;
  cursor: pointer;
}
.alert-text { color: #ff4d4d; font-weight: bold; }
</style>
</head>
<body>

<div class="header">
  <h1>takei.net</h1>
  <input class="search" placeholder="検索">
</div>
<div id="notice">
  <h2>お知らせ</h2>
  <ul>
    <li>
      <p>【通知が出るようにりました。】</br>投稿できない場合は画面右上のURLの左の南京錠マークをクリックし、【このサイトに対する権限】をクリックし、【通知】を許可にすることをお願いいたします。</br>３月４日は午前8時00分から利用ができ、午後4時以降はメンテナンスのため利用を一時停止することがあります。●バグについて：スマートフォンにて画像の投稿ができないバグを発見し、対処しています。未知のバグを発見した場合は根田までお知らせください。【Ver.4.1.0】</p>
    </li>
  </ul>
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
const textEl = document.getElementById("text");
const countEl = document.getElementById("count");
const userEl = document.getElementById("user");
const imageEl = document.getElementById("image");
const realnameEl = document.getElementById("realname");

// 通知許可を確実に求める関数
async function checkPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    await Notification.requestPermission();
  }
}

function likeText(likes){
  if (likes >= 10000000) return "ちんちんまんまんオナニーセックス";
  if (likes >= 1000) return "イキスギィ";
  if (likes >= 100) return "(ﾟ∀ﾟ)ｱﾋｬﾋｬﾋｬ!!";
  if (likes >= 30) return "ｷﾀ━━(ﾟ∀ﾟ)━━!!";
  if (likes >= 10) return "(ﾟ∀ﾟ)ｷﾀｺﾚ!!";
  return "(・∀・)ｲｲネ!!";
}

textEl.addEventListener("input", () => countEl.textContent = textEl.value.length);

function escape(str) {
  return str.replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c])
  );
}

function addPost(p, prepend = true) {
  const li = document.createElement("li");
  let imgHTML = p.image ? "<img src='" + p.image + "'>" : "";

  let repliesHTML = "";
  if (p.replies && p.replies.length > 0) {
    p.replies.forEach(r => {
      repliesHTML +=
        "<div class='reply'>" +
          escape(r.text) +
          "<br><small>" +
          new Date(r.time).toLocaleString() +
          "</small>" +
        "</div>";
    });
  }

  li.innerHTML =
    "<b>" + escape(p.user) + "</b><br>" +
    escape(p.text) + "<br>" +
    imgHTML +
    "<small>" + new Date(p.time).toLocaleString() + "</small>" +
    "<div class='actions'>" +
      "<button onclick='likePost(" + p.id + ")'>" +
        "<span class='likeText'>" + likeText(p.likes ?? 0) + "</span> " +
        "<span class='likeCount'>" + (p.likes ?? 0) + "</span>" +
      "</button>" +
    "</div>" +
    "<div class='replies' id='replies-" + p.id + "'>" +
      repliesHTML +
    "</div>" +
    "<button onclick='showReplyBox(" + p.id + ")'>返信</button>" +
    "<div id='replyBox-" + p.id + "' style='display:none;'>" +
      "<input id='replyInput-" + p.id + "' placeholder='返信を書く'>" +
      "<button onclick='sendReply(" + p.id + ")'>送信</button>" +
    "</div>";

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
    existing.querySelector(".likeText").textContent = likeText(p.likes ?? 0);
    const repliesDiv = existing.querySelector(".replies");
    if (repliesDiv) {
      repliesDiv.innerHTML = "";
      (p.replies || []).forEach(r => {
        repliesDiv.innerHTML += "<div class='reply'>" + escape(r.text) + "<br><small>" + new Date(r.time).toLocaleString() + "</small></div>";
      });
    }

    if ("Notification" in window && Notification.permission === "granted") {
      const lastReply = p.replies[p.replies.length - 1];
      if (lastReply && (Date.now() - lastReply.time) < 5000) {
        new Notification("返信が届きました", { body: lastReply.text });
      }
    }
    return;
  }

  addPost(p, true);
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("takei.net 新着投稿", { body: p.user + "： " + p.text });
  }
};

function containsNG(text){
  const words = ["ちんちん","ちんこ","まんこ","きんたま","チンチン","チンコ","マンコ","キンタマ"];
  return words.some(w=>text.includes(w));
}

async function postWithPermission() {
  await checkPermission();
  post();
}

async function post(){
  const user = userEl.value.trim() || "匿名";
  const text = textEl.value.trim();
  const realname = realnameEl.value.trim();
  if (!realname) { alert("本名を入力してください"); return; }
  if (!text) return;
  if(containsNG(text)){ alert("下ネタなんか書くなよｗｗｗ"); return; }

  let imageData = null;
  if(imageEl.files[0]){
    const file = imageEl.files[0];
    imageData = await new Promise((resolve)=>{
      const reader = new FileReader();
      reader.onload = ()=> resolve(reader.result);
      reader.readAsDataURL(file);
    });
  }

  await fetch("/post",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ user, text, image: imageData, realname: realname })
  });

  textEl.value = "";
  countEl.textContent = "0";
  imageEl.value = "";
  textEl.blur();
}

const searchEl = document.querySelector(".search");
searchEl.addEventListener("input", () => {
  const query = searchEl.value.toLowerCase();
  const list = document.getElementById("posts");
  const items = list.querySelectorAll("li");
  items.forEach(li => {
    const text = li.textContent.toLowerCase();
    li.style.display = text.includes(query) ? "" : "none";
  });
});

async function likePost(id){
  await fetch("/like/" + id, { method: "POST" });
}

async function showReplyBox(id){
  await checkPermission();
  const box = document.getElementById("replyBox-" + id);
  box.style.display = box.style.display === "none" ? "block" : "none";
}

async function sendReply(id){
  const input = document.getElementById("replyInput-" + id);
  const text = input.value.trim();
  if(!text) return;
  await fetch("/reply/" + id,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({ text })
  });
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
app.get("/posts", (req, res) => {
  const sortedPosts = posts
    .map((p, i) => ({ ...p, index: i }))
    .sort((a, b) => a.time - b.time);
  res.json(sortedPosts);
});
// 【追加】削除API
app.post("/delete/:id", (req, res) => {
  const id = Number(req.params.id);
  const { password } = req.body;

  if (password !== DELETE_PASSWORD) {
    return res.status(403).send("パスワード違います");
  }

  const index = posts.findIndex(p => p.id === id);
  if (index === -1) return res.sendStatus(404);

  posts.splice(index, 1);
  saveDB();

  // 全体更新通知（削除反映）
  clients.forEach(c => c.write("data:" + JSON.stringify({ deleteId: id }) + "\n\n"));

  res.sendStatus(200);
});
app.post("/post", async (req, res) => { 
  const { user, text, image, realname } = req.body;
  if (!text?.trim()) return res.sendStatus(400);
  if (NG_WORDS.some((w) => text.includes(w))) {
    bannedUsers[user] = Date.now();
    return res.sendStatus(400);
  }
  if (bannedUsers[user] && Date.now() - bannedUsers[user] < 60000) {
    return res.status(429).send("1分間投稿禁止中です");
  }
  const post = {
    id: Date.now(), 
    user: user || "匿名",
    realname: realname.trim(),
    text: text.trim().slice(0, 140),
    image: image || null,
    time: Date.now(),
    likes: 0,
    replies: []
  };

  const gasUrl = "https://script.google.com/macros/s/AKfycbyqUjSZDsU2kcob3XH6FIJTgYX9ApNQV6m9m_y2u77B_Eglw2ahw902YOK3k4d0UZxBbQ/exec";

  // 【修正箇所3】サーバー側からGASにデータを送信（エラー原因を除去）
  try {
    fetch(gasUrl, {
      method: "POST",
      body: JSON.stringify(post)
    });
    console.log("GAS送信指示完了");
  } catch (err) {
    console.error("GAS保存失敗:", err);
  }

  posts.unshift(post);
  await saveDB(); 
  clients.forEach((c) => c.write("data:" + JSON.stringify(post) + "\n\n"));
  res.sendStatus(200);
});

app.post("/reply/:id", (req,res)=>{
  const id = Number(req.params.id);
  const post = posts.find(p=>p.id===id);
  if(!post) return res.sendStatus(404);
  const reply = { text: req.body.text, time: Date.now() };
  post.replies.push(reply);
  // 【バグ修正】ここもsaveDB()を呼ぶように変更しないと返信が消えます
  saveDB(); 
  clients.forEach(c => c.write("data:" + JSON.stringify(post) + "\n\n"));
  res.sendStatus(200);
});

app.get("/events", requireAccess, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  clients.push(res);
  req.on("close", () => {
    clients = clients.filter((c) => c !== res);
  });
});

app.post("/like/:id", (req, res) => {
  const id = Number(req.params.id);
  const post = posts.find(p => p.id === id);
  if (!post) return res.sendStatus(404);
  post.likes = (post.likes || 0) + 1;
  // 【バグ修正】ここもsaveDB()を呼ぶように変更しないといいねが消えます
  saveDB(); 
  clients.forEach(c => c.write("data:" + JSON.stringify(post) + "\n\n"));
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("takei.net running");
});
