const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 10000;
const OWNER_NUMBER = '918943666911';
const BOT_PHONE = '971529100668';
const VILLA_NAME = 'Pachapp Pool Villa';
const MAPS_LINK = 'https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16';
const NEARBY_LINK = 'https://pachapp.green/here-around/';

// FORM_URL auto-builds from Render URL - never hardcode copy-paste
function getFormUrl(){
  let base = process.env.RENDER_EXTERNAL_URL || 'https://pachapp-ai-1.onrender.com';
  base = base.replace(/\/$/, '');
  return base + '/booking-form.html';
}

const PRICING = { fullWeekday: 6400, fullWeekend: 8000, fullFestival: 9600 };
const FESTIVALS = new Set(['2026-01-01','2026-01-02','2026-12-24','2026-12-25','2026-12-26','2026-12-27','2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2026-08-28','2026-08-29','2026-08-30','2026-08-31','2026-09-01','2026-10-02','2026-10-20','2026-10-21','2026-04-14','2026-05-01','2026-08-15']);
function isFestival(d){ return FESTIVALS.has(d.toISOString().slice(0,10)); }
function isWeekend(d){ const day=d.getDay(); return day===5||day===6||day===0; }
function getDateType(text){ const d=parseDate(text); if(!d) return 'weekday'; if(isFestival(d)) return 'festival'; if(isWeekend(d)) return 'weekend'; return 'weekday'; }
function parseDate(text){
  if(!text) return null; text=text.toLowerCase().trim();
  const months={jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
  let m;
  m=text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if(m) return new Date(parseInt(m[1]),parseInt(m[2])-1,parseInt(m[3]));
  m=text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/); if(m){let y=parseInt(m[3]); if(y<100) y+=2000; return new Date(y,parseInt(m[2])-1,parseInt(m[1]));}
  m=text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)/); if(m&&months[m[2]]!==undefined){const now=new Date();let y=now.getFullYear();let d=new Date(y,months[m[2]],parseInt(m[1])); if(d<now) d=new Date(y+1,months[m[2]],parseInt(m[1])); return d;}
  m=text.match(/([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/); if(m&&months[m[1]]!==undefined){const now=new Date();let y=now.getFullYear();let d=new Date(y,months[m[1]],parseInt(m[2])); if(d<now) d=new Date(y+1,months[m[1]],parseInt(m[2])); return d;}
  if(text.includes('tomorrow')){const d=new Date();d.setDate(d.getDate()+1);return d;}
  if(text.includes('today')) return new Date();
  return null;
}
function calcAdvance(total){ if(total<=1600) return 1600; if(total<=10000) return 2000; return Math.round(total*0.20); }
function formatPrice(n){ return 'Rs.'+n.toLocaleString('en-IN'); }

const SYSTEM_PROMPT = `You are Pachapp Pool Villa AI Host - humane, warm, creative, not a bot. Villa: Pachapp Pool Villa, Lucky Hill, Ooty Road, Meppadi, Wayanad, Kerala, Website www.pachapp.green, Maps ${MAPS_LINK}. Owners Uday Hue, Reshma Uday, Sarwaswa Uday. RULES: 1. Answer REAL answer FIRST, then ask which day, how many guests, exact interest in Wayanad. 2. NEVER give price without date. NEVER say let me check Indian Calendar, personal/group, routine, internal pricing. 3. Reply in guest language, original script Malayalam, Hindi, Tamil, Telugu, Kannada, English. If not understandable, say only Please ask in ENGLISH. 4. For DIRECT guests: elaborated humane, photos/videos between answers. PRICING FULL VILLA PRIVATE: Weekday Rs.6400, Weekend Fri/Sat/Sun Rs.8000, Festival Rs.9600, Includes 4 rooms, 8 adults + 8 kids below 6, Breakfast FREE. Extra adult Rs.800. Kids below 6 FREE. WEEKDAY SEPARATE SHARED Weekday Only: 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800, Each room 2 adults + 2 kids below 6, Extra adult Rs.800 with breakfast, Breakfast NOT FREE Rs.100 only per head, MUST ask with/without breakfast. Weekend/Festival Whole Villa ONLY. ADVANCE: 1 Room Rs.1600, Total up to Rs.10000 Rs.2000 minimum, Total over Rs.10000 20%, Balance before check-in, UPI/cash. Payment screenshot + UTR, owner verifies, AI confirms ONLY after owner Yes. BOOKING: When guest asks for booking form, booking, book, form - send the booking form link only, no fake table form. Booking +91 8943666911`;

let chatHistories = new Map();
let pendingBookings = new Map();

async function askAI(userMsg, history){
  const key = process.env.GROQ_API_KEY;
  if(!key) return null;
  try{
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',
      headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},
      body: JSON.stringify({model:'openai/gpt-oss-20b',messages:[{role:'system',content:SYSTEM_PROMPT},...(history||[]).slice(-8),{role:'user',content:userMsg}],temperature:0.7,max_tokens:600})
    });
    const data = await res.json();
    return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content ? data.choices[0].message.content : null;
  }catch(e){ console.log('Groq error '+e.message); return null; }
}
function fallbackReply(text){
  const l=text.toLowerCase();
  if(l.includes('price')||l.includes('rate')||l.includes('cost')) return 'Please tell me which day you want to come, and how many guests? I will give you exact price for that day. 🌿';
  if(l.includes('booking')||l.includes('book')||l.includes('form')) return 'Here is our booking form - please fill it:\n'+getFormUrl();
  if(l.includes('photo')||l.includes('pics')||l.includes('video')) return 'Photos & videos here: www.pachapp.green 📸\nMaps: '+MAPS_LINK;
  if(l.includes('location')||l.includes('where')||l.includes('address')) return 'Pachapp Pool Villa, Lucky Hill, Ooty Road, Meppadi, Wayanad, Kerala\nMaps: '+MAPS_LINK;
  return 'Welcome to Pachapp Pool Villa! 🌿\nPlease tell me which day, how many guests, and what you want to enjoy in Wayanad?';
}
async function sendWhatsApp(to, text){
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if(!token||!phoneId){ console.log('No WhatsApp token/phoneId - cannot send'); return false; }
  try{
    const res = await fetch('https://graph.facebook.com/v21.0/'+phoneId+'/messages',{
      method:'POST',
      headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
      body: JSON.stringify({messaging_product:'whatsapp',to:to,type:'text',text:{preview_url:true,body:text}})
    });
    console.log('Send to '+to+' status '+res.status);
    return res.ok;
  }catch(e){ console.log('Send failed '+e.message); return false; }
}
async function handleDirect(from, senderName, text){
  const lower=text.toLowerCase();
  // Owner YES/NO confirm
  if(from===OWNER_NUMBER && (lower.trim()==='yes'||lower.trim()==='no'||lower.includes('confirm')||lower.includes('verified'))){
    let targetPhone=null,targetBooking=null;
    for(const [phone,b] of pendingBookings){ targetPhone=phone; targetBooking=b; }
    if(targetBooking){
      if(lower.trim()==='yes'||lower.includes('confirm')||lower.includes('verified')){
        targetBooking.status='Confirmed';
        await sendWhatsApp(targetBooking.phone,'Booking CONFIRMED - Pachapp Pool Villa! 🎉\n\nDate: '+targetBooking.date+'\nGuests: '+targetBooking.guests+'\nTotal: '+formatPrice(targetBooking.total)+'\nAdvance: '+formatPrice(targetBooking.advance)+' received\nBalance before check-in.\n\nMaps: '+MAPS_LINK+'\nNearby: '+NEARBY_LINK+'\n\nWelcome to Pachapp! 🌿');
        await sendWhatsApp(from,'Confirmed to guest '+targetBooking.name);
        pendingBookings.delete(targetPhone);
      } else { await sendWhatsApp(from,'Not confirmed.'); }
      return;
    }
  }
  // Payment screenshot + UTR - text with UTR
  const hasUTR = lower.match(/utr|transaction|ref/i) || lower.match(/\b\d{10,18}\b/);
  if(hasUTR && (lower.includes('paid')||lower.includes('payment')||lower.includes('advance'))){
    const m=text.match(/\b\d{10,18}\b/);
    const utr=m?m[0]:'Screenshot received';
    const pending={name:senderName,phone:from,date:pendingBookings.get(from)?.date||'To confirm',guests:pendingBookings.get(from)?.guests||'',total:pendingBookings.get(from)?.total||0,advance:pendingBookings.get(from)?.advance||0,utr:utr,status:'Pending'};
    pendingBookings.set(from,pending);
    await sendWhatsApp(OWNER_NUMBER,'PAYMENT VERIFICATION NEEDED\nGuest: '+senderName+' ('+from+')\nDate: '+pending.date+'\nUTR: '+utr+'\nAdvance: '+formatPrice(pending.advance)+'\n\nReply YES to confirm, NO to reject.');
    await sendWhatsApp(from,'Payment screenshot + UTR '+utr+' received. ✅\n\nOwner will verify and I will confirm your booking in a moment.');
    return;
  }
  // Booking form request - send Render link only
  if(lower.includes('booking form')||lower.includes('booking')||lower.includes('book')||lower.includes('form')){
    await sendWhatsApp(from,'Here is our booking form - please fill it:\n'+getFormUrl()+'\n\nAfter filling, send payment screenshot + UTR here. Owner will verify.');
    return;
  }
  if(!chatHistories.has(from)) chatHistories.set(from,[]);
  const history=chatHistories.get(from);
  history.push({role:'user',content:text});
  let reply=await askAI(text,history);
  if(!reply) reply=fallbackReply(text);
  history.push({role:'assistant',content:reply});
  if(history.length>16) chatHistories.set(from,history.slice(-16));
  const parsedDate=parseDate(text);
  if(parsedDate){
    const type=getDateType(text);
    const price=type==='weekday'?PRICING.fullWeekday:type==='weekend'?PRICING.fullWeekend:PRICING.fullFestival;
    pendingBookings.set(from,{name:senderName,phone:from,date:parsedDate.toISOString().slice(0,10),guests:text,total:price,advance:calcAdvance(price),status:'Enquiry'});
  }
  await sendWhatsApp(from,reply);
  if(lower.includes('photo')||lower.includes('video')||lower.includes('pics')){
    await sendWhatsApp(from,'Photos & videos here: www.pachapp.green 📸\nMaps: '+MAPS_LINK);
  }
}

