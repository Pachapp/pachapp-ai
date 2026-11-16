// Pachapp Pool Villa - WhatsApp AI Agent - CLOUD BUILD (Render + Docker) - QR PAGE FIX
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const 【entity-express¦canonical_name=express】 = require('【entity-express¦canonical_name=express】');
const Airtable = require('airtable');
const PORT = process.env.PORT || 10000;
const OWNER_NUMBER = '918943666911';
const VILLA_NAME = 'Pachapp Pool Villa';
const VILLA_ADDRESS = 'Lucky Hill, Ooty Road, Meppadi, Wayanad, Kerala, India';
const WEBSITE = 'www.pachapp.green';
const MAPS_LINK = 'https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16';
const NEARBY_LINK = 'https://pachapp.green/here-around/';
const PRICING = { fullWeekday: 6400, fullWeekend: 8000, fullFestival: 9600, separate1: 1600, separate2: 3200, separate3: 4800, extraAdultFull: 800, extraAdultSepNoBF: 700, extraAdultSepWithBF: 800, breakfastSep: 100 };
const FESTIVALS = new Set(['2026-01-01','2026-01-02','2026-01-03','2026-03-03','2026-03-04','2026-03-26','2026-03-27','2026-04-14','2026-04-15','2026-05-01','2026-08-15','2026-08-28','2026-08-29','2026-08-30','2026-08-31','2026-09-01','2026-09-02','2026-10-02','2026-10-20','2026-10-21','2026-11-08','2026-11-09','2026-12-24','2026-12-25','2026-12-26','2026-12-27','2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
function isFestival(d){ return FESTIVALS.has(d.toISOString().slice(0,10)); }
function isWeekend(d){ const day=d.getDay(); return day===0||day===6; }
function getDateType(dateStr){ const d=parseDate(dateStr); if(!d) return 'weekday'; if(isFestival(d)) return 'festival'; if(isWeekend(d)) return 'weekend'; return 'weekday'; }
function parseDate(text){
  if(!text) return null; text=text.toLowerCase().trim();
  const months={jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
  let m; m=text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if(m) return new Date(parseInt(m[1]),parseInt(m[2])-1,parseInt(m[3]));
  m=text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/); if(m){ let y=parseInt(m[3]); if(y<100) y+=2000; return new Date(y,parseInt(m[2])-1,parseInt(m[1])); }
  m=text.match(/(\d{1,2})[\/\-](\d{1,2})\b/); if(m){ const now=new Date(); let y=now.getFullYear(); let d=new Date(y,parseInt(m[2])-1,parseInt(m[1])); if(d<now) d=new Date(y+1,parseInt(m[2])-1,parseInt(m[1])); return d; }
  m=text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)/); if(m && months[m[2]]!==undefined){ const now=new Date(); let y=now.getFullYear(); let d=new Date(y,months[m[2]],parseInt(m[1])); if(d<now) d=new Date(y+1,months[m[2]],parseInt(m[1])); return d; }
  m=text.match(/([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/); if(m && months[m[1]]!==undefined){ const now=new Date(); let y=now.getFullYear(); let d=new Date(y,months[m[1]],parseInt(m[2])); if(d<now) d=new Date(y+1,months[m[1]],parseInt(m[2])); return d; }
  if(text.includes('tomorrow')){ const d=new Date(); d.setDate(d.getDate()+1); return d; } if(text.includes('today')) return new Date(); return null;
}
function calcAdvance(total){ if(total<=1600) return 1600; if(total<=10000) return 2000; return Math.round(total*0.20); }
function formatPrice(n){ return 'Rs.'+n.toLocaleString('en-IN'); }
let airtableBase=null;
if(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID){ try{ airtableBase=new Airtable({apiKey:process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID); console.log('Airtable connected'); }catch(e){ console.log('Airtable init failed',e.message); } }
async function saveToAirtable(booking){
  if(!airtableBase) return false;
  try{ const existing=await airtableBase('Booking').select({filterByFormula:`AND({Date}='${booking.date}', {Phone}='${booking.phone}', {Name}='${booking.name}')`}).firstPage(); if(existing && existing.length>0) return true; await airtableBase('Booking').create([{fields:{Name:booking.name||'Guest',Phone:booking.phone||'',Date:booking.date||'',Guests:booking.guests||'',Rooms:booking.rooms||'Full Villa',Total:booking.total||0,Advance:booking.advance||0,Status:booking.status||'Pending Owner Verification',UTR:booking.utr||'',Source:'WhatsApp AI'}}]); return true; }catch(e){ console.log('Airtable save failed',e.message); return false; }
}
let groq=null; try{ const {Groq}=require('groq-sdk'); if(process.env.GROQ_API_KEY) groq=new Groq({apiKey:process.env.GROQ_API_KEY}); }catch(e){}
const SYSTEM_PROMPT=`You are Pachapp Pool Villa AI Host - humane, warm, creative, not a bot. Villa: ${VILLA_NAME}, ${VILLA_ADDRESS}, Website ${WEBSITE}, Maps ${MAPS_LINK}, Nearby ${NEARBY_LINK} Owners: Uday Hue, Reshma Uday, Sarwaswa Uday. Host is creative person with international credentials, original compositions. Talk literature, cinema, AI, philosophy, history when guest shows interest. Inspire about Wayanad. CRITICAL: 1. Answer REAL answer FIRST, then ask: which day? how many guests? what is exact interest in Wayanad? 2. NEVER give price without date. Always ask date first if no date given. NEVER say "let me check Indian Calendar", "personal/group", "routine", "internal pricing". 3. Reply in guest language, original script - Malayalam, Hindi, Tamil, Telugu, Kannada, English. If not understandable, say only "Please ask in ENGLISH". 4. For 【entity-WhatsApp¦canonical_name=WhatsApp】 GROUP AGENTS: short crispy 1-2 line replies only. Stories/amenities in 1 line. Close in 3-4 messages. NEVER send private reply in group. 5. For DIRECT guests: elaborated humane mode, with photos/videos between answers, inspire about Wayanad. PRICING FULL VILLA (PRIVATE): Weekday Rs.6400, Weekend Rs.8000, Festival Rs.9600, Includes 4 rooms, 8 adults + 8 kids below 6, Breakfast FREE. Extra adult Rs.800. Kids below 6 FREE. WEEKDAY SEPARATE (SHARED, Weekday Only): 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800, Each room 2 adults + 2 kids below 6, Extra adult Rs.700 without breakfast / Rs.800 with breakfast, Breakfast NOT FREE: Rs.100 only per head, MUST ask with/without breakfast. Weekend/Festival: Whole Villa ONLY. ADVANCE: 1 Room Rs.1600, Total up to Rs.10000 Rs.2000 minimum, Total over Rs.10000 20%, Balance before check-in, UPI/cash. Payment: screenshot + UTR, owner verifies, AI confirms ONLY after owner Yes. BOOKING: Airtable master, manual only, skip duplicate by date+phone+name, guests never see Airtable, only confirmation + QR. No 【entity-Airbnb¦canonical_name=Airbnb】 automation. Booking number +91 8943666911`;
async function askAI(userMsg,isGroup,chatHistory){
  if(!groq) return null;
  try{ const modeNote=isGroup?'MODE: WhatsApp GROUP AGENT - Reply in 1-2 lines only, crispy, close in 3-4 messages. No long text.':'MODE: DIRECT GUEST - Elaborated humane, warm, inspiring about Wayanad.'; const completion=await groq.chat.completions.create({model:'llama-3.3-70b-versatile',messages:[{role:'system',content:SYSTEM_PROMPT+'\n'+modeNote},...(chatHistory||[]).slice(-8),{role:'user',content:userMsg}],temperature:0.7,max_tokens:isGroup?120:600}); return completion.choices[0]?.message?.content||null; }catch(e){ console.log('Groq error',e.message); return null; }
}
function fallbackReply(text,isGroup){
  const lower=text.toLowerCase(); const hasDate=parseDate(text); const hasGuests=lower.match(/(\d+)\s*(people|adults|person|guest)/);
  if(lower.includes('pool')||lower.includes('swim')){ if(isGroup) return 'Yes, private pool, 4 rooms, full villa private. Which date? How many guests?'; return `Yes! Private pool just for you - no sharing. 🏊\n\nPachapp has a beautiful private pool with Wayanad hills view. Morning coffee by pool is magical.\n\nWhich date are you thinking? How many guests? What do you love in Wayanad - nature, food, music, peace?`; }
  if(lower.includes('story')||lower.includes('about')||lower.includes('pachapp')){ if(isGroup) return 'Pachapp - Lucky Hill, Meppadi, Wayanad. 4 rooms, private pool, host is artist. Which date?'; return `Pachapp is not a hotel, it's a home with a story. 🌿\n\nOn Lucky Hill, Meppadi, Wayanad - built with love by Uday, Reshma & Sarwaswa. Host is creative person, original music, literature, cinema, philosophy.\n\nWhich date? How many guests?`; }
  if(lower.includes('price')||lower.includes('rate')||lower.includes('cost')||lower.includes('charge')||hasGuests){ if(!hasDate){ if(isGroup) return 'Price depends on date - weekday / weekend / festival different. Which date? How many guests?'; return `Price depends on date, so I can give exact price. 😊\n\nFull Private Villa: Weekday Rs.6400, Weekend Rs.8000, Festival Rs.9600 (Breakfast FREE, 8 adults + 8 kids below 6 included)\nWeekday Separate: 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800\n\nWhich date are you planning? How many guests?`; } const type=getDateType(text); let price=type==='weekday'?PRICING.fullWeekday:type==='weekend'?PRICING.fullWeekend:PRICING.fullFestival; if(isGroup) return `${type} - Full Private Villa ${formatPrice(price)}, Breakfast FREE, 8+8 included. Confirm?`; return `For ${text} - ${type} - Full Private Villa ${formatPrice(price)} ✨\n\nPrivate whole villa, 4 rooms, private pool, Breakfast FREE, includes 8 adults + 8 kids below 6. Extra adult Rs.800.\n\nAdvance ${formatPrice(calcAdvance(price))}, balance before check-in.\n\nShall I hold this date for you? How many guests exactly?`; }
  if(isGroup) return 'Pachapp Pool Villa, Meppadi, Wayanad - Private villa, pool, 4 rooms. Which date? How many guests?';
  return `Welcome to Pachapp Pool Villa! 🌿🏊\n\nLucky Hill, Meppadi, Wayanad - private villa, private pool, 4 rooms, hills view.\n\nWhich date are you thinking? How many guests? What brings you to Wayanad - nature, family time, music, peace?`;
}
// ---------- HEALTH + QR PAGE ----------
let lastQR=null; let isReady=false;
const app=express();
app.get('/',(req,res)=>res.send('Pachapp AI Agent - Running ✅ - Open /qr to scan'));
app.get('/health',(req,res)=>res.json({status:'ok',villa:VILLA_NAME,ready:isReady}));
app.get('/qr',async(req,res)=>{
  if(isReady) return res.send('<h2 style="text-align:center;font-family:sans-serif">✅ Already Linked! Bot is Ready.<br>Send test message to bot number.</h2>');
  if(!lastQR) return res.send('<h2 style="text-align:center;font-family:sans-serif">Waiting for QR... Refresh this page in 10 seconds.</h2><script>setTimeout(()=>location.reload(),5000)</script>');
  try{
    const qrImage=await QRCode.toDataURL(lastQR,{width:450,margin:2});
    res.send(`<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>Pachapp QR</title></head><body style="display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#fff"><div style="text-align:center;font-family:sans-serif"><h2>Pachapp Pool Villa - Scan QR</h2><p>Use bot phone <b>0529100668</b> → 【entity-WhatsApp¦canonical_name=WhatsApp】 → Linked Devices → Link a Device</p><img src="${qrImage}" style="width:420px;height:420px;border:2px solid #000"/><p>QR refreshes every 20 sec - If expired, refresh this page</p><p><a href="/qr">Refresh QR</a></p></div><script>setTimeout(()=>location.reload(),20000)</script></body></html>`);
  }catch(e){ res.send('QR error, refresh'); }
});
app.listen(PORT,()=>console.log(`Health server on ${PORT}`));
const client=new Client({ authStrategy:new LocalAuth({dataPath:'./.wwebjs_auth'}), puppeteer:{ headless:true, executablePath:process.env.PUPPETEER_EXECUTABLE_PATH||undefined, args:['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-accelerated-2d-canvas','--no-first-run','--no-zygote','--single-process','--disable-gpu'] } });
const chatHistories=new Map(); const pendingBookings=new Map();
client.on('qr',(qr)=>{ lastQR=qr; isReady=false; console.log('QR RECEIVED - Open /qr page to scan - Scan with bot 0529100668'); qrcode.generate(qr,{small:true}); });
client.on('ready',()=>{ isReady=true; lastQR=null; console.log('Pachapp AI Agent Ready - CLOUD BUILD'); });
client.on('auth_failure',(msg)=>console.log('Auth failure',msg));
client.on('disconnected',(reason)=>{ isReady=false; console.log('Disconnected',reason); });
client.on('message',async(msg)=>{
  try{
    if(msg.from==='status@broadcast') return;
    const chat=await msg.getChat(); const isGroup=chat.isGroup; const contact=await msg.getContact(); const senderNumber=contact.number||msg.from.replace('@c.us',''); const senderName=contact.pushname||contact.name||'Guest'; const text=msg.body||''; const lower=text.toLowerCase();
    console.log(`[${isGroup?'GROUP':'DIRECT'}] ${senderName} (${senderNumber}): ${text.slice(0,120)}`);
    if(senderNumber===OWNER_NUMBER && (lower.trim()==='yes'||lower.trim()==='no'||lower.includes('confirm')||lower.includes('verified'))){
      let targetPhone=null,targetBooking=null; for(const [phone,b] of pendingBookings){ targetPhone=phone; targetBooking=b; }
      if(targetBooking){ if(lower.trim()==='yes'||lower.includes('confirm')||lower.includes('verified')){ targetBooking.status='Confirmed'; await saveToAirtable(targetBooking); try{ await client.sendMessage(targetBooking.chatId,`✅ Booking CONFIRMED - Pachapp Pool Villa! 🎉\n\nDate: ${targetBooking.date}\nGuests: ${targetBooking.guests}\nTotal: ${formatPrice(targetBooking.total)}\nAdvance: ${formatPrice(targetBooking.advance)} received\nBalance before check-in.\n\nMaps: ${MAPS_LINK}\nNearby: ${NEARBY_LINK}\n\nWelcome to Pachapp! 🌿 See you in Wayanad.`); }catch(e){} await msg.reply(`Confirmed to guest ${targetBooking.name}. Airtable updated.`); pendingBookings.delete(targetPhone); } else { await msg.reply('Not confirmed. Guest will be told payment not verified.'); } return; }
    }
    const hasMedia=msg.hasMedia; const hasUTR=lower.match(/utr|transaction|ref.*\d{6,}|txn/i)||lower.match(/\b\d{10,18}\b/);
    if((hasMedia && (hasUTR||lower.includes('paid')||lower.includes('payment')||lower.includes('advance')))||(hasUTR && lower.includes('paid'))){
      const utrMatch=text.match(/\b\d{10,18}\b/); const utr=utrMatch?utrMatch[0]:'Screenshot received';
      const pending={name:senderName,phone:senderNumber,chatId:msg.from,date:pendingBookings.get(senderNumber)?.date||'To confirm',guests:pendingBookings.get(senderNumber)?.guests||'',total:pendingBookings.get(senderNumber)?.total||0,advance:pendingBookings.get(senderNumber)?.advance||0,utr:utr,status:'Pending Owner Verification'};
      pendingBookings.set(senderNumber,pending);
      try{ await client.sendMessage(OWNER_NUMBER+'@c.us',`🔔 PAYMENT VERIFICATION NEEDED\nGuest: ${senderName} (${senderNumber})\nDate: ${pending.date}\nUTR: ${utr}\nAdvance: ${formatPrice(pending.advance)}\n\nReply YES to confirm, NO to reject.`); if(hasMedia){ try{ const media=await msg.downloadMedia(); await client.sendMessage(OWNER_NUMBER+'@c.us',media,{caption:`Payment screenshot from ${senderName} - UTR ${utr}`}); }catch(e){} } }catch(e){}
      await msg.reply(`Payment screenshot + UTR ${utr} received. ✅\n\nOwner will verify and I will confirm your booking in a moment. Please wait.`); return;
    }
    if(!chatHistories.has(msg.from)) chatHistories.set(msg.from,[]); const history=chatHistories.get(msg.from); history.push({role:'user',content:text});
    let reply=await askAI(text,isGroup,history); if(!reply) reply=fallbackReply(text,isGroup);
    history.push({role:'assistant',content:reply}); if(history.length>16) chatHistories.set(msg.from,history.slice(-16));
    const parsedDate=parseDate(text); if(parsedDate){ const type=getDateType(text); const price=type==='weekday'?PRICING.fullWeekday:type==='weekend'?PRICING.fullWeekend:PRICING.fullFestival; pendingBookings.set(senderNumber,{name:senderName,phone:senderNumber,chatId:msg.from,date:parsedDate.toISOString().slice(0,10),guests:text,total:price,advance:calcAdvance(price),status:'Enquiry'}); }
    await msg.reply(reply);
    if(!isGroup && (lower.includes('photo')||lower.includes('video')||lower.includes('pics'))){ await client.sendMessage(msg.from,`Photos & videos here: ${WEBSITE} 📸\nMaps: ${MAPS_LINK}`); }
  }catch(e){ console.log('Message handler error',e.message); }
});
client.initialize();
