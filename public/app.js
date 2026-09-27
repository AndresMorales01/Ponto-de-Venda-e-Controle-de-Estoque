const $ = s => document.querySelector(s);
const money = v => Number(v || 0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

let products = [];
let cart = [];
let editingId = null;

function toast(msg){
  const t=$("#toast"); t.textContent=msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),2200);
}

async function api(url, options={}){
  const res=await fetch(url,{headers:{"Content-Type":"application/json"},...options});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || "Erro na operação.");
  return data;
}

async function loadProducts(search=""){
  products=await api("/api/products?search="+encodeURIComponent(search));
  renderProducts();
}

function renderProducts(){
  $("#productsBody").innerHTML=products.map(p=>`
    <tr>
      <td>${p.barcode}</td><td>${p.name}</td><td>${p.category}</td>
      <td>${money(p.price)}</td><td>${p.stock}</td>
      <td><button onclick="editProduct(${p.id})">Editar</button></td>
    </tr>`).join("");
}

window.editProduct=async id=>{
  const p=await api("/api/products/"+id);
  editingId=p.id;
  $("#productId").value=p.id; $("#productBarcode").value=p.barcode;
  $("#productName").value=p.name; $("#category").value=p.category;
  $("#unit").value=p.unit; $("#cost").value=p.cost; $("#price").value=p.price;
  $("#stock").value=p.stock; $("#minStock").value=p.minStock; $("#active").checked=p.active;
  switchPage("cadastro"); toast("Produto carregado para edição");
};

function clearProductForm(){
  editingId=null;
  ["productId","productBarcode","productName","cost","price","stock","minStock"].forEach(id=>$("#"+id).value="");
  $("#active").checked=true;
}
$("#newProduct").onclick=clearProductForm;

$("#saveProduct").onclick=async()=>{
  const body={
    barcode:$("#productBarcode").value.trim(), name:$("#productName").value.trim(),
    category:$("#category").value, unit:$("#unit").value,
    cost:Number($("#cost").value)||0, price:Number($("#price").value)||0,
    stock:Number($("#stock").value)||0, minStock:Number($("#minStock").value)||0,
    active:$("#active").checked
  };
  try{
    if(editingId) await api("/api/products/"+editingId,{method:"PUT",body:JSON.stringify(body)});
    else await api("/api/products",{method:"POST",body:JSON.stringify(body)});
    toast(editingId?"Produto atualizado":"Produto cadastrado");
    clearProductForm(); await loadProducts($("#search").value);
  }catch(e){toast(e.message)}
};

$("#search").oninput=()=>loadProducts($("#search").value);
$("#goSale").onclick=()=>switchPage("venda");

function switchPage(page){
  document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
  $("#page-"+page).classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  if(page==="venda")setTimeout(()=>$("#barcode").focus(),50);
  if(page==="cadastro")loadProducts($("#search").value);
}
document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>switchPage(b.dataset.page));

async function findProduct(){
  const code=$("#barcode").value.trim();
  if(!code){$("#foundProduct").textContent="Aguardando leitura";$("#unitPrice").textContent=money(0);$("#stockInfo").value=0;return null}
  const matches=await api("/api/products?search="+encodeURIComponent(code));
  const p=matches.find(x=>String(x.barcode)===code)||matches.find(x=>String(x.id)===code);
  if(!p){$("#foundProduct").textContent="Produto não encontrado";$("#unitPrice").textContent=money(0);$("#stockInfo").value=0;return null}
  $("#foundProduct").textContent=p.name;$("#unitPrice").textContent=money(p.price);$("#stockInfo").value=p.stock;
  return p;
}
$("#barcode").oninput=()=>findProduct().catch(e=>toast(e.message));
$("#barcode").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();addToCart()}};

async function addToCart(){
  try{
    const p=await findProduct();
    if(!p)return toast("Informe um código válido");
    const qty=Math.max(1,Number($("#saleQty").value)||1);
    const existing=cart.find(x=>x.productId===p.id);
    const newQty=(existing?existing.quantity:0)+qty;
    if(newQty>p.stock)return toast("Quantidade maior que o estoque disponível");
    if(existing)existing.quantity=newQty;
    else cart.push({productId:p.id,name:p.name,price:p.price,quantity:qty});
    renderCart();$("#barcode").focus();
  }catch(e){toast(e.message)}
}
$("#addSale").onclick=addToCart;
$("#testProduct").onclick=()=>{$("#barcode").value="4";addToCart()};

function renderCart(){
  $("#cartBody").innerHTML=cart.map((x,i)=>`
    <tr><td>${i+1}</td><td>${x.name}</td><td>${x.quantity}</td>
    <td>${money(x.price)}</td><td>${money(x.price*x.quantity)}</td>
    <td><button class="remove" onclick="removeCart(${x.productId})">X</button></td></tr>`).join("");
  $("#itemCount").textContent=cart.reduce((s,x)=>s+x.quantity,0);
  updateTotals();
}
window.removeCart=id=>{cart=cart.filter(x=>x.productId!==id);renderCart()};

function updateTotals(){
  const sub=cart.reduce((s,x)=>s+x.quantity*x.price,0);
  const discount=Math.max(0,Number($("#discount").value)||0);
  const total=Math.max(0,sub-discount), paid=Math.max(0,Number($("#paid").value)||0);
  $("#subtotal").textContent=money(sub);$("#total").textContent=money(total);$("#change").textContent=money(Math.max(0,paid-total));
}
$("#discount").oninput=updateTotals;$("#paid").oninput=updateTotals;

async function finishSale(){
  try{
    const subtotal=cart.reduce((s,x)=>s+x.quantity*x.price,0);
    const discount=Math.max(0,Number($("#discount").value)||0);
    const total=Math.max(0,subtotal-discount);
    const paid=Math.max(0,Number($("#paid").value)||0);
    if(!cart.length)return toast("O cupom está vazio");
    if(paid<total)return toast("Valor pago é menor que o total");

    await api("/api/sales",{method:"POST",body:JSON.stringify({
      items:cart.map(x=>({productId:x.productId,quantity:x.quantity})),
      discount,paid,paymentMethod:$("#payment").value
    })});

    toast("Venda confirmada com sucesso");
    cart=[];$("#discount").value=0;$("#paid").value=0;$("#barcode").value="";
    $("#foundProduct").textContent="Aguardando leitura";$("#unitPrice").textContent=money(0);$("#stockInfo").value=0;
    renderCart(); await loadProducts($("#search").value);
  }catch(e){toast(e.message)}
}
$("#finishSale").onclick=finishSale;
$("#cancelSale").onclick=()=>{cart=[];$("#discount").value=0;$("#paid").value=0;renderCart();toast("Venda cancelada")};

document.addEventListener("keydown",e=>{
  if(e.key==="F2"){e.preventDefault();$("#barcode").value="4";addToCart()}
  if(e.key==="F6"){e.preventDefault();finishSale()}
  if(e.key==="Escape"){e.preventDefault();cart=[];renderCart();$("#barcode").value="";$("#foundProduct").textContent="Aguardando leitura";$("#unitPrice").textContent=money(0);$("#stockInfo").value=0}
});

function clock(){const d=new Date();$("#clock").textContent=d.toLocaleTimeString("pt-BR")}
setInterval(clock,1000);clock();renderCart();clearProductForm();loadProducts();
