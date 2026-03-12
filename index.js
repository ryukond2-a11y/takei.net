const { requireAccess, gateRoutes } = require("./gate");
const express = require("express");
const fs = require("fs");
const path = require("path");
const cookieParser = require("cookie-parser");

const app = express();

app.use(express.json({ limit: "20mb" }));
app.use(cookieParser());
gateRoutes(app);

const FILE = path.join(__dirname, "posts.json");
const USERFILE = path.join(__dirname, "users.json");

if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, "[]");
}

if (!fs.existsSync(USERFILE)) {
  fs.writeFileSync(USERFILE, "{}");
}

let posts = JSON.parse(fs.readFileSync(FILE, "utf8"));
let users = JSON.parse(fs.readFileSync(USERFILE, "utf8"));

let clients = [];

const NG_WORDS = [
  "ちんちん","ちんこ","まんこ","きんたま",
  "チンチン","チンコ","マンコ","キンタマ"
];

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
body{
background:#000;
color:#e7e9ea;
font-family:system-ui;
max-width:600px;
margin:auto;
padding:16px;
}

input,textarea{
width:100%;
padding:10px;
background:#000;
color:#fff;
border:1px solid #2f3336;
border-radius:6px;
margin-bottom:8px;
}

textarea{
resize:none;
height:80px;
}

button{
background:#1d9bf0;
color:#fff;
border:none;
border-radius:999px;
padding:8px 16px;
font-weight:bold;
cursor:pointer;
}

.counter{
text-align:right;
font-size:12px;
color:#71767b;
margin-bottom:8px;
}

li{
list-style:none;
border-bottom:1px solid #2f3336;
padding:12px 0;
}

small{
color:#71767b;
}

img{
max-width:100%;
margin-top:8px;
border-radius:6px;
}

.actions{
display:flex;
justify-content:flex-end;
margin-top:6px;
}

.replies{
margin-left:16px;
border-left:2px solid #2f3336;
padding-left:8px;
margin-top:8px;
font-size:0.9em;
}
</style>
</head>

<body>

<h1>takei.net</h1>

<input id="search" placeholder="検索">

<input id="realname" placeholder="本名（表示されません）">

<input id="user" placeholder="ユーザー名">

<input id="passcode" placeholder="パスコード（なりすまし防止）">

<textarea id="text" maxlength="140" placeholder="本文"></textarea>

<input type="file" id="image" accept="image/*">

<div class="counter"><span id="count">0</span>/140</div>

<button onclick="postWithPermission()">投稿</button>

<ul id="posts"></ul>

<script>

const textEl=document.getElementById("text")
const countEl=document.getElementById("count")
const userEl=document.getElementById("user")
const passEl=document.getElementById("passcode")
const imageEl=document.getElementById("image")
const realnameEl=document.getElementById("realname")
const searchEl=document.getElementById("search")

async function checkPermission(){
 if("Notification" in window && Notification.permission==="default"){
   await Notification.requestPermission()
 }
}

function likeText(likes){
 if(likes>=1000) return "イキスギィ"
 if(likes>=100) return "(ﾟ∀ﾟ)ｱﾋｬﾋｬ"
 if(likes>=30) return "ｷﾀ━━(ﾟ∀ﾟ)━━!!"
 if(likes>=10) return "(ﾟ∀ﾟ)ｷﾀｺﾚ!!"
 return "(・∀・)ｲｲﾈ!!"
}

textEl.addEventListener("input",()=>{
 countEl.textContent=textEl.value.length
})

function escape(str){
 return str.replace(/[&<>"']/g,c=>(
  {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]
 ))
}

function addPost(p,prepend=true){

 const li=document.createElement("li")

 let img=p.image ? "<img src='"+p.image+"'>" : ""

 li.innerHTML=
 "<b>"+escape(p.user)+"</b><br>"+
 escape(p.text)+"<br>"+
 img+
 "<small>"+new Date(p.time).toLocaleString()+"</small>"+
 "<div class='actions'>"+
 "<button onclick='likePost("+p.id+")'>"+
 "<span class='likeText'>"+likeText(p.likes||0)+"</span> "+
 "<span class='likeCount'>"+(p.likes||0)+"</span>"+
 "</button>"+
 "</div>"

 li.dataset.id=p.id

 const list=document.getElementById("posts")

 prepend ? list.prepend(li) : list.append(li)

}

