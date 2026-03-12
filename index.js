app.get("/", requireAccess, (req, res) => {
res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>takei.net</title>

<style>
#notice {
font-size:12px;
background-color:#000;
color:#eee;
padding:8px;
border-radius:6px;
font-family:monospace;
}

body{
background:#000;
color:#e7e9ea;
font-family:system-ui,sans-serif;
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

li{
list-style:none;
border-bottom:1px solid #2f3336;
padding:12px 0;
display:flex;
flex-direction:column;
}

img{
max-width:100%;
margin-top:8px;
border-radius:6px;
}

.actions{
margin-top:6px;
display:flex;
justify-content:flex-end;
gap:8px;
}

.replies{
margin-left:16px;
border-left:2px solid #2f3336;
padding-left:8px;
margin-top:8px;
font-size:0.9em;
background-color:#111;
border-radius:6px;
}

.counter{
text-align:right;
color:#71767b;
font-size:12px;
margin-bottom:8px;
}
</style>
</head>

<body>

<h1>takei.net</h1>

<div id="notice">
<h2>お知らせ</h2>
<ul>
<li>
【通知が出るようにりました。】<br>
投稿できない場合は南京錠→通知許可をONにしてください。
</li>
</ul>
</div>

<input id="realname" placeholder="本名(表示されません)">
<input id="user" placeholder="ユーザー名（必須）">

<textarea id="text" maxlength="140" placeholder="本文"></textarea>

<input type="file" id="image" accept="image/*">

<div class="counter">
<span id="count">0</span>/140
</div>

<button onclick="post()">投稿</button>

<ul id="posts"></ul>

<script>

const textEl=document.getElementById("text");
const countEl=document.getElementById("count");
const userEl=document.getElementById("user");
const imageEl=document.getElementById("image");
const realnameEl=document.getElementById("realname");

textEl.addEventListener("input",()=>{
countEl.textContent=textEl.value.length;
});

function escape(str){
return str.replace(/[&<>"']/g,c=>({
"&":"&amp;",
"<":"&lt;",
">":"&gt;",
'"':"&quot;",
"'":"&#39;"
}[c]));
}

function addPost(p){
const li=document.createElement("li");

let imgHTML=p.image ? "<img src='"+p.image+"'>" : "";

li.innerHTML=
"<b>"+escape(p.user)+"</b><br>"+
escape(p.text)+"<br>"+
imgHTML+
"<small>"+new Date(p.time).toLocaleString()+"</small>";

document.getElementById("posts").prepend(li);
}

async function load(){
const res=await fetch("/posts");
const data=await res.json();
data.forEach(addPost);
}

async function post(){

const user=userEl.value.trim()||"匿名";
const text=textEl.value.trim();
const realname=realnameEl.value.trim();

if(!realname){
alert("本名を入力してください");
return;
}

if(!text)return;

let imageData=null;

if(imageEl.files[0]){
const reader=new FileReader();

imageData=await new Promise(resolve=>{
reader.onload=()=>resolve(reader.result);
reader.readAsDataURL(imageEl.files[0]);
});
}

await fetch("/post",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
user,
text,
image:imageData,
realname
})
});

textEl.value="";
countEl.textContent="0";
imageEl.value="";
}

load();

</script>

</body>
</html>
`);
});
