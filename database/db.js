const initSqlJs = require("sql.js");
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "..", "mercadopro.db");
let database;

async function initDatabase() {
  const SQL = await initSqlJs({
    locateFile: file => path.join(
      __dirname, "..", "node_modules", "sql.js", "dist", file
    )
  });

  if (fs.existsSync(dbPath)) {
    const file = fs.readFileSync(dbPath);
    database = new SQL.Database(file);
  } else {
    database = new SQL.Database();
  }

  database.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Outros',
      unit TEXT NOT NULL DEFAULT 'UN',
      cost REAL NOT NULL DEFAULT 0,
      price REAL NOT NULL DEFAULT 0,
      stock INTEGER NOT NULL DEFAULT 0,
      min_stock INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subtotal REAL NOT NULL,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      paid REAL NOT NULL,
      change_amount REAL NOT NULL,
      payment_method TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  const count = database.exec("SELECT COUNT(*) AS total FROM products")[0]?.values[0][0] || 0;

  if (count === 0) {
    const seed = database.prepare(`
      INSERT INTO products
      (barcode,name,category,unit,cost,price,stock,min_stock)
      VALUES (?,?,?,?,?,?,?,?)
    `);
    [
      ["1","Agua com gas","Mercearia","UN",5,10,9,2],
      ["2","Arroz Tipo 1 5kg","Mercearia","UN",20,28.90,40,5],
      ["3","Feijão Carioca 1kg","Mercearia","UN",6,8.99,60,5],
      ["4","Água Mineral 500ml","Bebidas","UN",1.20,2.50,120,24]
    ].forEach(row => seed.run(row));
    seed.free();
    save();
  }
}

