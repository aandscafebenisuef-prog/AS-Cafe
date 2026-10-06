const SUPABASE_URL="https://hxkhhnrorjxrrqxevvcr.supabase.co";
const SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4a2hobnJveGp4cnJxeGV2dmNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyNDIxMjEsImV4cCI6MjEwNjgxODEyMX0.YYvHxjF8tIOAPGoz2fZx3h1raQNzY2kvd5EsjLaUdQ";
function restBuilder(table,method="GET",payload=null){
 let selectText="*";let filters=[];let orderText="";let limitValue=null;let wantSingle=false;let returnRep=false;
 async function run(){
  try{
   let url=SUPABASE_URL+"/rest/v1/"+table;
   const q=[];
   if(method==="GET")q.push("select="+encodeURIComponent(selectText));
   filters.forEach(x=>q.push(x));if(orderText)q.push("order="+orderText);if(limitValue)q.push("limit="+limitValue);
   if(q.length)url+="?"+q.join("&");
   const headers={apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY,"Content-Type":"application/json"};
   if(method==="POST")headers.Prefer=returnRep?"return=representation":"return=minimal";
   const res=await fetch(url,{method,headers,body:method==="POST"?JSON.stringify(payload):undefined});
   const raw=await res.text();let data=raw?JSON.parse(raw):null;
   if(!res.ok)return {data:null,error:{message:data?.message||data?.error||raw||("HTTP "+res.status),code:data?.code}};
   if(wantSingle&&Array.isArray(data)){
    if(data.length===0)return {data:null,error:null};
    if(data.length>1)return {data:null,error:{message:"Multiple rows returned"}};
    data=data[0];
   }
   return {data,error:null};
  }catch(error){return {data:null,error}};
 }
 const api={
  select(cols="*"){selectText=cols;if(method==="POST")returnRep=true;return api},
  eq(col,val){filters.push(col+"=eq."+encodeURIComponent(String(val)));return api},
  is(col,val){filters.push(col+"=is."+String(val));return api},
  order(col,opts={}){orderText=col+(opts.ascending===false?".desc":".asc");return api},
  limit(n){limitValue=n;return api},
  maybeSingle(){wantSingle=true;return run()},
  single(){wantSingle=true;return run()},
  then(resolve,reject){return run().then(resolve,reject)}
 };
 return api;
}
const db={
 from(table){
  return {
   select(cols="*"){return restBuilder(table,"GET").select(cols)},
   insert(payload){return restBuilder(table,"POST",payload)}
  };
 },
 functions:{async invoke(name,{body}={}){try{const res=await fetch(SUPABASE_URL+"/functions/v1/"+name,{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await res.json().catch(()=>null);return res.ok?{data,error:null}:{data:null,error:{message:data?.error||"Function request failed"}}}catch(error){return {data:null,error}}}}
};
const state={settings:null,tables:[],categories:[],products:[],groups:[],modifiers:[],links:[],table:null,category:null,cart:[],trackingToken:null,trackingTimer:null};
const $=s=>document.querySelector(s);
const money=n=>Number(n||0).toFixed(2)+" EGP";
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2400)}
function imgUrl(p){return p.image_url||"https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80"}
function esc(s){return String(s||"").replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]})}
async function loadQuery(label,query){
 try{
  const result=await Promise.race([
   query,
   new Promise(function(resolve){setTimeout(function(){resolve({data:null,error:{message:"انتهت مهلة تحميل "+label}})},10000)})
  ]);
  if(result.error)console.error("A&S load failure:",label,result.error);
  return {label:label,data:result.data,error:result.error||null};
 }catch(error){console.error("A&S load exception:",label,error);return {label:label,data:null,error:error}}
}
async function init(){

 const menuResult=await loadQuery("المنيو",db.functions.invoke("customer-gateway",{body:{action:"get_menu"}}).then(function(r){return r.error?{data:null,error:r.error}:{data:r.data||null,error:null}}));
 const tableResult=await loadQuery("الطاولات",db.functions.invoke("customer-gateway",{body:{action:"get_tables"}}).then(function(r){return r.error?{data:null,error:r.error}:{data:r.data?.tables||[],error:null}}));
 const results=[tableResult,menuResult];
 state.settings=results[1].data?.settings||{tax_percent:14,service_percent:8,cafe_name:"A&S Café"};
 if(results[0].data&&results[0].data.length){state.tables=results[0].data.sort(function(a,b){return Number(a.table_number)-Number(b.table_number)});}else{state.tables=[];}
 state.categories=results[1].data?.categories||[];state.products=results[1].data?.products||[];state.groups=results[1].data?.groups||[];state.modifiers=results[1].data?.modifiers||[];state.links=results[1].data?.links||[];
 $("#taxRate").textContent=state.settings.tax_percent;$("#serviceRate").textContent=state.settings.service_percent;
 renderTables();renderCategories();renderProducts();updateCart();
 const failed=results.filter(function(x){return x.error});
 if(failed.length){
  const names=failed.map(function(x){return x.label}).join("، ");
  console.error("A&S data loading failures:",failed);
  if(failed.some(function(x){return x.label==="الطاولات"})) toast("تعذر تحميل الطاولات من الخادم؛ لن يتم عرض طاولات وهمية.");
  else if(failed.some(function(x){return x.label==="المنتجات"||x.label==="الأقسام"})) toast("تعذر تحميل المنيو بالكامل؛ حاول تحديث الصفحة.");
  else console.warn("Optional A&S data unavailable:",names);
 }
}
function fail(m){console.error(m);$("#tables").innerHTML='<div class="error">'+m+"</div>"}
function renderTables(){
 $("#tables").innerHTML=state.tables.map(function(t){return '<button type="button" class="table-btn '+(state.table&&state.table.id===t.id?"active":"")+'" data-table="'+t.id+'">طاولة '+esc(t.table_number)+"</button>"}).join("");
 $("#tables").onclick=function(e){const b=e.target.closest("[data-table]");if(!b)return;e.preventDefault();e.stopPropagation();state.table=state.tables.find(function(t){return t.id===b.dataset.table});if(!state.table)return;renderTables();$("#tableBadge").textContent="طاولة "+state.table.table_number;$("#tableBadge").classList.add("ready");$("#menuSection").scrollIntoView({behavior:"smooth"})};
}
function renderCategories(){
 let html='<button class="chip '+(!state.category?"active":"")+'" data-cat="">الكل</button>';
 html+=state.categories.map(function(c){return '<button class="chip '+(state.category===c.id?"active":"")+'" data-cat="'+c.id+'">'+esc(c.icon||"•")+" "+esc(c.name)+"</button>"}).join("");
 $("#categories").innerHTML=html;
 document.querySelectorAll("[data-cat]").forEach(function(b){b.onclick=function(){state.category=b.dataset.cat||null;renderCategories();renderProducts()}});
}
function renderProducts(){
 const list=state.products.filter(function(p){return !state.category||p.category_id===state.category});
 $("#products").innerHTML=list.length?list.map(function(p){
  const image=imgUrl(p).replace(/'/g,"%27");
  return `
   <article class="product">
    <div class="product-img" style="background-image:url('${image}')"></div>
    <div class="product-body">
     <h3>${esc(p.name)}</h3>
     <p>${esc(p.description||"اختيار فاخر من A&S Café.")}</p>
     <div class="price-row"><span class="price">${money(p.price)}</span><button class="add" data-product="${p.id}">+</button></div>
    </div>
   </article>`;
 }).join(""):'<div class="empty">لا توجد منتجات في هذا القسم.</div>';
 $("#products").onclick=function(e){const b=e.target.closest("[data-product]");if(!b)return;e.preventDefault();e.stopPropagation();openProduct(b.dataset.product)};
}
function openProduct(id){
 const p=state.products.find(function(x){return x.id===id}); if(!p)return;
 const groupIds=state.links.filter(function(x){return x.product_id===id}).map(function(x){return x.group_id});
 const groups=state.groups.filter(function(g){return groupIds.includes(g.id)}), hasModifiers=groups.length>0;
 const groupsHtml=groups.map(function(g){const opts=state.modifiers.filter(function(m){return m.group_id===g.id}).map(function(m){return '<button type="button" class="mod-option" data-group="'+g.id+'" data-mod="'+m.id+'">'+esc(m.name)+(Number(m.price_delta)?' (+'+money(m.price_delta)+')':"")+"</button>"}).join("");return '<div class="mod-group"><div class="mod-head"><b>'+esc(g.name)+'</b><small>'+(Number(g.min_select||0)>0?"إجباري":"اختياري")+(g.max_select===1?" · اختيار واحد":" · اختيارات")+'</small></div><div class="mod-options">'+opts+"</div></div>"}).join("");
 const qtyHtml=hasModifiers?"":'<div class="product-qty"><span>الكمية</span><div class="qty"><button type="button" id="productQtyMinus">−</button><b id="productQty">1</b><button type="button" id="productQtyPlus">+</button></div></div>';
 const noteHtml=p.notes_enabled?'<label class="product-note"><span>ملاحظات على المنتج (اختياري)</span><textarea id="productNote" maxlength="500" placeholder="مثلاً: بدون سكر، سخن، ..."></textarea></label>':"";
 $("#productModalBody").innerHTML='<div class="modal-product-img" style="background-image:url(\''+imgUrl(p).replace(/\\x27/g,"%27")+'\')"></div><span class="eyebrow">A&S SELECTION</span><h2>'+esc(p.name)+'</h2><p>'+esc(p.description||"اختيار فاخر من A&S Café.")+'</p>'+groupsHtml+qtyHtml+noteHtml+'<button class="primary-btn" id="addConfigured">إضافة للسلة · '+money(p.price)+"</button>";
 document.querySelectorAll(".mod-option").forEach(function(btn){btn.onclick=function(){const g=state.groups.find(function(x){return x.id===btn.dataset.group});if(g.max_select===1)document.querySelectorAll('[data-group="'+g.id+'"]').forEach(function(x){x.classList.remove("selected")});btn.classList.toggle("selected")}});
 let qty=1;if(!hasModifiers){$("#productQtyMinus").onclick=function(){qty=Math.max(1,qty-1);$("#productQty").textContent=qty};$("#productQtyPlus").onclick=function(){qty=Math.min(50,qty+1);$("#productQty").textContent=qty}}
 $("#addConfigured").onclick=function(){const selected=[...document.querySelectorAll(".mod-option.selected")].map(function(x){return state.modifiers.find(function(m){return m.id===x.dataset.mod})}).filter(Boolean);const total=Number(p.price)+selected.reduce(function(s,m){return s+Number(m.price_delta||0)},0);state.cart.push({key:(crypto.randomUUID?crypto.randomUUID():Date.now()+"-"+Math.random()),product:p,qty:hasModifiers?1:qty,mods:selected,unit:total,note:p.notes_enabled?(($("#productNote").val()||"").trim()):""});updateCart();closeModal("productModal");toast("تمت الإضافة إلى السلة")};
 $("#productModal").classList.remove("hidden");
}
function closeModal(id){$("#"+id).classList.add("hidden")}
function updateCart(){
 $("#cartCount").textContent=state.cart.reduce(function(s,i){return s+i.qty},0);
 const subtotal=state.cart.reduce(function(s,i){return s+i.unit*i.qty},0);
 const tax=subtotal*Number(state.settings?.tax_percent||0)/100;
 const service=subtotal*Number(state.settings?.service_percent||0)/100;
 $("#subtotal").textContent=money(subtotal);$("#tax").textContent=money(tax);$("#service").textContent=money(service);$("#total").textContent=money(subtotal+tax+service);
 $("#cartItems").innerHTML=state.cart.length?state.cart.map(function(i){
  return `
   <div class="cart-item">
    <div class="cart-item-top"><div><h4>${esc(i.product.name)}</h4><small>${esc(i.mods.map(function(m){return m.name}).join(" · ")||"بدون إضافات")}${i.note?" · "+esc(i.note):""}</small></div><b>${money(i.unit*i.qty)}</b></div>
    <div class="qty">${i.mods.length?"<b>1</b>":"<button data-minus=\""+i.key+"\">−</button><b>"+i.qty+"</b><button data-plus=\""+i.key+"\">+</button>"}<button data-remove="${i.key}" style="margin-right:auto;color:#e88989">حذف</button></div>
   </div>`;
 }).join(""):'<div class="empty">السلة فارغة.<br>اختار حاجة تحبها من المنيو ☕</div>';
 document.querySelectorAll("[data-minus]").forEach(function(b){b.onclick=function(){changeQty(b.dataset.minus,-1)}});
 document.querySelectorAll("[data-plus]").forEach(function(b){b.onclick=function(){changeQty(b.dataset.plus,1)}});
 document.querySelectorAll("[data-remove]").forEach(function(b){b.onclick=function(){state.cart=state.cart.filter(function(x){return x.key!==b.dataset.remove});updateCart()}});
}
function changeQty(key,d){const i=state.cart.find(function(x){return x.key===key});if(!i)return;i.qty+=d;if(i.qty<1)state.cart=state.cart.filter(function(x){return x!==i});updateCart()}
function openCart(){$("#cartDrawer").classList.add("open");$("#drawerBackdrop").classList.add("show")}
function closeCart(){$("#cartDrawer").classList.remove("open");$("#drawerBackdrop").classList.remove("show")}
function statusLabel(s){return({new:"جديد — وصل للكاشير",confirmed:"تم تأكيد الطلب",preparing:"جاري التحضير",ready:"الطلب جاهز",served:"تم التقديم",completed:"مكتمل",cancelled:"تم إلغاء الطلب"})[s]||s}
async function refreshCustomerOrder(){if(!state.trackingToken)return;const r=await db.functions.invoke("customer-gateway",{body:{action:"get_order",token:state.trackingToken}});if(r.error||!r.data?.order)return;const o=r.data.order;$("#customerStatus").textContent=statusLabel(o.status);$("#customerStaff").textContent=(o.assigned_staff_name||"لم يبدأ التجهيز بعد")+(o.assigned_at?" · "+new Date(o.assigned_at).toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short"}):"");$("#customerCreated").textContent=new Date(o.created_at).toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short"});$("#customerEta").textContent=o.estimated_ready_at?new Date(o.estimated_ready_at).toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short"}):"لم يتم تحديده";if(o.status==="completed"||o.status==="cancelled"){clearInterval(state.trackingTimer);state.trackingTimer=null}}
async function sendOrder(){
 if(!state.table)return toast("اختار رقم الطاولة أولاً");
 if(!state.cart.length)return toast("السلة فارغة");
 const customerName=$("#customerName").value.trim();
 if(!customerName)return toast("اسم الزبون مطلوب قبل تأكيد الطلب");
 const btn=$("#sendOrder");btn.disabled=true;btn.textContent="جاري إرسال الطلب…";

 const payload={
  action:"create_order",
  table_id:state.table.id,
  customer_name:customerName,
  customer_phone:$("#customerPhone").value.trim()||null,
  customer_note:$("#orderNote").value.trim()||null,
  items:state.cart.map(function(i){return {
   product_id:i.product.id,
   quantity:i.qty,
   modifier_ids:i.mods.map(function(m){return m.id}),notes:i.note||null
  }})
 };
 if(!payload.table_id){
  const tr=await db.from("cafe_tables").select("id,table_number,active").eq("table_number",state.table.table_number).eq("active",true).maybeSingle();
  if(tr.error||!tr.data){btn.disabled=false;btn.textContent="إرسال الطلب →";return toast("تعذر تأكيد الطاولة من الخادم");}
  payload.table_id=tr.data.id;state.table=tr.data;
 }

 const created=await db.functions.invoke("customer-gateway",{body:payload});
 if(created.error||!created.data?.order){
  console.error(created.error||created.data);
  btn.disabled=false;btn.textContent="إرسال الطلب →";
  return toast(created.error?.message||created.data?.error||"حصل خطأ أثناء إرسال الطلب");
 }

 closeCart();
 $("#successNumber").textContent="#"+created.data.order.order_number;
 state.trackingToken=created.data.tracking_token;
 $("#successModal").classList.remove("hidden");
 state.cart=[];$("#orderNote").value="";$("#customerName").value="";$("#customerPhone").value="";
 updateCart();btn.disabled=false;btn.textContent="إرسال الطلب →";
 await refreshCustomerOrder();
 if(state.trackingTimer)clearInterval(state.trackingTimer);
 state.trackingTimer=setInterval(refreshCustomerOrder,4000);
}
$("#cartBtn").onclick=openCart;$("#closeCart").onclick=closeCart;$("#drawerBackdrop").onclick=closeCart;$("#sendOrder").onclick=sendOrder;$("#newOrder").onclick=function(){closeModal("successModal");state.trackingToken=null;if(state.trackingTimer)clearInterval(state.trackingTimer);state.trackingTimer=null;};$("#closeProduct").onclick=function(){closeModal("productModal")};init();