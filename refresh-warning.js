(function(){
  function hasTrackedOrders(){
    try{
      const x=JSON.parse(localStorage.getItem("as_cafe_order_tokens")||"[]");
      return Array.isArray(x)&&x.length>0;
    }catch(e){return false}
  }
  window.addEventListener("beforeunload",function(e){
    if(!hasTrackedOrders())return;
    e.preventDefault();
    e.returnValue="طلباتك لن تُلغى، لكن تحديث الصفحة سيخفيها من خانة طلباتي ولن تقدر تتابعها من الجهاز ده.";
  });
  window.addEventListener("pagehide",function(){
    if(!hasTrackedOrders())return;
    try{localStorage.removeItem("as_cafe_order_tokens")}catch(e){}
  });
})();