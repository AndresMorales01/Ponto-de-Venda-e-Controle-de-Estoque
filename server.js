const express = require("express");
const path = require("path");
const db = require("./database/db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/products", (req, res) => {
  const search = String(req.query.search || "").trim();
  const products = db.listProducts(search);
  res.json(products);
});

app.get("/api/products/:id", (req, res) => {
  const product = db.getProduct(Number(req.params.id));
  if (!product) return res.status(404).json({ error: "Produto não encontrado." });
  res.json(product);
});

app.post("/api/products", (req, res) => {
  try {
    const product = db.createProduct(req.body);
    res.status(201).json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/products/:id", (req, res) => {
  try {
    const product = db.updateProduct(Number(req.params.id), req.body);
    if (!product) return res.status(404).json({ error: "Produto não encontrado." });
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/dashboard", (req, res) => {
  res.json(db.dashboard());
});

app.post("/api/sales", (req, res) => {
  try {
    const sale = db.createSale(req.body);
    res.status(201).json(sale);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/sales", (req, res) => {
  res.json(db.listSales());
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "Rota não encontrada." });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

db.initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`MercadoPro rodando em http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Erro ao iniciar o banco de dados:", err);
    process.exit(1);
  });
