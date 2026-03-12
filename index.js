const { requireAccess, gateRoutes } = require("./gate");
const express = require("express");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");
const multer = require("multer"); //画像アップロード用

const app = express();
app.use(express.json());
app.use(express.json({制限: "2mb" })); // JSON大きめで画像対応
app.use(cookieParser());
ゲートルート(アプリ)

const FILE = path.join(__dirname, "posts.json");

// 投稿データ
posts = fs.existsSync(FILE) とします。
  ? JSON.parse(fs.readFileSync(FILE, "utf8"))
  : [];
クライアントを [] にします。

// NGワードと投稿禁止タイマー
定数NG_WORDS = [
  「ちんちん」、
  「ちんこ」、
  「まんこ」、
  「きんたま」、
  「チンチン」、
  「チンコ」、
  「マンコ」、
  「キンタマ」、
];
let bannedUsers = {}; // { ユーザー名: タイムスタンプ }

const Upload = multer({ storage: multer.memoryStorage() });

/* ===== 画面 ===== */
app.get("/", requireAccess, (req, res) => {
  res.send(`<!DOCTYPE html>
<html>
<ヘッド>
<メタ文字セット="utf-8">
<meta name="viewport" content="width=デバイス幅、初期スケール=1">
<title>takei.net</title>
<スタイル>
＃知らせ {
  フォントサイズ: 12px;
  背景色: #000;
  色: #eee;
  パディング: 8px;
  境界線の半径: 6px;
  フォントファミリー: 等幅;
}
#通知 h2 {
  フォントサイズ: 14px;
  下部マージン: 4px;
}
#通知 ul {
  マージン: 0;
  左パディング: 16px;
}
#通知 li {
  下部マージン: 2px;
}
本文 { 背景: #000; 色: #e7e9ea; フォントファミリー: system-ui, sans-serif; 最大幅: 600px; マージン: 自動; パディング: 16px; }
入力、テキストエリア { 幅: 100%; パディング: 10px; 背景: #000; 色: #fff; 境界線: 1px 実線 #2f3336; 境界線の半径: 6px; 下部マージン: 8px; }
テキストエリア { サイズ変更: なし; 高さ: 80px; }
ボタン { 背景: #1d9bf0; 色: #fff; 境界線: なし; 境界線の半径: 999px; パディング: 8px 16px; フォントの太さ: 太字; カーソル: ポインター; }
.deleteBtn { 背景: #f33; 左余白: 10px; }
.counter { テキスト配置: 右; 色: #71767b; フォントサイズ: 12px; 下部マージン: 8px; }
li { リストスタイル: なし; ボーダーボトム: 1px solid #2f3336; パディング: 12px 0; ディスプレイ: フレックス; フレックス方向: 列; }
小さい { 色: #71767b; }
img { 最大幅: 100%; 上余白: 8px; 境界線の半径: 6px; }
.アクション{
  上マージン: 6px;
  ディスプレイ: フレックス;
  justify-content: flex-end;
  ギャップ: 8px;
}
.actions ボタン {
  背景: 透明;
  色: #71767b;
  境界線: なし;
  パディング: 0;
  フォントサイズ: 12px;
  カーソル: ポインタ;   
}
.返信{
  左マージン: 16px;
  左境界線: 2px 実線 #2f3336;
  左パディング: 8px;
  上マージン: 8px;
  フォントサイズ: 0.9em;
  背景色: #111;
  境界線の半径: 6px;
}
.replies div {
  パディング: 4px 0;
  下部境界線: 1px 実線 #2f3336;
}
[id^="返信ボックス-"] {
  左マージン: 16px;
  上マージン: 4px;
}
[id^="replyBox-"] 入力 {
  幅: calc(100% - 60px);
  表示: インラインブロック;
}
[id^="replyBox-"] ボタン {
  表示: インラインブロック;
  左マージン: 4px;
  パディング: 4px 8px;
  フォントサイズ: 0.8em;
  カーソル: ポインタ;
}
.alert-text { 色: #ff4d4d; フォントの太さ: 太字; }
</スタイル>
</head>
<本文>

<div class="header">
  <h1>takei.net</h1>
  <input class="search" placeholder="検索">
</div>
<div id="通知">
  <h2>お知らせ</h2>
  <ul>
    <li>
      <p>【通知が出るようになりました。】</br>投稿できない場合は画面右上のURLの左の南京錠マークをクリックし、【このサイトに対する許可】をクリックし、【通知】を許可することを認識させていただきます。</br>３月４日は午前8時00分にご利用いただけます●バグについて：スマートフォンにて画像の投稿ができないバグを発見し、対処しています。未知のバグを発見した場合は根田までお願いします。【Ver.4.1.0】</p>
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

<ul id="投稿"></ul>

<スクリプト>
const textEl = document.getElementById("テキスト");
const countEl = document.getElementById("count");
const userEl = document.getElementById("user");
const imageEl = document.getElementById("画像");
const realnameEl = document.getElementById("realname");

// 通知許可を確実に求める関数
非同期関数 checkPermission() {
  if (ウィンドウ内の「通知」&& Notification.permission === "default") {
    Notification.requestPermission() を待機します。
  }
}

関数 likeText(いいね){
  if (いいね >= 10000000) return "ちんちんまんまんオナニーセックス";
  if (いいね >= 1000) return "イキスギィ";
  if (いいね >= 100) return "(ﾟ∀ﾟ)ｱﾋﾔﾋﾔ!!
  if (いいね >= 30) return "ｷﾀ━━(ﾟ∀ﾟ)━━!!";
  if (いいね >= 10) return "(ﾟ∀ﾟ)ｷﾀｺﾚ!!";
  return "(・∀・)イイネ!!";
}

textEl.addEventListener("input", () => countEl.textContent = textEl.value.length);

関数エスケープ(str) {
  str.replace(/[&<>"']/g, c => を返す
    （{ "&":"&", "<":"<", ">":">", '"':""", "'":"'" }[c]）
  ）;
}

関数 addPost(p, prepend = true) {
  const li = document.createElement("li");
  imgHTML = p.image ? "<img src='" + p.image + "'>" : ""; とします。

  replysHTML = ""; とします。
  p.replies && p.replies.length > 0 の場合 {
    p.replies.forEach(r => {
      返信HTML +=
        「<div class='返信'>」+
          エスケープ(r.text) +
          「<br><small>」+
          新しいDate(r.time).toLocaleString() +
          「</small>」+
        "</div>";
    });
  }

  li.innerHTML =
    "<b>" + escape(p.user) + "</b><br>" +
    エスケープ(p.text) + "<br>" +
    画像HTML +
    "<small>" + 新しい Date(p.time).toLocaleString() + "</small>" +
    "<div class='actions'>" +
      "<button onclick='likePost(" + p.id + ")'>" +
        "<span class='likeText'>" + likeText(p.likes ?? 0) + "</span> " +
        「<span class='likeCount'>」 + (p.likes ?? 0) + 「</span>」 +
      "</button>" +
    "</div>" +
    "<div class='replies' id='replies-" + p.id + "'>" +
      返信HTML +
    "</div>" +
    "<button onclick='showReplyBox(" + p.id + ")'>返信</button>" +
    "<div id='replyBox-" + p.id + "' style='display:none;'>" +
      "<input id='replyInput-" + p.id + "' placeholder='返信を書く'>" +
      "<button onclick='sendReply(" + p.id + ")'>送信</button>" +
    "</div>";

  li.dataset.id = p.id;
  const list = document.getElementById("投稿");
  先頭に追加しますか? list.prepend(li) : list.append(li);
}

非同期関数load() {
  const res = await fetch("/posts");
  const データ = res.json() を待機します。
  data.forEach((p) => addPost(p, true));
}

const es = 新しい EventSource("/events");
es.onmessage = e => {
  JSON のパースを const p で指定します。
  const existing = document.querySelector("li[data-id='" + p.id + "']");

  （存在する場合）{
    existing.querySelector(".likeCount").textContent = p.likes ?? 0;
    existing.querySelector(".likeText").textContent = likeText(p.likes ?? 0);
    const replysDiv = existing.querySelector(".replies");
    if (repliesDiv) {
      返信Div.innerHTML = "";
      (p.replies || []).forEach(r => {
        </small></div> を新しい Date(r.time).toLocaleString() に追加します。
      });
    }

    if (ウィンドウ内の「通知」&& Notification.permission === "許可") {
      const lastReply = p.replies[p.replies.length - 1];
      （lastReply && (Date.now() - lastReply.time) < 5000）の場合{
        new Notice("返信が届きました", { body: lastReply.text });
      }
    }
    戻る;
  }

  ポストを追加します(p, true);
  if (ウィンドウ内の「通知」&& Notification.permission === "許可") {
    new Notice("takei.net 新着投稿", { body: p.user + "： " + p.text });
  }
};

関数containsNG(テキスト){
  constwords = ["ちんちん","ちんこ","まんこ","きんたま","チンチン","チンコ","マンコ","キンタマ"];
  words.some(w=>text.includes(w)) を返します。
}

非同期関数 postWithPermission() {
  checkPermission() を待機します。
  役職（）;
}

非同期関数 post(){
  const user = userEl.value.trim() || 「匿名」;
  const text = textEl.value.trim();
  定数 realname = realnameEl.value.trim();
  if (!realname) {alert("本名を入力してください");戻る; }
  if (!text) を返す;
  if(containsNG(text)){alert("下ネタなんか書くなよｗｗｗ");戻る; }

  imageData を null にします。
  if(imageEl.files[0]){
    const ファイル = imageEl.files[0];
    imageData = 新しい Promise((resolve)=>{ を待機します。
      const リーダー = 新しい FileReader();
      reader.onload = ()=> 解決(reader.result);
      reader.readAsDataURL(ファイル);
    });
  }

  フェッチを待機("/post",{
    メソッド:"POST",
    ヘッダー:{"Content-Type":"application/json"},
    本文: JSON.stringify({ ユーザー, テキスト, 画像: imageData, 実名: realname })
  });

  textEl.value = "";
  countEl.textContent = "0";
  imageEl.value = "";
  textEl.blur();
}

const searchEl = document.querySelector(".search");
searchEl.addEventListener("入力", () => {
  const クエリ = searchEl.value.toLowerCase();
  const list = document.getElementById("投稿");
  const items = list.querySelectorAll("li");
  アイテム.forEach(li => {
    const text = li.textContent.toLowerCase();
    li.style.display = text.includes(query) ? "" : "なし";
  });
});

非同期関数 likePost(id){
  fetch("/like/" + id, { method: "POST" }); を待機します。
}

非同期関数 showReplyBox(id){
  checkPermission() を待機します。
  const box = document.getElementById("replyBox-" + id);
  box.style.display = box.style.display === "なし" ? "ブロック" : "なし";
}

非同期関数sendReply(id){
  const input = document.getElementById("replyInput-" + id);
  const テキスト = input.value.trim();
  if(!text) 戻り値;
  フェッチを待機("/reply/" + id,{
    メソッド:"POST",
    ヘッダー:{"Content-Type":"application/json"},
    本文: JSON.stringify({ text })
  });
  入力値 = "";
}

document.addEventListener('click', checkPermission, { once: true });

負荷（）;
</スクリプト>
</本文>
</html>
`);
});

