const SUPABASE_URL="https://hxkhhnrorjxrrqxevvcr.supabase.co";
const SUPABASE_KEY="sb_publishable_V6MAGNlvc-PxgVMQUqnDKg_jJppxBa8";
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
const state={settings:null,tables:[],categories:[],products:[],groups:[],modifiers:[],links:[],table:null,category:null,cart:[],trackingToken:null,trackingTimer:null};
const $=s=>document.querySelector(s);
const money=n=>Number(n||0).toFixed(2)+" EGP";
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2400)}
function imgUrl(p){return p.image_url||"https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80"}
function esc(s){return String(s||"").replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]})}
async function init(){
 const results=await Promise.all([
  db.from("cafe_settings").select("*").limit(1).maybeSingle(),
  db.from("cafe_tables").select("*").eq("active",true).order("table_number"),
  db.from("categories").select("*").eq("active",true).order("sort_order"),
  db.from("products").select("*").eq("active",true).order("sort_order"),
  db.from("modifier_groups").select("*").eq("active",true).order("name"),
  db.from("modifiers").select("*").eq("active",true).order("sort_order"),
  db.from("product_modifier_groups").select("*")
 ]);
 if(results.some(function(x){return x.error}))return fail("تعذر تحميل بيانات المنيو");
 state.settings=results[0].data||{tax_percent:14,service_percent:8,cafe_name:"A&S Café"};
 state.tables=results[1].data||[];state.categories=results[2].data||[];state.products=results[3].data||[];state.groups=results[4].data||[];state.modifiers=results[5].data||[];state.links=results[6].data||[];
 $("#taxRate").textContent=state.settings.tax_percent;$("#serviceRate").textContent=state.settings.service_percent;
 renderTables();renderCategories();renderProducts();updateCart();
}
function fail(m){console.error(m);$("#tables").innerHTML='<div class="error">'+m+"</div>"}
function renderTables(){
 $("#tables").innerHTML=state.tables.map(function(t){return '<button class="table-btn '+(state.table&&state.table.id===t.id?"active":"")+'" data-table="'+t.id+'">طاولة '+esc(t.table_number)+"</button>"}).join("");
 document.querySelectorAll("[data-table]").forEach(function(b){b.onclick=function(){state.table=state.tables.find(function(t){return t.id===b.dataset.table});renderTables();$("#tableBadge").textContent="طاولة "+state.table.table_number;$("#tableBadge").classList.add("ready");$("#menuSection").scrollIntoView({behavior:"smooth"})}});
}
function renderCategories(){
 let html='<button class="chip '+(!state.category?"active":"")+'" data-cat="">الكل</button>';
 html+=state.categories.map(function(c){return '<button class="chip '+(state.category===c.id?"active":"")+'" data-cat="'+c.id+'">'+esc(c.icon||"•")+" "+esc(c.name)+"</button>"}).join("");
 $("#categories").innerHTML=html;
 document.querySelectorAll("[data-cat]").forEach(function(b){b.onclick=function(){state.category=b.dataset.cat||null;renderCategories();renderProducts()}});
}
function renderProducts(){
 const list=state.products.filter(function(p){return !state.category||p.category_id===state.category});
 $("#products").innerHTML=list.length?list.map(function(p){return '<article class="product"><div class="product-img" style="background-image:url(\''+imgUrl(p).replace(/'/g,"%27")+'\')"></div><div class="product-body"><h3>'+esc(p.name)+'</h3><p>'+esc(p.description||"اختيار فاخر من A&S Café.")+'</p><div class="price-row"><span class="price">'+money(p.price)+'</span><button class="add" data-product="'+p.id+'">+</button></div></div></article>"}).join(""):'<div class="empty">لا توجد منتجات في هذا القسم.</div>';
 document.querySelectorAll("[data-product]").forEach(function(b){b.onclick=function(){openProduct(b.dataset.product)}});
}
function openProduct(id){
 const p=state.products.find(function(x){return x.id===id});
 const groupIds=state.links.filter(function(x){return x.product_id===id}).map(function(x){return x.group_id});
 const groups=state.groups.filter(function(g){return groupIds.includes(g.id)});
 let groupsHtml=groups.map(function(g){let opts=state.modifiers.filter(function(m){return m.group_id===g.id}).map(function(m){return '<button class="mod-option" data-group="'+g.id+'" data-mod="'+m.id+'">'+esc(m.name)+(Number(m.price_delta)?' (+'+money(m.price_delta)+')':"")+"</button>"}).join("");return '<div class="mod-group"><div class="mod-head"><b>'+esc(g.name)+'</b><small>'+(g.max_select===1?"اختيار واحد":"اختيارات")+'</small></div><div class="mod-options">'+opts+"</div></div>"}).join("");
 $("#productModalBody").innerHTML='<div class="modal-product-img" style="background-image:url(\''+imgUrl(p).replace(/'/g,"%27")+'\')"></div><span class="eyebrow">A&S SELECTION</span><h2>'+esc(p.name)+'</h2><p>'+esc(p.description||"اختيار فاخر من A&S Café.")+'</p>'+groupsHtml+'<button class="primary-btn" id="addConfigured">إضافة للسلة · '+money(p.price)+"</button>";
 document.querySelectorAll(".mod-option").forEach(function(b){b.onclick=function(){const g=state.groups.find(function(x){return x.id===b.dataset.group});if(g.max_select===1)document.querySelectorAll('[data-group="'+g.id+'"]').forEach(function(x){x.classList.remove("selected")});b.classList.toggle("selected")}})
 $("#addConfigured").onclick=function(){const selected=[...document.querySelectorAll(".mod-option.selected")].map(function(x){return state.modifiers.find(function(m){return m.id===x.dataset.mod})}).filter(Boolean);const total=Number(p.price)+selected.reduce(function(s,m){return s+Number(m.price_delta||0)},0);state.cart.push({key:crypto.randomUUID(),product:p,qty:1,mods:selected,unit:total});updateCart();closeModal("productModal");toast("تمت الإضافة إلى السلة")};
 $("#productModal").classList.remove("hidden");
}
function closeModal(id){$("#"+id).classList.add("hidden")}
function updateCart(){
 $("#cartCount").textContent=state.cart.reduce(function(s,i){return s+i.qty},0);
 const subtotal=state.cart.reduce(function(s,i){return s+i.unit*i.qty},0),tax=subtotal*Number(state.settings?.tax_percent||0)/100,service=subtotal*Number(state.settings?.service_percent||0)/100;
 $("#subtotal").textContent=money(subtotal);$("#tax").textContent=money(tax);$("#service").textContent=money(service);$("#total").textContent=money(subtotal+tax+service);
 $("#cartItems").innerHTML=state.cart.length?state.cart.map(function(i){return '<div class="cart-item"><div class="cart-item-top"><div><h4>'+esc(i.product.name)+'</h4><small>'+esc(i.mods.map(function(m){return m.name}).join(" · ")||"بدون إضافات")+'</small></div><b>'+money(i.unit*i.qty)+'</b></div><div class="qty"><button data-minus="'+i.key+'">−</button><b>'+i.qty+'</b><button data-plus="'+i.key+'">+</button><button data-remove="'+i.key+'" style="margin-right:auto;color:#e88989">حذف</button></div></div>"}).join(""):'<div class="empty">السلة فارغة.<br>اختار حاجة تحبها من المنيو ☕</div>';
 document.querySelectorAll("[data-minus]").forEach(function(b){b.onclick=function(){changeQty(b.dataset.minus,-1)}});document.querySelectorAll("[data-plus]").forEach(function(b){b.onclick=function(){changeQty(b.dataset.plus,1)}});document.querySelectorAll("[data-remove]").forEach(function(b){b.onclick=function(){state.cart=state.cart.filter(function(x){return x.key!==b.dataset.remove});updateCart()}});
}
function changeQty(key,d){const i=state.cart.find(function(x){return x.key===key});if(!i)return;i.qty+=d;if(i.qty<1)state.cart=state.cart.filter(function(x){return x!==i});updateCart()}
function openCart(){$("#cartDrawer").classList.add("open");$("#drawerBackdrop").classList.add("show")}
function closeCart(){$("#cartDrawer").classList.remove("open");$("#drawerBackdrop").classList.remove("show")}
function statusLabel(s){return({new:"جديد — وصل للكاشير",confirmed:"تم تأكيد الطلب",preparing:"جاري التحضير",ready:"الطلب جاهز",served:"تم التقديم",completed:"مكتمل",cancelled:"تم إلغاء الطلب"})[s]||s}
async function refreshCustomerOrder(){if(!state.trackingToken)return;const r=await db.functions.invoke("customer-gateway",{body:{action:"get_order",token:state.trackingToken}});if(r.error||!r.data?.order)return;const o=r.data.order;$("#customerStatus").textContent=statusLabel(o.status);$("#customerStaff").textContent=(o.assigned_staff_name||"لم يبدأ التجهيز بعد")+(o.assigned_at?" · "+new Date(o.assigned_at).toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short"}):"");$("#customerCreated").textContent=new Date(o.created_at).toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short"});$("#customerEta").textContent=o.estimated_ready_at?new Date(o.estimated_ready_at).toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short"}):"لم يتم تحديده";if(o.status==="completed"||o.status==="cancelled"){clearInterval(state.trackingTimer);state.trackingTimer=null}}
async function sendOrder(){
 if(!state.table)return toast("اختار رقم الطاولة أولاً");if(!state.cart.length)return toast("السلة فارغة");
 const btn=$("#sendOrder");btn.disabled=true;btn.textContent="جاري إرسال الطلب…";
 const subtotal=state.cart.reduce((s,i)=>s+i.unit*i.qty,0),tax=subtotal*Number(state.settings.tax_percent||0)/100,service=subtotal*Number(state.settings.service_percent||0)/100;
 const token=crypto.randomUUID()+crypto.randomUUID();
 const order={table_id:state.table.id,status:"new",order_type:"dine_in",customer_note:$("#orderNote").value.trim()||null,subtotal:subtotal,tax_percent:state.settings.tax_percent,tax_amount:tax,service_percent:state.settings.service_percent,service_amount:service,total:subtotal+tax+service,customer_tracking_token:token};
 const inserted=await db.from("orders").insert(order).select("id,order_number,created_at").single();
 if(inserted.error){btn.disabled=false;btn.textContent="إرسال الطلب →";console.error(inserted.error);return toast("حصل خطأ أثناء إرسال الطلب")}
 const rows=state.cart.map(i=>({order_id:inserted.data.id,product_id:i.product.id,product_name:i.product.name,unit_price:i.unit,quantity:i.qty,line_total:i.unit*i.qty,notes:null}));
 const items=await db.from("order_items").insert(rows).select("id");
 if(items.error){console.error(items.error);toast("تم إنشاء الطلب لكن تعذر حفظ التفاصيل");btn.disabled=false;btn.textContent="إرسال الطلب →";return}
 const mods=[];state.cart.forEach((i,idx)=>i.mods.forEach(m=>mods.push({order_item_id:items.data[idx].id,modifier_id:m.id,modifier_name:m.name,price_delta:m.price_delta})));
 if(mods.length)await db.from("order_item_modifiers").insert(mods);
 closeCart();$("#successNumber").textContent="#"+inserted.data.order_number;state.trackingToken=token;$("#successModal").classList.remove("hidden");state.cart=[];$("#orderNote").value="";updateCart();btn.disabled=false;btn.textContent="إرسال الطلب →";await refreshCustomerOrder();if(state.trackingTimer)clearInterval(state.trackingTimer);state.trackingTimer=setInterval(refreshCustomerOrder,4000);
}
$("#cartBtn").onclick=openCart;$("#closeCart").onclick=closeCart;$("#drawerBackdrop").onclick=closeCart;$("#sendOrder").onclick=sendOrder;$("#newOrder").onclick=function(){closeModal("successModal");state.trackingToken=null;if(state.trackingTimer)clearInterval(state.trackingTimer);state.trackingTimer=null;};$("#closeProduct").onclick=function(){closeModal("productModal")};init();