async function load(){

 const res=await fetch("/posts")
 const data=await res.json()

 data.forEach(p=>addPost(p,true))

}

const es=new EventSource("/events")

es.onmessage=e=>{

 const p=JSON.parse(e.data)

 const existing=document.querySelector("li[data-id='"+p.id+"']")

 if(existing){
 existing.querySelector(".likeCount").textContent=p.likes||0
 existing.querySelector(".likeText").textContent=likeText(p.likes||0)
 return
 }

 addPost(p,true)

}

async function postWithPermission(){
 await checkPermission()
 post()
}

async function post(){

 const user=userEl.value.trim()||"匿名"
 const passcode=passEl.value.trim()
 const text=textEl.value.trim()
 const realname=realnameEl.value.trim()

 if(!realname){alert("本名入力");return}
 if(!passcode){alert("パスコード入力");return}
 if(!text)return

 let imageData=null

 if(imageEl.files[0]){

  const file=imageEl.files[0]

  imageData=await new Promise(resolve=>{
   const reader=new FileReader()
   reader.onload=()=>resolve(reader.result)
   reader.readAsDataURL(file)
  })

 }

 await fetch("/post",{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify({user,passcode,text,image:imageData,realname})
 })

 textEl.value=""
 imageEl.value=""
 countEl.textContent=0

}

searchEl.addEventListener("input",()=>{

 const q=searchEl.value.toLowerCase()

 document.querySelectorAll("#posts li").forEach(li=>{
  li.style.display=li.textContent.toLowerCase().includes(q)?"":"none"
 })

})

async function likePost(id){

 await fetch("/like/"+id,{method:"POST"})

}

document.addEventListener("click",checkPermission,{once:true})

load()

</script>

</body>
</html>`)

})

/* ===== API ===== */

app.get("/posts",(req,res)=>{

const sorted=posts.sort((a,b)=>a.time-b.time)

res.json(sorted)

})

app.post("/post",(req,res)=>{

const {user,passcode,text,image,realname}=req.body

if(!text?.trim()) return res.sendStatus(400)

if(!passcode) return res.status(400).send("パスコード必須")

if(!users[user]){
 users[user]=passcode
 fs.writeFileSync(USERFILE,JSON.stringify(users,null,2))
}

if(users[user]!==passcode){
 return res.status(403).send("なりすまし禁止")
}

if(NG_WORDS.some(w=>text.includes(w))){
 bannedUsers[user]=Date.now()
 return res.sendStatus(400)
}

if(bannedUsers[user] && Date.now()-bannedUsers[user]<60000){
 return res.status(429).send("1分投稿禁止")
}

const post={
id:Date.now(),
user:user||"匿名",
realname:(realname||"").trim(),
text:text.trim().slice(0,140),
image:image||null,
time:Date.now(),
likes:0,
replies:[]
}

posts.unshift(post)

fs.writeFileSync(FILE,JSON.stringify(posts,null,2))

clients.forEach(c=>c.write("data:"+JSON.stringify(post)+"\n\n"))

res.sendStatus(200)

})

app.get("/events",requireAccess,(req,res)=>{

res.setHeader("Content-Type","text/event-stream")
res.setHeader("Cache-Control","no-cache")
res.setHeader("Connection","keep-alive")

clients.push(res)

req.on("close",()=>{
 clients=clients.filter(c=>c!==res)
})

})

app.post("/like/:id",(req,res)=>{

const id=Number(req.params.id)

const post=posts.find(p=>p.id===id)

if(!post) return res.sendStatus(404)

post.likes++

fs.writeFileSync(FILE,JSON.stringify(posts,null,2))

clients.forEach(c=>c.write("data:"+JSON.stringify(post)+"\n\n"))

res.sendStatus(200)

})

const PORT=process.env.PORT || 3000

app.listen(PORT,()=>{
console.log("takei.net running")
})