function save() {
  const data = database.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function rows(sql, params = []) {
  const stmt = database.prepare(sql);
  stmt.bind(params);
  const result = [];
  while (stmt.step()) result.push(stmt.getAsObject());
  stmt.free();
  return result;
}

function one(sql, params = []) {
  return rows(sql, params)[0] || null;
}

function run(sql, params = []) {
  const stmt = database.prepare(sql);
  stmt.run(params);
  const changes = database.getRowsModified();
  stmt.free();
  save();
  return changes;
}

function mapProduct(row) {
  if (!row) return null;
  return {
    ...row,
    id: Number(row.id),
    cost: Number(row.cost),
    price: Number(row.price),
    stock: Number(row.stock),
    minStock: Number(row.min_stock),
    active: Boolean(row.active)
  };
}

function listProducts(search = "") {
  const q = `%${String(search).toLowerCase()}%`;
  return rows(`
    SELECT * FROM products
    WHERE lower(name) LIKE ? OR lower(barcode) LIKE ? OR lower(category) LIKE ?
    ORDER BY id DESC
  `, [q,q,q]).map(mapProduct);
}

function getProduct(id) {
  return mapProduct(one("SELECT * FROM products WHERE id = ?", [id]));
}

function normalizeProduct(data) {
  const p = {
    barcode: String(data.barcode || "").trim(),
    name: String(data.name || "").trim(),
    category: String(data.category || "Outros").trim(),
    unit: String(data.unit || "UN").trim(),
    cost: Number(data.cost) || 0,
    price: Number(data.price) || 0,
    stock: Math.max(0, Math.trunc(Number(data.stock) || 0)),
    min_stock: Math.max(0, Math.trunc(Number(data.minStock ?? data.min_stock) || 0)),
    active: data.active === false || data.active === 0 ? 0 : 1
  };
  if (!p.barcode) throw new Error("Código de barras é obrigatório.");
  if (!p.name) throw new Error("Nome do produto é obrigatório.");
  if (p.price <= 0) throw new Error("Preço de venda deve ser maior que zero.");
  return p;
}

function createProduct(data) {
  const p = normalizeProduct(data);
  try {
    database.run(`
      INSERT INTO products
      (barcode,name,category,unit,cost,price,stock,min_stock,active)
      VALUES (?,?,?,?,?,?,?,?,?)
    `, [p.barcode,p.name,p.category,p.unit,p.cost,p.price,p.stock,p.min_stock,p.active]);
    save();
    const id = one("SELECT last_insert_rowid() AS id").id;
    return getProduct(id);
  } catch (e) {
    if (String(e.message).toLowerCase().includes("unique")) {
      throw new Error("Já existe um produto com este código de barras.");
    }
    throw e;
  }
}

function updateProduct(id, data) {
  if (!getProduct(id)) return null;
  const p = normalizeProduct(data);
  try {
    run(`
      UPDATE products SET
      barcode=?,name=?,category=?,unit=?,cost=?,price=?,stock=?,min_stock=?,active=?,
      updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `, [p.barcode,p.name,p.category,p.unit,p.cost,p.price,p.stock,p.min_stock,p.active,id]);
    return getProduct(id);
  } catch (e) {
    if (String(e.message).toLowerCase().includes("unique")) {
      throw new Error("Já existe outro produto com este código de barras.");
    }
    throw e;
  }
}

function createSale(data) {
  const items = Array.isArray(data.items) ? data.items : [];
  if (!items.length) throw new Error("O cupom está vazio.");

  const discount = Math.max(0, Number(data.discount) || 0);
  const paymentMethod = String(data.paymentMethod || "Dinheiro");
  const paid = Math.max(0, Number(data.paid) || 0);

  const prepared = items.map(item => {
    const product = getProduct(Number(item.productId));
    const quantity = Math.trunc(Number(item.quantity) || 0);
    if (!product) throw new Error(`Produto ${item.productId} não encontrado.`);
    if (quantity <= 0) throw new Error("Quantidade inválida.");
    if (quantity > product.stock) throw new Error(`Estoque insuficiente para: ${product.name}.`);
    return { product, quantity, unitPrice: product.price, total: product.price * quantity };
  });

  const subtotal = prepared.reduce((s,x)=>s+x.total,0);
  const total = Math.max(0, subtotal-discount);
  if (paid < total) throw new Error("O valor pago é menor que o total.");
  const changeAmount = paid-total;

  database.run("BEGIN TRANSACTION");
  try {
    database.run(`
      INSERT INTO sales
      (subtotal,discount,total,paid,change_amount,payment_method)
      VALUES (?,?,?,?,?,?)
    `, [subtotal,discount,total,paid,changeAmount,paymentMethod]);

    const saleId = Number(one("SELECT last_insert_rowid() AS id").id);

    for (const item of prepared) {
      database.run(`
        INSERT INTO sale_items
        (sale_id,product_id,product_name,quantity,unit_price,total)
        VALUES (?,?,?,?,?,?)
      `, [saleId,item.product.id,item.product.name,item.quantity,item.unitPrice,item.total]);

      database.run(
        "UPDATE products SET stock=stock-?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        [item.quantity,item.product.id]
      );
    }

    database.run("COMMIT");
    save();

    return { id:saleId, subtotal, discount, total, paid, change:changeAmount, paymentMethod };
  } catch (e) {
    database.run("ROLLBACK");
    throw e;
  }
}

function listSales() {
  return rows(`
    SELECT id,subtotal,discount,total,paid,
    change_amount AS changeAmount,payment_method AS paymentMethod,created_at AS createdAt
    FROM sales ORDER BY id DESC LIMIT 50
  `);
}

function dashboard() {
  return one(`
    SELECT
    (SELECT COUNT(*) FROM products WHERE active=1) AS products,
    (SELECT COUNT(*) FROM products WHERE stock<=min_stock AND active=1) AS lowStock,
    (SELECT COUNT(*) FROM sales WHERE date(created_at)=date('now','localtime')) AS salesToday,
    (SELECT COALESCE(SUM(total),0) FROM sales WHERE date(created_at)=date('now','localtime')) AS revenueToday
  `);
}

module.exports = {
  initDatabase,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  createSale,
  listSales,
  dashboard
};