/* ===== API ===== */
app.get("/posts", (req, res) => {
  const sortedPosts = 投稿
    .map((p, i) => ({ ...p, インデックス: i }))
    .sort((a, b) => a.time - b.time);
  res.json(ソートされた投稿);
});

app.post("/post", (req, res) => {
  const { ユーザー、テキスト、画像、実名 } = req.body;
  if (!text?.trim()) は res.sendStatus(400) を返します。
  if (NG_WORDS.some((w) => text.includes(w))) {
    bannedUsers[ユーザー] = Date.now();
    res.sendStatus(400)を返します。
  }
  if (bannedUsers[user] && Date.now() - bannedUsers[user] < 60000) {
    return res.status(429).send("1分間投稿禁止中です");
  }
  const ポスト = {
    id: Date.now(),
    ユーザー: ユーザー || 「匿名」、
    実名: 実名.trim(),
    テキスト: text.trim().slice(0, 140),
    画像: 画像 || null,
    時間: Date.now(),
    いいね: 0,
    返信: []
  };
  posts.unshift(post);
  fs.writeFileSync(FILE, JSON.stringify(posts, null, 2));
  clients.forEach((c) => c.write("data:" + JSON.stringify(post) + "\n\n"));
  res.sendStatus(200);
});

app.post("/reply/:id", (req,res)=>{
  const id = Number(req.params.id);
  const post = posts.find(p=>p.id===id);
  if(!post) return res.sendStatus(404);
  const reply = { テキスト: req.body.text、時間: Date.now() };
  post.replies.push(返信);
  fs.writeFileSync(FILE, JSON.stringify(posts,null,2));
  clients.forEach(c => c.write("data:" + JSON.stringify(post) + "\n\n"));
  res.sendStatus(200);
});

app.get("/events", requireAccess, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("接続", "キープアライブ");
  クライアントをプッシュします(res);
  req.on("close", () => {
    クライアント = clients.filter((c) => c !== res);
  });
});

app.post("/like/:id", (req, res) => {
  const id = Number(req.params.id);
  const post = posts.find(p => p.id === id);
  if (!post) return res.sendStatus(404);
  post.likes = (post.likes || 0) + 1;
  fs.writeFileSync(FILE, JSON.stringify(posts, null, 2));
  clients.forEach(c => c.write("data:" + JSON.stringify(post) + "\n\n"));
  res.sendStatus(200);
});
定数 PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("takei.net が実行中");
});
