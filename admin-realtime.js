if(window.db&&typeof db.channel==="function"){
const orderChannel=db.channel("aands-live-orders").on("postgres_changes",{event:"*",schema:"public",table:"orders"},function(){if(typeof currentView!=="undefined"&&currentView==="orders"&&typeof orders==="function")orders()}).subscribe();
}