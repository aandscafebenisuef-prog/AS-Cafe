const SUPABASE_URL="https://hxkhhnrorjxrrqxevvcr.supabase.co";
const SUPABASE_KEY=null;
const ADMIN_GATEWAY=SUPABASE_URL+"/functions/v1/admin-gateway";
async function getApiKey(){const r=await fetch("app.js?key="+Date.now(),{cache:"no-store"});const t=await r.text();const k=t.indexOf("SUPABASE_KEY");const q=t.indexOf(""",k+12);const e=t.indexOf(""",q+1);if(k<0||q<0||e<0)throw new Error("تعذر قراءة إعدادات الاتصال");return t.slice(q+1,e)}
const ADMIN_TOKEN=(location.hash||"").replace(/^#/,"");
let profile=null,settings=null,currentView="orders",lockTimer=null;
const $=s=>document.querySelector(s);
const money=n=>Number(n||0).toFixed(2)+" EGP";
function toast(m){const e=$("#toast");if(!e)return;e.textContent=m;e.classList.add("show");setTimeout(()=>e.classList.remove("show"),2600)}
function label(s){return({new:"جديد 🔔",confirmed:"تم التأكيد",preparing:"قيد التحضير",ready:"جاهز",served:"تم التقديم",completed:"مكتمل",cancelled:"ملغي"})[s]||s}
function fmt(d){return d?new Date(d).toLocaleString("ar-EG",{dateStyle:"short",timeStyle:"short"}):"—"}

async function gateway(body){
  if(!ADMIN_TOKEN)return{data:null,error:{message:"رابط الإدارة غير صالح"}};
  try{
    const r=await fetch(ADMIN_GATEWAY,{method:"POST",headers:{"apikey":await getApiKey(),"Content-Type":"application/json"},body:JSON.stringify({...body,token:ADMIN_TOKEN}),cache:"no-store"});
    let j=null;try{j=await r.json()}catch(_){}
    if(!r.ok)return{data:null,error:{message:j?.error||j?.reason||"تعذر الاتصال بخادم الإدارة",status:r.status}};
    return{data:j?.data??j?.ok??null,error:j?.error?{message:j.error}:null};
  }catch(e){return{data:null,error:{message:e?.message||"فشل الاتصال"}}}
}

class AdminQuery{
  constructor(table){this.body={table,action:"select",columns:"*",filters:[],orders:[]}}
  select(columns="*"){this.body.action="select";this.body.columns=columns;return this}
  insert(data){this.body.action="insert";this.body.data=data;return this}
  update(data){this.body.action="update";this.body.data=data;return this}
  upsert(data,options={}){this.body.action="upsert";this.body.data=data;this.body.options=options;return this}
  delete(){this.body.action="delete";return this}
  eq(column,value){this.body.filters.push({op:"eq",column,value});return this}
  neq(column,value){this.body.filters.push({op:"neq",column,value});return this}
  ilike(column,value){this.body.filters.push({op:"ilike",column,value});return this}
  is(column,value){this.body.filters.push({op:"is",column,value});return this}
  in(column,value){this.body.filters.push({op:"in",column,value});return this}
  order(column,opts={}){this.body.orders.push({column,ascending:opts.ascending!==false});return this}
  limit(n){this.body.limit=n;return this}
  maybeSingle(){this.body.maybeSingle=true;return this}
  then(resolve,reject){return gateway(this.body).then(resolve,reject)}
  catch(reject){return gateway(this.body).catch(reject)}
}
const db={
  from(table){return new AdminQuery(table)},
  channel(){return{on(){return this},subscribe(){return this},unsubscribe(){return Promise.resolve()}}},
  functions:{invoke:async(name,opts)=>({data:null,error:{message:"هذه العملية غير متاحة في نظام الإدارة الجديد"}})}
};

async function lock(action){
  const r=await gateway({op:"lock",action});
  if(action==="acquire"||action==="heartbeat")return !!r.data;
  return !!r.data;
}
function showMessage(title,text){
  $("#loginView").classList.remove("hidden");$("#appView").classList.add("hidden");
  $("#loginTitle").textContent=title;$("#loginText").textContent=text;
}
async function boot(){
  if(!ADMIN_TOKEN){showMessage("رابط الإدارة غير صالح","افتح صفحة الإدارة من رابط المدير الخاص فقط.");return}
  const ok=await lock("acquire");
  if(!ok){showMessage("الإدارة مفتوحة بالفعل","جهاز آخر يستخدم صفحة الإدارة الآن. اقفل الصفحة هناك أو انتظر حتى تنتهي الجلسة.");return}
  lockTimer=setInterval(async()=>{
    const alive=await lock("heartbeat");
    if(!alive){clearInterval(lockTimer);lockTimer=null;showMessage("تم إيقاف الجلسة","تم فتح الإدارة من جهاز آخر. هذه الصفحة لم تعد تملك القفل.");}
  },7000);
  window.addEventListener("pagehide",()=>{try{fetch(ADMIN_GATEWAY,{method:"POST",keepalive:true,headers:{"apikey":SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({token:ADMIN_TOKEN,op:"lock",action:"release"})})}catch(_){}});
  await enter();
}
async function enter(){
  const r=await db.from("staff_profiles").select("*").eq("active",true).eq("role","owner").order("created_at",{ascending:true}).limit(1).maybeSingle();
  profile=r.data||{user_id:null,full_name:"مدير A&S",role:"owner",active:true};
  if(r.error){toast("تعذر قراءة بيانات المدير: "+r.error.message);return}
  const s=await db.from("cafe_settings").select("*").limit(1).maybeSingle();
  settings=s.data||null;
  $("#staffName").textContent=profile.full_name||"مدير A&S";
  $("#roleName").textContent="OWNER";
  $("#loginView").classList.add("hidden");$("#appView").classList.remove("hidden");renderView();
}
async function renderView(){
  const t={orders:"الطلبات",products:"المنتجات",categories:"الأقسام",tables:"الطاولات",settings:"الإعدادات"};
  $("#viewTitle").textContent=t[currentView]||"الإدارة";
  document.querySelectorAll("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===currentView));
  if(currentView==="orders")return orders();
  if(currentView==="products")return products();
  if(currentView==="categories")return categories();
  if(currentView==="tables")return tables();
  return settingsView();
}
async function orders(){
 const r=await db.from("orders").select("*,cafe_tables(table_number)").order("created_at",{ascending:false}).limit(1000);
 if(r.error)return $("#view").innerHTML='<div class="notice">تعذر تحميل الطلبات: '+(r.error.message||"")+"</div>";
 const rows=r.data||[],orderIds=rows.map(o=>o.id).filter(Boolean);let items=[],mods=[];
 if(orderIds.length){
  const ir=await db.from("order_items").select("id,order_id,product_name,unit_price,quantity,line_total,notes,created_at").in("order_id",orderIds).order("created_at",{ascending:true});
  if(ir.error)return $("#view").innerHTML='<div class="notice">تعذر تحميل تفاصيل المنتجات: '+ir.error.message+"</div>";
  items=ir.data||[];const itemIds=items.map(i=>i.id).filter(Boolean);
  if(itemIds.length){const mr=await db.from("order_item_modifiers").select("order_item_id,modifier_name,price_delta").in("order_item_id",itemIds);if(mr.error)return $("#view").innerHTML='<div class="notice">تعذر تحميل إضافات المنتجات: '+mr.error.message+"</div>";mods=mr.data||[]}
 }
 const byOrder=new Map();items.forEach(i=>{if(!byOrder.has(i.order_id))byOrder.set(i.order_id,[]);byOrder.get(i.order_id).push(i)});
 const modsByItem=new Map();mods.forEach(m=>{if(!modsByItem.has(m.order_item_id))modsByItem.set(m.order_item_id,[]);modsByItem.get(m.order_item_id).push(m)});
 const open=rows.filter(x=>x.status!=="completed"&&x.status!=="cancelled");
 const savedFrom=localStorage.getItem("as_cafe_sales_from")||new Date().toISOString().slice(0,10);
 const savedTo=localStorage.getItem("as_cafe_sales_to")||new Date().toISOString().slice(0,10);
 const fromDate=new Date(savedFrom+"T00:00:00"),toDate=new Date(savedTo+"T23:59:59.999");
 const inPeriod=rows.filter(x=>{const d=new Date(x.created_at);return !Number.isNaN(d.getTime())&&d>=fromDate&&d<=toDate&&x.status!=="cancelled"});
 const rev=inPeriod.reduce((s,x)=>s+Number(x.total||0),0);
 let html='<div class="accounting-period"><strong>📊 مدة المحاسبة</strong><label>من <input type="date" id="salesFrom" value="'+savedFrom+'"></label><label>إلى <input type="date" id="salesTo" value="'+savedTo+'"></label><button class="primary-btn" id="applySalesPeriod">حساب</button><span class="period-count">'+inPeriod.length+' طلب داخل الفترة</span></div><div class="stats"><div class="stat"><small>إجمالي الطلبات</small><b>'+rows.length+'</b></div><div class="stat"><small>طلبات مفتوحة</small><b>'+open.length+'</b></div><div class="stat"><small>جاهزة</small><b>'+rows.filter(x=>x.status==="ready").length+'</b></div><div class="stat"><small>إجمالي المبيعات للفترة</small><b>'+money(rev)+'</b></div></div><div class="toolbar"><button class="danger-btn" id="clearOrderHistory">🗑 مسح سجل الطلبات بالكامل</button></div><div class="orders">';
 html+=rows.length?rows.map(o=>{
  const orderItems=byOrder.get(o.id)||[];
  const itemsHtml=orderItems.length?orderItems.map(i=>{
   const itemMods=(modsByItem.get(i.id)||[]).map(m=>'<span class="invoice-mod">'+String(m.modifier_name||"")+(Number(m.price_delta)?' · +'+money(m.price_delta):"")+"</span>").join("");
   const note=i.notes?'<div class="invoice-note">ملاحظة: '+String(i.notes)+"</div>":"";
   return '<div class="item-row invoice-item"><div><strong>'+Number(i.quantity||0)+" × "+String(i.product_name||"منتج")+'</strong><div class="invoice-sub">'+money(i.unit_price)+" للوحدة "+itemMods+"</div>"+note+'</div><b>'+money(i.line_total)+"</b></div>";
  }).join(""):'<div class="invoice-note">لا توجد تفاصيل منتجات محفوظة لهذا الطلب.</div>';
  const opts=["new","confirmed","preparing","ready","served","completed","cancelled"].map(s=>'<option value="'+s+'" '+(s===o.status?"selected":"")+'>'+label(s)+"</option>").join("");
  return '<article class="order-card"><div class="order-top"><div><div class="order-no">#'+o.order_number+'</div><span class="table-tag">طاولة '+(o.cafe_tables?o.cafe_tables.table_number:"—")+'</span></div><span class="price">'+money(o.total)+'</span></div><div class="order-meta"><span>📅 '+fmt(o.created_at)+'</span><span>🕐 '+(o.created_at?new Date(o.created_at).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"}):"—")+'</span><span>👤 الزبون: '+(o.customer_name||"—")+(o.customer_phone?" · "+o.customer_phone:"")+'</span></div><div class="items"><div class="invoice-title">تفاصيل الفاتورة</div>'+itemsHtml+'<div class="invoice-totals"><div><span>المجموع الفرعي</span><b>'+money(o.subtotal)+'</b></div><div><span>الضريبة ('+Number(o.tax_percent||0)+"%)</span><b>"+money(o.tax_amount)+'</b></div><div><span>الخدمة ('+Number(o.service_percent||0)+"%)</span><b>"+money(o.service_amount)+'</b></div><div class="invoice-total"><span>الإجمالي</span><strong>'+money(o.total)+'</strong></div></div>'+(o.customer_note?'<div class="invoice-note order-note">ملاحظة الطلب: '+o.customer_note+"</div>":"")+'</div><div class="status-row"><select class="status-select" data-status="'+o.id+'">'+opts+'</select><select class="eta-select" data-eta="'+o.id+'"><option value="">بدون وقت تقديري</option><option value="15">بعد 15 دقيقة</option><option value="20">بعد 20 دقيقة</option><option value="30">بعد 30 دقيقة</option><option value="45">بعد 45 دقيقة</option><option value="60">بعد ساعة</option><option value="90">بعد ساعة ونصف</option><option value="120">بعد ساعتين</option></select></div><div class="eta-line">'+(o.estimated_ready_at?"موعد متوقع: <b>"+fmt(o.estimated_ready_at)+"</b>":"يمكن ترك الوقت فارغًا.")+"</div></article>";
 }).join(""):'<div class="notice">لا توجد طلبات حتى الآن.</div>';
 $("#view").innerHTML=html+"</div>";
 const applyPeriod=()=>{const a=$("#salesFrom").value,b=$("#salesTo").value;if(!a||!b)return toast("اختار تاريخ البداية والنهاية");if(a>b)return toast("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");localStorage.setItem("as_cafe_sales_from",a);localStorage.setItem("as_cafe_sales_to",b);orders()};
 $("#applySalesPeriod").onclick=applyPeriod;

 document.querySelector("#clearOrderHistory").onclick=async()=>{if(!confirm("سيتم حذف سجل الطلبات فقط. لن يتم حذف المنتجات أو الأقسام أو الطاولات أو الإضافات أو إعدادات الكافيه. هل أنت متأكد؟"))return;const d=await db.from("orders").delete().neq("id","00000000-0000-0000-0000-000000000000");if(d.error)return toast("تعذر مسح سجل الطلبات: "+d.error.message);toast("تم مسح سجل الطلبات فقط");orders()};document.querySelectorAll("[data-status]").forEach(s=>s.onchange=async()=>{const rr=await db.from("orders").update({status:s.value,updated_at:new Date().toISOString()}).eq("id",s.dataset.status);if(rr.error)toast("تعذر تحديث الحالة: "+rr.error.message);else orders()});
 document.querySelectorAll("[data-eta]").forEach(s=>{const o=rows.find(x=>x.id===s.dataset.eta);if(o?.estimated_ready_at){const diff=Math.round((new Date(o.estimated_ready_at)-Date.now())/60000);const m=[15,20,30,45,60,90,120].find(n=>Math.abs(n-diff)<=2);if(m)s.value=String(m)}s.onchange=async()=>{const iso=s.value?new Date(Date.now()+Number(s.value)*60000).toISOString():null;const rr=await db.from("orders").update({estimated_ready_at:iso,updated_at:new Date().toISOString()}).eq("id",s.dataset.eta);if(rr.error)toast("تعذر حفظ الموعد");else orders()}});
async function products(){
 const r=await Promise.all([db.from("products").select("*,categories(name)").order("sort_order"),db.from("categories").select("id,name").eq("active",true).order("sort_order")]),rows=r[0].data||[],cats=r[1].data||[];
 let html='<div class="toolbar"><button class="primary-btn" id="newProduct">+ إضافة منتج</button><input id="productSearch" placeholder="بحث…"></div><div class="table-wrap"><table class="data-table"><thead><tr><th>المنتج</th><th>القسم</th><th>السعر</th><th>الحالة</th><th>الملاحظات</th><th>إجراءات</th></tr></thead><tbody>';
 html+=rows.map(x=>'<tr><td>'+x.name+'</td><td>'+(x.categories?x.categories.name:"—")+'</td><td class="price">'+money(x.price)+'</td><td>'+(x.active?"نشط":"مخفي")+'</td><td>'+(x.notes_enabled?"مفعلة":"مقفولة")+'</td><td><button class="btn-small" data-edit-product="'+x.id+'">تعديل</button> <button class="btn-small" data-toggle="'+x.id+'" data-active="'+x.active+'">'+(x.active?"إخفاء":"تفعيل")+'</button> <button class="btn-small" data-notes-toggle="'+x.id+'" data-notes-enabled="'+x.notes_enabled+'">'+(x.notes_enabled?"إيقاف الملاحظات":"تفعيل الملاحظات")+"</button></td></tr>").join("")+"</tbody></table></div>";
 $("#view").innerHTML=html;$("#newProduct").onclick=()=>productForm(cats);$("#productSearch").oninput=e=>document.querySelectorAll("tbody tr").forEach(r=>r.style.display=r.textContent.includes(e.target.value)?"":"none");document.querySelectorAll("[data-edit-product]").forEach(b=>b.onclick=()=>productForm(cats,rows.find(x=>x.id===b.dataset.editProduct)));document.querySelectorAll("[data-toggle]").forEach(b=>b.onclick=async()=>{const r=await db.from("products").update({active:b.dataset.active!=="true",updated_at:new Date().toISOString()}).eq("id",b.dataset.toggle);if(r.error)return toast("تعذر تغيير حالة المنتج");products()});document.querySelectorAll("[data-notes-toggle]").forEach(b=>b.onclick=async()=>{const r=await db.from("products").update({notes_enabled:b.dataset.notesEnabled!=="true",updated_at:new Date().toISOString()}).eq("id",b.dataset.notesToggle);if(r.error)return toast("تعذر تغيير إعداد الملاحظات");products()});
}
function productForm(cats,item){
  const opts=cats.map(function(c){return "<option value=\"" + c.id + "\" " + (item&&item.category_id===c.id?"selected":"") + ">" + c.name + "</option>";}).join("");
  const currentImage=item&&item.image_url?item.image_url:"";
  $("#view").innerHTML='<div class="form-card"><div class="notice">'+(item?"تعديل بيانات المنتج.":"إضافة منتج جديد للمنيو.")+'</div><form id="pf" class="form-grid"><label>اسم المنتج<input name="name" value="'+(item?item.name:"")+'" required></label><label>السعر<input name="price" type="number" step=".01" value="'+(item?item.price:"")+'" required></label><label>القسم<select name="category_id">'+opts+'</select></label><label>صورة المنتج<input name="image" type="file" accept="image/jpeg,image/png,image/webp,image/gif"><small style="color:var(--muted);display:block;margin-top:6px">رفع مباشر · JPG / PNG / WEBP / GIF · حتى 5MB</small>'+(currentImage?'<img id="productImagePreview" src="'+currentImage+'" style="width:100px;height:100px;object-fit:cover;border-radius:12px;margin-top:10px;border:1px solid var(--line)">':'<img id="productImagePreview" class="hidden" style="width:100px;height:100px;object-fit:cover;border-radius:12px;margin-top:10px;border:1px solid var(--line)">')+'</label><label>الوصف<input name="description" value="'+(item&&item.description||"")+'"></label><div><button class="primary-btn">'+(item?"حفظ التعديلات":"حفظ المنتج")+'</button> <button type="button" class="secondary-btn" id="cancelProduct">إلغاء</button></div></form></div>';
  $("#cancelProduct").onclick=products;
  const imageInput=document.querySelector('#pf input[name="image"]'), preview=$("#productImagePreview");
  imageInput.onchange=()=>{const file=imageInput.files&&imageInput.files[0];if(!file)return;if(file.size>5242880){imageInput.value="";return toast("حجم الصورة يجب ألا يتجاوز 5 ميجابايت");}if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)){imageInput.value="";return toast("نوع الصورة غير مدعوم");}preview.src=URL.createObjectURL(file);preview.classList.remove("hidden")};
  $("#pf").onsubmit=async e=>{
    e.preventDefault();
    const f=new FormData(e.target),id=item?.id||crypto.randomUUID();
    const data={name:f.get("name"),price:Number(f.get("price")),category_id:f.get("category_id")||null,description:f.get("description")||null};
    const file=imageInput.files&&imageInput.files[0];
    let imageUrl=item?.image_url||null;
    if(file){
      const base64=await new Promise((resolve,reject)=>{const rd=new FileReader();rd.onload=()=>resolve(rd.result);rd.onerror=reject;rd.readAsDataURL(file)});
      const up=await gateway({action:"upload_product_image",data:{productId:id,base64,contentType:file.type}});
      if(up.error)return toast("تعذر رفع الصورة: "+up.error.message);
      imageUrl=up.data?.publicUrl||null;
    }
    data.image_url=imageUrl;
    const r=item?await db.from("products").update({...data,updated_at:new Date().toISOString()}).eq("id",id):await db.from("products").insert({id,...data,active:true,notes_enabled:false});
    if(r.error)return toast("تعذر حفظ المنتج: "+r.error.message);
    toast(item?"تم تعديل المنتج":"تمت إضافة المنتج");products()
  };
}
async function categories(){const r=await db.from("categories").select("*").order("sort_order"),rows=r.data||[];$("#view").innerHTML='<div class="toolbar"><button class="primary-btn" id="newCat">+ إضافة قسم</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>القسم</th><th>الاسم الإنجليزي</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>'+rows.map(x=>"<tr><td>"+(x.icon||"•")+" "+x.name+"</td><td>"+(x.name_en||"—")+"</td><td>"+(x.active?"نشط":"مخفي")+'</td><td><button class="btn-small" data-edit-cat="'+x.id+'">تعديل</button></td></tr>').join("")+"</tbody></table></div>";$("#newCat").onclick=()=>categoryForm();document.querySelectorAll("[data-edit-cat]").forEach(b=>b.onclick=()=>categoryForm(rows.find(x=>x.id===b.dataset.editCat)))}
function categoryForm(item){$("#view").innerHTML='<div class="form-card"><div class="notice">'+(item?"تعديل بيانات القسم.":"إضافة قسم جديد.")+'</div><form id="cf" class="form-grid"><label>اسم القسم<input name="name" value="'+(item?item.name:"")+'" required></label><label>الاسم الإنجليزي<input name="name_en" value="'+(item&&item.name_en||"")+'"></label><label>الأيقونة<input name="icon" value="'+(item&&item.icon||"")+'"></label><div><button class="primary-btn">'+(item?"حفظ التعديلات":"حفظ القسم")+'</button> <button type="button" class="secondary-btn" id="cancelCat">إلغاء</button></div></form></div>';$("#cancelCat").onclick=categories;$("#cf").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),data={name:f.get("name"),name_en:f.get("name_en")||null,icon:f.get("icon")||null};const r=item?await db.from("categories").update(data).eq("id",item.id):await db.from("categories").insert({...data,active:true});if(r.error)return toast("تعذر حفظ القسم: "+r.error.message);toast(item?"تم تعديل القسم":"تمت إضافة القسم");categories()}}
async function tables(){const r=await db.from("cafe_tables").select("*").order("table_number",{ascending:true}),rows=(r.data||[]).slice().sort((a,b)=>{const an=Number(a.table_number),bn=Number(b.table_number);return Number.isFinite(an)&&Number.isFinite(bn)?an-bn:String(a.table_number||"").localeCompare(String(b.table_number||""),"ar",{numeric:true})}),active=rows.filter(x=>x.active).length;let html='<div class="stats"><div class="stat"><small>إجمالي الطاولات</small><b>'+rows.length+'</b></div><div class="stat"><small>الطاولات النشطة</small><b>'+active+'</b></div></div><div class="toolbar"><button class="primary-btn" id="addTable">+ إضافة طاولة</button></div><div class="table-wrap"><table class="data-table"><thead><tr><th>رقم الطاولة</th><th>الحالة</th><th></th></tr></thead><tbody>'+rows.map(x=>'<tr><td>طاولة '+x.table_number+"</td><td>"+(x.active?"نشطة":"موقوفة")+'</td><td><button class="btn-small" data-table-toggle="'+x.id+'" data-active="'+x.active+'">'+(x.active?"إيقاف":"تفعيل")+"</button></td></tr>").join("")+"</tbody></table></div>";$("#view").innerHTML=html;$("#addTable").onclick=async()=>{const number=prompt("رقم الطاولة:");if(!number)return;const r=await db.from("cafe_tables").insert({table_number:String(number),active:true});if(r.error)toast("رقم الطاولة موجود بالفعل أو غير صالح");else tables()};document.querySelectorAll("[data-table-toggle]").forEach(b=>b.onclick=async()=>{const r=await db.from("cafe_tables").update({active:b.dataset.active!=="true"}).eq("id",b.dataset.tableToggle);if(r.error)toast("تعذر تغيير حالة الطاولة");else tables()})}
async function settingsView(){if(!settings){const r=await db.from("cafe_settings").select("*").limit(1).maybeSingle();settings=r.data}if(!settings)return $("#view").innerHTML='<div class="notice">تعذر تحميل الإعدادات.</div>';$("#view").innerHTML='<div class="form-card"><h3>إعدادات الفاتورة</h3><form id="sf" class="form-grid"><label>اسم الكافيه<input name="cafe_name" value="'+(settings.cafe_name||"A&S Café")+'"></label><label>العملة<input name="currency" value="'+(settings.currency||"EGP")+'"></label><label>الضريبة %<input name="tax_percent" type="number" step=".01" value="'+settings.tax_percent+'"></label><label>الخدمة %<input name="service_percent" type="number" step=".01" value="'+settings.service_percent+'"></label><div><button class="primary-btn">حفظ</button></div></form></div>';$("#sf").onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),r=await db.from("cafe_settings").update({cafe_name:f.get("cafe_name"),currency:f.get("currency"),tax_percent:Number(f.get("tax_percent")),service_percent:Number(f.get("service_percent")),updated_at:new Date().toISOString()}).eq("id",settings.id);if(r.error)toast("تعذر الحفظ: "+r.error.message);else{toast("تم حفظ الإعدادات");settings={...settings,cafe_name:f.get("cafe_name"),currency:f.get("currency"),tax_percent:Number(f.get("tax_percent")),service_percent:Number(f.get("service_percent"))}}}}
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll("[data-view]").forEach(b=>b.addEventListener("click",()=>{currentView=b.dataset.view;renderView()}));
  boot();
});
