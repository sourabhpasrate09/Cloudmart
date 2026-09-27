const API=(window.CLOUDMART_CONFIG||{}).API_BASE_URL||"http://localhost:8000/api";
const DATA=window.CLOUDMART_PRODUCT_DATA||{};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const money=n=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(Number(n)||0);
const esc=s=>String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[m]));
const allLocal=()=>Object.values(DATA).map((p,i)=>({...p,id:Number(p.id||i+1)}));
const AUTH_TOKEN_KEY="cloudmart_auth_token";
const AUTH_USER_KEY="cloudmart_user";

function getAuthUser(){try{return JSON.parse(localStorage.getItem(AUTH_USER_KEY)||"null")}catch{return null}}
function getAuthToken(){return localStorage.getItem(AUTH_TOKEN_KEY)||""}
function saveAuth(data){localStorage.setItem(AUTH_TOKEN_KEY,data.token);localStorage.setItem(AUTH_USER_KEY,JSON.stringify(data.user));updateAccountUI()}
function clearAuth(){localStorage.removeItem(AUTH_TOKEN_KEY);localStorage.removeItem(AUTH_USER_KEY);updateAccountUI()}
function updateAccountUI(){
  const u=getAuthUser();
  $$('.account').forEach(a=>{a.href=u?'orders.html':'login.html';const s=a.querySelector('small'),b=a.querySelector('strong');if(s)s.textContent=u?`Hello, ${u.full_name.split(' ')[0]}`:'Hello, Shopper';if(b)b.textContent=u?'Account & Orders':'Sign in & Orders';});
}

async function api(path,opts={}){
  const method=(opts.method||"GET").toUpperCase();
  const headers={"Content-Type":"application/json",...(opts.headers||{})};
  const token=getAuthToken();
  if(token)headers.Authorization=`Bearer ${token}`;
  try{
    const r=await fetch(API+path,{...opts,headers});
    if(!r.ok){let msg=`API ${r.status}`;try{const d=await r.json();msg=d.detail||d.message||msg}catch{}throw new Error(msg)}
    return await r.json();
  }catch(e){
    // Only GET requests use the browser catalog fallback. Orders/auth never silently fall back to local storage.
    if(method!=="GET")throw e;
    console.warn('CloudMart API fallback:',path,e);
    const u=new URLSearchParams((path.split('?')[1]||''));
    const base=path.split('?')[0];
    let a=allLocal();
    if(base==='/categories')return [...new Set(a.map(x=>x.category))].sort();
    if(base==='/search/suggestions'){const q=(u.get('q')||'').toLowerCase();return a.filter(x=>(x.name+' '+x.brand+' '+x.category).toLowerCase().includes(q)).slice(0,8).map(x=>x.name)}
    if(base==='/products'){
      const s=u.get('search')||'',c=u.get('category')||'',cs=(u.get('categories')||'').split(',').filter(Boolean),lim=parseInt(u.get('limit')||'0')||0;
      if(s)a=a.filter(x=>(x.name+' '+x.brand+' '+x.category).toLowerCase().includes(s.toLowerCase()));
      if(c)a=a.filter(x=>x.category===c);if(cs.length)a=a.filter(x=>cs.includes(x.category));
      const total=a.length;if(lim)a=a.slice(0,lim);return {items:a,total,offline:true};
    }
    if(base==='/deals'){a=a.filter(x=>Number(x.discountPercent||0)>0);const c=u.get('category'),lim=parseInt(u.get('limit')||'0')||0;if(c)a=a.filter(x=>x.category===c);const total=a.length;if(lim)a=a.slice(0,lim);return {items:a,total,offline:true}}
    if(base==='/orders')return {items:localOrders(),offline:true};
    const m=base.match(/^\/products\/(\d+)$/);if(m&&DATA[m[1]])return DATA[m[1]];
    throw e;
  }
}

