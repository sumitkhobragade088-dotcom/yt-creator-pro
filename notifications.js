import { supabase } from "./supabase.js";

const ADMIN_EMAIL="sumitkhobragade088@gmail.com";
const wrap=document.querySelector("[data-notification-role]");
if(wrap){
  const role=wrap.dataset.notificationRole;
  const bell=wrap.querySelector(".yt-notification-bell");
  const count=wrap.querySelector(".yt-notification-count");
  const panel=wrap.querySelector(".yt-notification-panel");
  const list=wrap.querySelector(".yt-notification-list");
  const readAll=wrap.querySelector("[data-notification-read-all]");
  let customerId=null, channel=null;

  const esc=(v="")=>String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
  const when=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?"":d.toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"});};

  async function identity(){
    const {data}=await supabase.auth.getSession();
    const user=data?.session?.user;
    if(!user) return false;
    if(role==="admin") return String(user.email||"").toLowerCase()===ADMIN_EMAIL;
    const res=await supabase.from("customers").select("id").eq("user_id",user.id).maybeSingle();
    customerId=res.data?.id||null;
    return !!customerId;
  }

  function query(){
    let q=supabase.from("notifications").select("id,title,message,kind,is_read,created_at").order("created_at",{ascending:false}).limit(50);
    return role==="admin" ? q.eq("recipient_type","admin") : q.eq("recipient_type","user").eq("customer_id",customerId);
  }

  async function load(){
    const {data,error}=await query();
    if(error){console.error("Notifications",error);list.textContent="Notifications unavailable.";return;}
    let rows=data||[];
    if(role==="user"&&customerId){
      const {data:pref}=await supabase.from("user_notification_preferences").select("request_updates,payment_updates,support_updates,announcements").eq("customer_id",customerId).maybeSingle();
      if(pref) rows=rows.filter(x=>{
        const k=String(x.kind||"info");
        if(k==="request")return pref.request_updates!==false;
        if(k==="payment")return pref.payment_updates!==false;
        if(k==="support")return pref.support_updates!==false;
        if(k==="announcement")return pref.announcements!==false;
        return true;
      });
    }
    const unread=rows.filter(x=>!x.is_read).length;
    count.textContent=String(unread); count.hidden=unread===0;
    list.innerHTML=rows.length?rows.map(n=>`<button type="button" class="yt-notification-item${n.is_read?"":" unread"}" data-notification-id="${esc(n.id)}"><b>${esc(n.title)}</b><span>${esc(n.message||"")}</span><small>${esc(when(n.created_at))}</small></button>`).join(""):'<div class="yt-notification-empty">No notifications yet.</div>';
    list.querySelectorAll("[data-notification-id]").forEach(btn=>btn.addEventListener("click",async()=>{
      await supabase.from("notifications").update({is_read:true}).eq("id",btn.dataset.notificationId);
      load();
    }));
  }

  async function markAll(){
    let q=supabase.from("notifications").update({is_read:true}).eq("recipient_type",role==="admin"?"admin":"user").eq("is_read",false);
    if(role==="user") q=q.eq("customer_id",customerId);
    await q; load();
  }

  async function init(){
    if(!(await identity())) return;
    bell.addEventListener("click",e=>{e.stopPropagation();panel.hidden=!panel.hidden;if(!panel.hidden)load();});
    panel.addEventListener("click",e=>e.stopPropagation());
    document.addEventListener("click",()=>panel.hidden=true);
    readAll.addEventListener("click",markAll);
    await load();

    const filter=role==="admin"?"recipient_type=eq.admin":`customer_id=eq.${customerId}`;
    channel=supabase.channel(`notifications-${role}-${customerId||"admin"}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter},()=>load())
      .subscribe();
  }
  init();
}