const server=http.createServer(async (req,res)=>{
  try{
    const u=new URL(req.url,'http://localhost');
    if(req.method==='GET' && u.pathname==='/health'){
      res.writeHead(200,{'Content-Type':'application/json'});
      res.end(JSON.stringify({status:'ok',api:'Meta Cloud API',has_token:!!process.env.WHATSAPP_TOKEN,has_phone_id:!!process.env.WHATSAPP_PHONE_NUMBER_ID,form_url:getFormUrl()}));
      return;
    }
    if(req.method==='GET' && u.pathname==='/webhook'){
      const mode=u.searchParams.get('hub.mode');
      const token=u.searchParams.get('hub.verify_token');
      const challenge=u.searchParams.get('hub.challenge');
      if(mode==='subscribe' && token===process.env.WHATSAPP_VERIFY_TOKEN){ res.writeHead(200,{'Content-Type':'text/plain'}); res.end(challenge||''); return; }
      res.writeHead(403); res.end('Forbidden'); return;
    }
    if(req.method==='POST' && u.pathname==='/webhook'){
      let body=''; req.on('data',c=>body+=c); req.on('end',async ()=>{
        try{
          const data=JSON.parse(body||'{}');
          const entry=data.entry && data.entry[0];
          const change=entry && entry.changes && entry.changes[0];
          const value=change && change.value;
          const messages=value && value.messages;
          if(messages && messages.length){
            for(const msg of messages){
              const from=msg.from||'';
              // GROUP SILENCE - never reply in groups
              const isGroup = msg.context && msg.context.group_id ? true : false;
              const recipientType = value.messaging_product;
              if(isGroup){ console.log('Group message - silent, no reply'); continue; }
              if(msg.type!=='text' && msg.type!=='image') continue;
              const text=msg.type==='text' ? (msg.text && msg.text.body ? msg.text.body : '') : (msg.caption||'');
              if(!text) continue;
              const senderName=(value.contacts && value.contacts[0] && value.contacts[0].profile && value.contacts[0].profile.name) || 'Guest';
              console.log('Direct message from '+from+' : '+text.slice(0,200));
              await handleDirect(from,senderName,text);
            }
          }
        }catch(e){ console.log('webhook handle '+e.message); }
        res.writeHead(200); res.end('EVENT_RECEIVED');
      });
      return;
    }
    // Serve booking form + images from same Render service
    if(req.method==='GET' && (u.pathname==='/'||u.pathname==='/booking-form.html')){
      const f=path.join(__dirname,'booking-form.html');
      if(fs.existsSync(f)){ res.writeHead(200,{'Content-Type':'text/html'}); res.end(fs.readFileSync(f)); return; }
      res.writeHead(404); res.end('booking-form.html not found'); return;
    }
    if(req.method==='GET' && u.pathname==='/qr.png'){
      const f=path.join(__dirname,'qr.png');
      if(fs.existsSync(f)){ res.writeHead(200,{'Content-Type':'image/png'}); res.end(fs.readFileSync(f)); return; }
      res.writeHead(404); res.end('not found'); return;
    }
    if(req.method==='GET' && u.pathname==='/Pachapp_1.png'){
      const f=path.join(__dirname,'Pachapp_1.png');
      if(fs.existsSync(f)){ res.writeHead(200,{'Content-Type':'image/png'}); res.end(fs.readFileSync(f)); return; }
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(404); res.end('Not found');
  }catch(e){ res.writeHead(500); res.end('Error '+e.message); }
});
server.listen(PORT,()=>{ console.log('Pachapp AI - Meta Cloud API - LIVE on '+PORT+' - No Baileys - Form: '+getFormUrl()); });