function cart(){try{return JSON.parse(localStorage.getItem("cloudmart_cart")||"[]")}catch{return[]}}
function localOrders(){try{return JSON.parse(localStorage.getItem("cloudmart_orders")||"[]")}catch{return[]}}
function save(c){localStorage.setItem("cloudmart_cart",JSON.stringify(c));count()}
function count(){const n=cart().reduce((a,x)=>a+x.qty,0);$$('.cart-count').forEach(x=>x.textContent=n)}
function toast(t){const x=$("#toast");if(x){x.textContent=t;x.style.display="block";clearTimeout(window.__toast);window.__toast=setTimeout(()=>x.style.display="none",2200)}}
function url(p){return `product-${String(p.id).padStart(3,"0")}.html`}
function imageFor(p){return DATA[p.id]?.image||p.image||""}
function add(p){const c=cart(),x=c.find(y=>y.id===Number(p.id));x?x.qty++:c.push({id:Number(p.id),name:p.name,brand:p.brand,price:Number(p.price),qty:1,image:imageFor(p)});save(c);toast("Added to cart")}
function imgTag(p,klass=""){const src=imageFor(p);return src?`<img class="${klass}" src="${src}" alt="${esc(p.name)}">`:`<div class="image-pending">Product image unavailable</div>`}
function card(p){return `<article class="product-card"><a href="${url(p)}"><div class="product-img">${imgTag(p)}</div><div class="product-info"><div class="brand">${esc(p.brand)}</div><div class="product-name">${esc(p.name)}</div><div class="product-desc">${esc(p.description||"Amazon.in product listing captured in CloudMart.")}</div><div>★ ${Number(p.rating||0).toFixed(1)} (${Number(p.reviewCount||0)})</div><div class="price-row"><div><div class="price">${money(p.price)}</div>${Number(p.discountPercent||0)>0?`<div class="discount">${Number(p.discountPercent)}% off</div>`:""}</div><button class="add-btn" data-add="${p.id}">Add to Cart</button></div></div></a></article>`}
function bind(){$$('[data-add]').forEach(b=>b.onclick=e=>{e.preventDefault();e.stopPropagation();const p=DATA[b.dataset.add]||allLocal().find(x=>x.id===Number(b.dataset.add));if(p)add(p)})}
function catSlug(x){return x.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}
async function categories(){const a=await api('/categories'),s=$("#categorySelect");if(s)s.innerHTML='<option value="">All</option>'+a.map(x=>`<option>${esc(x)}</option>`).join('');const g=$("#categoryGrid");if(g)g.innerHTML=a.map(x=>{const p=allLocal().find(y=>y.category===x);return `<a class="category-card category-image-card" href="category-${catSlug(x)}.html"><div class="category-card-image">${p?imgTag(p):'<div class="image-pending">Product image pending</div>'}</div><h3>${esc(x)}</h3><p>Amazon-sourced CloudMart products</p><div class="go">Explore ${esc(x)} →</div></a>`}).join('')}
function search(){const f=$("#globalSearch"),i=$("#searchInput"),s=$("#searchSuggestions"),sel=$("#categorySelect");if(!f||!i)return;let t;i.oninput=()=>{clearTimeout(t);const q=i.value.trim();if(!q){if(s)s.style.display='none';return}t=setTimeout(async()=>{const a=await api('/search/suggestions?q='+encodeURIComponent(q));if(!s)return;s.innerHTML=a.map(x=>`<div class="suggestion">${esc(x)}</div>`).join('');s.style.display=a.length?'block':'none';$$('.suggestion').forEach(x=>x.onclick=()=>{i.value=x.textContent.trim();f.requestSubmit()})},120)};f.onsubmit=e=>{e.preventDefault();location.href='products.html?search='+encodeURIComponent(i.value.trim())+(sel&&sel.value?'&category='+encodeURIComponent(sel.value):'')}}
async function home(){await categories();const f=$("#featuredProducts"),d=$("#dealsPanels");if(f){const a=await api('/products?limit=8');f.innerHTML=a.items.map(card).join('');bind()}if(d){const a=await api('/deals?limit=80'),g={};a.items.forEach(p=>(g[p.category]??=[]).push(p));d.innerHTML=Object.entries(g).slice(0,4).map(([c,p])=>{const top=p.slice(0,2);const off=Math.max(...p.map(x=>Number(x.discountPercent)||0));return `<a class="deal-panel" href="deals.html?category=${encodeURIComponent(c)}"><div class="discount">Up to ${off}% off</div><h3>${esc(c)}</h3><div class="deal-products">${top.map(x=>`<div class="deal-product"><img src="${esc(imageFor(x))}" alt="${esc(x.name)}"><div><strong>${esc(x.name)}</strong><span>${money(x.price)}</span><small>${Number(x.discountPercent||0)}% off</small></div></div>`).join('')}</div><strong class="deal-cta">Shop deals →</strong></a>`}).join('')}}
async function listing(mode){let u='/products?limit=1000',q=new URLSearchParams(location.search);if(mode==='category')u+='&category='+encodeURIComponent(document.body.dataset.category);if(mode==='collection'){const m=document.body.dataset.collection,map={"latest-tech":["Smartphones","Computers"],"trending-shoes":["Shoes"],"home-furniture":["Furniture","Home & Kitchen"]};u+='&categories='+encodeURIComponent((map[m]||[]).join(','))}if(mode==='deals'){u='/deals?limit=1000';if(q.get('category'))u+='&category='+encodeURIComponent(q.get('category'))}if(mode==='products'){if(q.get('search'))u+='&search='+encodeURIComponent(q.get('search'));if(q.get('category'))u+='&category='+encodeURIComponent(q.get('category'));if($("#pageSearch"))$("#pageSearch").value=q.get('search')||''}const a=await api(u);$("#resultCount").textContent=`${a.items.length} products found`;$("#productsGrid").innerHTML=a.items.map(card).join('');bind();if(mode==='products'&&$("#pageCategory")){const c=await api('/categories'),sel=$("#pageCategory");sel.innerHTML='<option value="">All Categories</option>'+c.map(x=>`<option ${x===q.get('category')?'selected':''}>${esc(x)}</option>`).join('');const go=()=>location.href='products.html?search='+encodeURIComponent($("#pageSearch").value)+'&category='+encodeURIComponent(sel.value);$("#pageSearch").onchange=go;sel.onchange=go}}
async function detail(){const pid=document.body.dataset.productId,p=await api('/products/'+pid),m=DATA[p.id]||p;const image=$("#productImage");if(image){image.src=DATA[p.id]?.image||p.image||'';image.alt=p.name||m.name||''}['productBrand','productName','productCategory'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=p[id==='productBrand'?'brand':id==='productName'?'name':'category']||''});const price=$("#productPrice");if(price)price.textContent=money(p.price);const desc=$("#productDescription");if(desc)desc.textContent=m.description||p.description||p.name;const rating=$("#productRating");if(rating)rating.textContent=`★ ${Number(p.rating||0).toFixed(1)} • ${Number(p.reviewCount||0)} reviews`;const addBtn=$("#addDetail");if(addBtn)addBtn.onclick=()=>add(m);const specs=$("#productSpecs");if(specs)specs.innerHTML=Object.entries(m.specs||p.specs||{}).map(([k,v])=>`<div class="spec"><b>${esc(k)}</b>${esc(v)}</div>`).join('');const src=$("#productSource");if(src)src.innerHTML=`Source: <span>${esc(m.sourceLabel||'Amazon.in screenshot supplied by user')}</span>`;const px=Number(p.price)||0,cashback=Math.round(px*0.03),bankOff=Math.round(px*0.1),emi=Math.max(1,Math.round(px/12));const offers=$("#productOffers");if(offers)offers.innerHTML=`<div class="offer-card"><b>Cashback</b><span>Upto ${money(cashback)} cashback as CloudMart balance when eligible</span></div><div class="offer-card"><b>Bank Offer</b><span>Upto ${money(bankOff)} discount on select Credit Cards</span></div><div class="offer-card"><b>No Cost EMI</b><span>EMI starts at ${money(emi)}/month.</span></div>`}
function renderCart(){const c=cart(),r=$("#cartItems");if(!r)return;if(!c.length){r.innerHTML='<div class="empty">Your cart is empty.</div>';$("#cartTotal").textContent=money(0);return}r.innerHTML=c.map(x=>`<div class="cart-item"><img src="${esc(x.image||'')}" alt=""><div><strong>${esc(x.name)}</strong><div>${esc(x.brand)}</div></div><div class="qty"><button data-q="-1" data-id="${x.id}">−</button>${x.qty}<button data-q="1" data-id="${x.id}">+</button></div><strong>${money(x.price*x.qty)}</strong></div>`).join('');$$('[data-q]').forEach(b=>b.onclick=()=>{const c=cart(),x=c.find(y=>y.id==b.dataset.id);x.qty+=Number(b.dataset.q);if(x.qty<=0)c.splice(c.indexOf(x),1);save(c);renderCart()});$("#cartTotal").textContent=money(c.reduce((a,x)=>a+x.price*x.qty,0))}

