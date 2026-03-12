const ACCESS_CODE = "マイクラ"; // 今使ってるコード

function gateRoutes(app) {
  app.get("/gate", (req, res) => {
    res.send(`
      <form method="POST" action="/gate">
        <input type="password" name="code" placeholder="アクセスコード">
        <button>入室</button>
      </form>
    `);
  });

  app.post("/gate", (req, res) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      const code = new URLSearchParams(body).get("code");
      if (code === ACCESS_CODE) {
        res.setHeader(
          "Set-Cookie",
          "access=ok; Path=/; Max-Age=86400"
        );
        res.redirect("/");
      } else {
        res.send("コードが違います");
      }
    });
  });
}

function requireAccess(req, res, next) {
  if (req.headers.cookie?.includes("access=ok")) {
    next();
  } else {
    res.redirect("/gate");
  }
}

module.exports = { requireAccess, gateRoutes };