function paymentMethod(){return ($$('input[name="paymentMethod"]').find(r=>r.checked)||{value:'COD'}).value}
function togglePaymentPanels(){const method=paymentMethod();const upi=$("#payUPI"),card=$("#payCard");if(upi)upi.style.display=method==='UPI'?'block':'none';if(card)card.style.display=method==='CARD'?'block':'none';$$('.payment-option').forEach(x=>x.classList.toggle('selected',x.querySelector('input')?.checked));}
function cardBrand(num){const n=num.replace(/\D/g,'');if(/^4/.test(n))return 'VISA';if(/^(5[1-5]|2[2-7])/.test(n))return 'MASTERCARD';if(/^6/.test(n))return 'RUPAY / CARD';return 'CARD'}
function formatCardInput(){const input=$("#cardNumber"),brand=$("#cardBrandHint");if(!input)return;input.oninput=()=>{input.value=input.value.replace(/\D/g,'').slice(0,19).replace(/(.{4})/g,'$1 ').trim();if(brand)brand.textContent=cardBrand(input.value)}}
function renderRecommendations(){
  const row=$("#checkoutRecommendations"),buy=$("#buyAgainGrid");if(!row||!buy)return;
  const last=JSON.parse(localStorage.getItem('cloudmart_last_order_items')||'[]');
  const ids=last.map(x=>Number(x.product_id));
  let products=ids.map(id=>DATA[id]).filter(Boolean);
  if(products.length<6)products=[...products,...allLocal().filter(p=>!ids.includes(p.id))];
  buy.innerHTML=products.slice(0,8).map(card).join('');bind();
  row.style.display='block';
}

async function renderCheckoutDeals(){
  const grid=$("#checkoutDealGrid");if(!grid)return;
  try{
    const r=await api('/deals?limit=12');
    const items=(r.items||[]).filter(p=>Number(p.discountPercent||0)>0).slice(0,8);
    grid.innerHTML=items.map(card).join('');
    bind();
  }catch(e){
    const items=allLocal().filter(p=>Number(p.discountPercent||0)>0).slice(0,8);
    grid.innerHTML=items.map(card).join('');
    bind();
  }
}
async function checkout(){
  const c=cart(),summary=$("#checkoutSummary"),subtotal=$("#checkoutSubtotal"),total=$("#checkoutTotal"),user=getAuthUser();
  const loginNotice=$("#checkoutLoginNotice");if(loginNotice&&user)loginNotice.style.display='none';
  if(summary)summary.innerHTML=c.length?c.map(x=>`<div class="summary-item"><img src="${esc(x.image||'')}" alt=""><div><strong>${esc(x.name)}</strong><small>${esc(x.brand)} × ${x.qty}</small></div><strong>${money(x.price*x.qty)}</strong></div>`).join(''):'<div class="empty">Your cart is empty. <a href="products.html">Continue shopping →</a></div>';
  const grand=c.reduce((a,x)=>a+x.price*x.qty,0),itemCount=c.reduce((a,x)=>a+x.qty,0);if(subtotal)subtotal.textContent=money(grand);if(total)total.textContent=money(grand);const itemLabel=$("#summaryItemCount");if(itemLabel)itemLabel.textContent=`Items (${itemCount})`;
  const name=$("#customerName"),email=$("#customerEmail"),phone=$("#customerPhone");if(user){if(name&&!name.value)name.value=user.full_name||'';if(email&&!email.value)email.value=user.email||'';if(phone&&!phone.value)phone.value=user.phone||''}
  $$('input[name="paymentMethod"]').forEach(r=>r.onchange=togglePaymentPanels);togglePaymentPanels();formatCardInput();renderRecommendations();renderCheckoutDeals();
  const form=$("#checkoutForm");if(!form||!c.length)return;
  form.onsubmit=async e=>{e.preventDefault();
    if(!c.length)return toast('Your cart is empty');
    const method=paymentMethod();let payment_reference=null;
    if(method==='UPI'){const upi=$("#upiId").value.trim();if(!/^[\w.\-]+@[\w]+$/.test(upi))return toast('Enter a valid UPI ID');payment_reference='UPI:'+upi}
    if(method==='CARD'){const num=$("#cardNumber").value.replace(/\s+/g,''),exp=$("#cardExpiry").value.trim(),cvv=$("#cardCvv").value.trim();if(!/^\d{12,19}$/.test(num)||!/^[0-9]{2}\/\d{2}$/.test(exp)||!/^[0-9]{3,4}$/.test(cvv))return toast('Enter valid card details');payment_reference='CARD:**** '+num.slice(-4)}
    const o={customer_name:name.value.trim(),email:email.value.trim(),phone:phone.value.trim(),address:$("#shippingAddress").value.trim(),notes:$("#orderNotes").value.trim(),items:c.map(x=>({product_id:x.id,name:x.name,price:Number(x.price),quantity:x.qty})),total_amount:grand,payment_method:method,payment_reference};
    if(!o.customer_name||!o.phone||!o.address)return toast('Complete shipping details first');
    if(!getAuthUser()){$("#checkoutLoginNotice")?.scrollIntoView({behavior:'smooth',block:'center'});toast('You can order as a guest, or sign in to save orders to your account')}
    const btn=$("#placeOrderBtn");if(btn){btn.disabled=true;btn.textContent=method==='COD'?'Placing order…':'Processing payment…'}
    try{
      const r=await api('/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(o)});
      localStorage.setItem('cloudmart_last_order_items',JSON.stringify(o.items));localStorage.removeItem('cloudmart_cart');count();
      const success=$("#orderSuccess");if(success)success.innerHTML=`<div class="order-success"><div class="success-icon">✓</div><h3>${r.payment_status==='PAID'?'Payment successful':'Order placed successfully'}!</h3><p>Thank you, ${esc(o.customer_name)}. Your order has been saved to CloudMart.</p><div class="success-grid"><div><span>Order ID</span><strong>#${esc(r.order_id)}</strong></div><div><span>Payment</span><strong>${esc(r.payment_status||'PENDING')}</strong></div><div><span>Total</span><strong>${money(grand)}</strong></div></div><div class="success-actions"><a class="btn" href="orders.html">View Your Orders →</a><a class="btn secondary" href="products.html">Continue Shopping</a></div></div>`;
      form.style.display='none';toast('Order saved successfully');success?.scrollIntoView({behavior:'smooth',block:'center'});renderRecommendations();
    }catch(err){if(btn){btn.disabled=false;btn.textContent='Place Order →'}toast(err.message||'Could not place order — check the backend')}
  };
}

function orderMatches(o,q){const hay=[o.id,o.customer_name,o.phone,o.email,o.status,o.payment_method,o.items?.map(i=>i.name).join(' ')].join(' ').toLowerCase();return !q||hay.includes(q.toLowerCase())}
function orderCard(o){const items=Array.isArray(o.items)?o.items:[],itemHtml=items.slice(0,4).map(i=>{const p=DATA[i.product_id]||{};return `<div class="order-product"><img src="${esc(p.image||'')}" alt="${esc(i.name)}"><div><strong>${esc(i.name)}</strong><small>${esc(p.brand||'')} · Qty ${i.quantity}</small></div><span>${money(Number(i.price||0)*Number(i.quantity||1))}</span></div>`}).join('');const date=o.created_at?new Date(o.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}):'';return `<article class="order-card"><div class="order-meta"><div><span>ORDER PLACED</span><strong>${esc(date)}</strong></div><div><span>TOTAL</span><strong>${money(o.total_amount)}</strong></div><div><span>ORDER #</span><strong>${esc(o.id)}</strong></div></div><div class="order-status"><strong>${esc(o.status||'PLACED')}</strong><span>${esc(o.payment_method||'COD')} · ${esc(o.payment_status||'PENDING')}</span></div><div class="order-items">${itemHtml||'<div class="payment-note">No item details stored.</div>'}</div><div class="order-actions"><button class="btn secondary" data-buy-order="${esc(o.id)}">Buy it again</button>${items[0]?`<a class="btn secondary" href="${url({id:items[0].product_id})}">View item</a>`:''}</div></article>`}
async function orders(){const r=$("#ordersList");if(!r)return;const user=getAuthUser();if(!user){r.innerHTML='<div class="auth-required"><div class="auth-icon">👤</div><h2>Sign in to see your orders</h2><p>Your CloudMart order history is linked to your customer account.</p><a class="btn" href="login.html?return=orders.html">Sign in / Create account</a></div>';return}const a=await api('/orders'),items=a.items||[];const search=$("#orderSearch");const render=()=>{const q=(search?.value||'').trim();const filtered=items.filter(o=>orderMatches(o,q));r.innerHTML=filtered.length?filtered.map(orderCard).join(''):'<div class="empty">No matching orders.</div>';$$('[data-buy-order]').forEach(btn=>btn.onclick=()=>{const o=items.find(x=>String(x.id)===String(btn.dataset.buyOrder));const first=o?.items?.[0];if(first){add(DATA[first.product_id]||first);toast('Added to cart for another purchase')}})};if(search)search.oninput=render;render()}
async function loginPage(){const form=$("#loginForm"),register=$("#registerForm"),message=$("#authMessage");const user=getAuthUser();if(user&&$("#loggedInPanel")){$("#loggedInPanel").style.display='block';$("#authPanel").style.display='none';const d=$("#loggedUserDetails");if(d)d.innerHTML=`<strong>${esc(user.full_name)}</strong><span>${esc(user.email)}</span><span>${esc(user.phone||'No phone saved')}</span>`;const logout=$("#logoutBtn");if(logout)logout.onclick=async()=>{try{await api('/auth/logout',{method:'POST'})}catch{}clearAuth();location.reload()};return}const showMessage=(t,ok=false)=>{if(message){message.textContent=t;message.className='auth-message '+(ok?'success':'error')}};if(form)form.onsubmit=async e=>{e.preventDefault();const b=form.querySelector('button');b.disabled=true;try{const r=await api('/auth/login',{method:'POST',body:JSON.stringify({email:$("#loginEmail").value.trim(),password:$("#loginPassword").value})});saveAuth(r);showMessage('Login successful. Redirecting…',true);setTimeout(()=>{const dest=new URLSearchParams(location.search).get('return')||'orders.html';location.href=dest},350)}catch(err){showMessage(err.message||'Login failed')}finally{b.disabled=false}};if(register)register.onsubmit=async e=>{e.preventDefault();const b=register.querySelector('button');b.disabled=true;try{const r=await api('/auth/register',{method:'POST',body:JSON.stringify({full_name:$("#regName").value.trim(),email:$("#regEmail").value.trim(),phone:$("#regPhone").value.trim(),password:$("#regPassword").value})});saveAuth(r);showMessage('Account created. You are now signed in.',true);setTimeout(()=>{const dest=new URLSearchParams(location.search).get('return')||'index.html';location.href=dest},500)}catch(err){showMessage(err.message||'Could not create account')}finally{b.disabled=false}};}

document.addEventListener('DOMContentLoaded',async()=>{count();search();updateAccountUI();try{const p=document.body.dataset.page;if(p==='home')await home();else if(['products','category','collection','deals'].includes(p))await listing(p);else if(p==='product')await detail();else if(p==='cart')renderCart();else if(p==='checkout')await checkout();else if(p==='orders')await orders();else if(p==='login')await loginPage()}catch(e){console.error(e)}});
