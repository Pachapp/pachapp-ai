// Pachapp Pool Villa — WhatsApp Cloud API Bot
// SYNCED 100% WITH booking-form.html — DO NOT CHANGE PRICING HERE ALONE. Change BOTH files together.
// Cloud API only. No Baileys, No QR, No Chrome.
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
const PORT = process.env.PORT || 10000;

// ===== CONFIG =====
const OWNER_NUMBER = '918943666911';
const BOT_PHONE = '971529100668';
const VILLA_NAME = 'Pachapp Pool Villa';
const WEBSITE = 'www.pachapp.green';
const MAPS_LINK = 'https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16';
const NEARBY_LINK = 'https://pachapp.green/here-around/';
const FORM_URL = process.env.FORM_URL || 'https://pachapp.green/booking-form.html';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || '';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'pachapp-verify-123';

// ===== PRICING — EXACT COPY FROM booking-form.html =====
// Weekday Mon-Fri 6400 (Weekend -20%) | Weekend Sat-Sun 8000 | Festival & Holiday 9600 (Weekend +20%) | Rooms 1600 flat
// Friday = Weekday. Every night checked separately.
const FESTIVALS = new Set([
  '2026-01-01','2026-01-14','2026-01-15','2026-02-15','2026-03-04','2026-03-19','2026-03-20','2026-03-26','2026-03-31','2026-04-03','2026-04-05','2026-04-14','2026-04-19','2026-04-29','2026-05-27','2026-05-31','2026-06-26','2026-08-26','2026-08-28','2026-08-29','2026-08-30','2026-08-31','2026-09-01','2026-09-04','2026-09-14','2026-10-11','2026-10-20','2026-11-08','2026-11-09','2026-11-24','2026-12-24','2026-12-25','2026-12-26','2026-12-27','2026-12-28','2026-12-29','2026-12-30','2026-12-31',
  '2027-01-01','2027-01-14','2027-01-15','2027-02-06','2027-03-22','2027-03-27','2027-04-14','2027-04-18','2027-05-01','2027-05-16','2027-06-16','2027-08-15','2027-08-20','2027-08-21','2027-08-22','2027-09-24','2027-10-09','2027-10-29','2027-10-30','2027-11-13','2027-12-24','2027-12-25','2027-12-26','2027-12-27','2027-12-28','2027-12-29','2027-12-30','2027-12-31'
]);
const HOLIDAYS = new Set([
  '2026-01-26','2026-05-01','2026-08-15','2026-10-02','2026-04-03','2026-04-14','2026-03-20','2026-05-27','2026-06-26','2026-08-26','2026-11-24','2026-12-25',
  '2027-01-26','2027-05-01','2027-08-15','2027-10-02','2027-03-22','2027-05-16','2027-06-16','2027-11-13','2027-12-25'
]);

function fmt(n){ return 'Rs.' + Number(n).toLocaleString('en-IN'); }
function getDayType(s){
  if(!s) return 'Weekday';
  if(FESTIVALS.has(s)) return 'Festival';
  if(HOLIDAYS.has(s)) return 'Holiday';
  const d = new Date(s + 'T12:00:00');
  const day = d.getDay();
  if(day===6 || day===0) return 'Weekend'; // Sat + Sun ONLY
  return 'Weekday'; // Mon-Fri, Fri = Weekday
}
function rateFor(s){
  const t = getDayType(s);
  if(t==='Festival' || t==='Holiday') return 9600;
  if(t==='Weekend') return 8000;
  return 6400;
}
function dateStrPlus(checkIn, add){
  const d = new Date(checkIn + 'T12:00:00'); d.setDate(d.getDate()+add);
  return d.toISOString().slice(0,10);
}
function calcFullVillaBase(checkIn, nights){
  if(!checkIn) return { base: 6400*nights, breakdown: 'Weekday' };
  let base=0; const counts={Weekday:0,Weekend:0,Holiday:0,Festival:0};
  for(let i=0;i<nights;i++){
    const s=dateStrPlus(checkIn,i), t=getDayType(s);
    counts[t]++; base+=rateFor(s);
  }
  const parts=[];
  if(counts.Weekday) parts.push(counts.Weekday+' Weekday');
  if(counts.Weekend) parts.push(counts.Weekend+' Weekend');
  if(counts.Holiday) parts.push(counts.Holiday+' Holiday');
  if(counts.Festival) parts.push(counts.Festival+' Festival');
  return { base, breakdown: parts.join(' + ') };
}
function getAutoRooms(a){ return Math.max(1, Math.min(4, Math.ceil(a/2))); }
function calcAdvance(total, bookingType, rooms, nights, adults){
  if(bookingType!=='Full Villa' && rooms===1 && nights===1 && adults<=2) return 1600;
  if(total<=10000) return 2000;
  return Math.round(total*0.20);
}
// SAME AS FORM: Total = Base + Extra + Kids + Breakfast
function calcTotal({bookingType='Full Villa', checkIn='', nights=1, adults=2, rooms=null, kidsFree=0, kidsHalf=0, breakfast='Yes'}){
  let autoRooms = getAutoRooms(adults);
  if(bookingType==='Full Villa') rooms=4;
  else if(rooms===null || rooms===undefined) rooms=autoRooms;
  rooms=Math.max(1, Math.min(4, rooms));
  let base=0, baseLabel='';
  if(bookingType==='Full Villa'){
    const r=calcFullVillaBase(checkIn, nights);
    base=r.base; baseLabel='Full Villa ('+r.breakdown+')';
  } else {
    base=1600*rooms*nights; baseLabel=rooms+' Room(s) x Rs.1600';
  }
  const capacity = bookingType==='Full Villa' ? 8 : rooms*2;
  const extraAdults = Math.max(0, adults-capacity);
  const extraTotal = extraAdults*800*nights;
  const kidsTotal = kidsHalf*300*nights;
  const breakfastCount = adults + kidsHalf;
  let breakfastTotal=0;
  if(breakfast==='Yes') breakfastTotal = bookingType==='Full Villa' ? 0 : breakfastCount*100*nights;
  const total = base+extraTotal+kidsTotal+breakfastTotal;
  const advance = calcAdvance(total, bookingType, rooms, nights, adults);
  const overCapacity = bookingType==='Rooms' ? (rooms < autoRooms) : (adults>8);
  return { base, baseLabel, rooms, autoRooms, capacity, extraAdults, extraTotal, kidsTotal, breakfastTotal, breakfastCount, total, advance, overCapacity, checkOut: checkIn ? dateStrPlus(checkIn, nights) : '' };
}

// ===== DATE PARSING =====
function parseDate(text){
  if(!text) return null;
  text=text.toLowerCase().trim();
  const months={jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
  let m;
  m=text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return new Date(parseInt(m[1]), parseInt(m[2])-1, parseInt(m[3]));
  m=text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if(m){ let y=parseInt(m[3]); if(y<100) y+=2000; return new Date(y, parseInt(m[2])-1, parseInt(m[1])); }
  m=text.match(/(\d{1,2})[\/\-](\d{1,2})\b/);
  if(m){ const now=new Date(); let y=now.getFullYear(); let d=new Date(y, parseInt(m[2])-1, parseInt(m[1])); if(d<now) d=new Date(y+1, parseInt(m[2])-1, parseInt(m[1])); return d; }
  m=text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)/);
  if(m && months[m[2]]!==undefined){ const now=new Date(); let y=now.getFullYear(); let d=new Date(y, months[m[2]], parseInt(m[1])); if(d<now) d=new Date(y+1, months[m[2]], parseInt(m[1])); return d; }
  m=text.match(/([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/);
  if(m && months[m[1]]!==undefined){ const now=new Date(); let y=now.getFullYear(); let d=new Date(y, months[m[1]], parseInt(m[2])); if(d<now) d=new Date(y+1, months[m[1]], parseInt(m[2])) ; return d; }
  if(text.includes('tomorrow')){ const d=new Date(); d.setDate(d.getDate()+1); return d; }
  if(text.includes('today')) return new Date();
  return null;
}
function parseBookingDetails(text){
  const lower=(text||'').toLowerCase();
  const d=parseDate(text);
  const checkIn=d ? d.toISOString().slice(0,10) : '';
  let nights=1; let mN=lower.match(/(\d+)\s*night/); if(mN) nights=Math.max(1, Math.min(30, parseInt(mN[1])));
  let adults=2; let mA=lower.match(/(\d+)\s*adult/); if(mA) adults=Math.max(1, Math.min(20, parseInt(mA[1])));
  // "5 guests" = adults if no adult word
  if(!mA){ let mG=lower.match(/(\d+)\s*(guest|person|people|pax)/); if(mG) adults=Math.max(1, Math.min(20, parseInt(mG[1]))); }
  let kidsHalf=0; let mKH=lower.match(/(\d+)\s*kid[s]?\s*(6|6-12|half)/); if(mKH) kidsHalf=parseInt(mKH[1]);
  else { let mK=lower.match(/(\d+)\s*kid/); if(mK && lower.includes('6')) kidsHalf=parseInt(mK[1]); }
  let kidsFree=0; let mKF=lower.match(/(\d+)\s*(baby|infant|kid[s]?\s*0|below 6|under 6)/); if(mKF) kidsFree=parseInt(mKF[1]);
  let bookingType='Full Villa'; if(lower.includes('room') && !lower.includes('full villa') && !lower.includes('full')) bookingType='Rooms';
  if(lower.includes('1 room') || lower.includes('one room')) bookingType='Rooms';
  let rooms=null; let mR=lower.match(/(\d+)\s*room/); if(mR && bookingType==='Rooms') rooms=Math.max(1, Math.min(4, parseInt(mR[1])));
  let breakfast='Yes'; if(lower.includes('without breakfast') || lower.includes('no breakfast') || lower.includes('breakfast no')) breakfast='No';
  return { checkIn, nights, adults, kidsFree, kidsHalf, bookingType, rooms, breakfast };
}

// ===== GROQ =====
let gq=null;
try{ const { Groq } = require('groq-sdk'); if(process.env.GROQ_API_KEY) gq=new Groq({ apiKey: process.env.GROQ_API_KEY }); }catch(e){}

const SYSTEM_PROMPT = `You are Pachapp Pool Villa AI Host - humane, warm, creative, not a bot. Villa: Pachapp Pool Villa, Lucky Hill, Ooty Road, Meppadi, Wayanad, Kerala, Website www.pachapp.green, Maps https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16, Nearby https://pachapp.green/here-around/. Booking Form: ${FORM_URL} — ALWAYS send ONLY this real form link, never a fake table form.
RULES: 1. Answer REAL answer FIRST, then ask which day, how many guests, exact interest in Wayanad. 2. NEVER give price without date. NEVER say let me check Indian Calendar, personal/group, routine, internal pricing. 3. Reply in guest language, original script Malayalam, Hindi, Tamil, Telugu, Kannada, English. If not understandable, say only Please ask in ENGLISH. 4. For GROUP AGENTS: short crispy 1-2 line replies only, close in 3-4 messages, NEVER private reply in group. 5. For DIRECT guests: elaborated humane, photos/videos between answers.
PRICING — SAME AS BOOKING FORM, NEVER DIFFERENT, USE CALCULATED PRICE GIVEN TO YOU, DO NOT RECALCULATE:
FULL VILLA PRIVATE: Weekday Mon-Fri Rs.6400, Weekend Sat-Sun Rs.8000, Festival & Holiday Rs.9600 (+20% over Weekend), per-night — Fri 6400 + Sat 8000 + Sun 8000 = 22400 for 3 nights. Includes 4 rooms, 8 adults, Breakfast FREE.
ROOMS: Rs.1600 per room per night, flat ALL days, Rooms = ceil(Adults/2) capped 1-4, Manual allowed, if fewer rooms than needed Extra charged + form shows RED.
Extra adult Rs.800/night. Kids 0-6 FREE. Kids 6-12 Rs.300/night. Breakfast: Full Villa FREE, Rooms Rs.100 per head/night (Adults + Kids 6-12).
ADVANCE: 1 Room 1 Night Adults <=2 = Rs.1600, Total <= Rs.10000 = Rs.2000, Else 20%, Balance before check-in, UPI/cash. Payment screenshot + UTR, owner verifies, AI confirms ONLY after owner Yes.
BOOKING: Owner confirms only after checking bank. Guest always Pending - Waiting for Pachapp to verify, never Confirmed by bot.`;

async function askAI(userMsg, isGroup, history, calcContext){
  if(!gq) return null;
  try{
    const modeNote = isGroup ? 'MODE: GROUP AGENT - 1-2 lines only, crispy.' : 'MODE: DIRECT GUEST - Elaborated humane, inspiring.';
    const calcNote = calcContext ? '\nCALCULATED PRICE FROM BOOKING FORM (USE THIS EXACTLY, DO NOT RECALCULATE):\n' + calcContext : '';
    const c = await gq.chat.completions.create({ model: 'openai/gpt-oss-20b', messages: [{ role: 'system', content: SYSTEM_PROMPT + '\n' + modeNote + calcNote }, ...(history||[]).slice(-8), { role: 'user', content: userMsg }], temperature: 0.7, max_tokens: isGroup ? 120 : 600 });
    return c.choices[0]?.message?.content || null;
  }catch(e){ console.log('GQ error '+e.message); return null; }
}

function fallbackReply(text, parsed, calc){
  const lower=(text||'').toLowerCase();
  const isGroup = false;
  if(lower.includes('pool') || lower.includes('swim')){
    return 'Yes! Private pool just for you - no sharing. 🏊\n\nPachapp has beautiful private pool with Wayanad hills view.\n\nWhich date? How many guests? What do you love in Wayanad?\n\nBook: ' + FORM_URL;
  }
  if(lower.includes('price') || lower.includes('rate') || lower.includes('cost') || lower.includes('charge') || parsed.checkIn){
    if(!parsed.checkIn){
      return 'Price depends on date, so I can give exact price. 😊\n\nFull Private Villa: Weekday Mon-Fri Rs.6400, Weekend Sat-Sun Rs.8000, Festival & Holiday Rs.9600 (+20%) — per-night, Breakfast FREE, 8 adults\nRooms: Rs.1600 per room per night, flat ALL days, Rooms = ceil(Adults/2)\nExtra Adult Rs.800/night • Kids 0-6 FREE • Kids 6-12 Rs.300/night\n\nWhich date? How many guests?\n\nBook: ' + FORM_URL;
    }
    const r = calc;
    let msg = 'For ' + parsed.checkIn + ' — ' + r.baseLabel + ' ✨\n\n';
    msg += (parsed.bookingType==='Full Villa' ? 'Private whole villa, 4 rooms, private pool, Breakfast FREE, includes 8 adults.' : r.rooms + ' Room(s), Capacity ' + r.capacity + ' Adults, Rooms = Auto ceil(Adults/2).') + '\n';
    if(r.overCapacity) msg += '⚠️ You need ' + r.autoRooms + ' Room(s) for ' + parsed.adults + ' Adults — fewer rooms = Extra charged (form shows RED).\n';
    msg += 'Base: ' + fmt(r.base) + '\n';
    if(r.extraTotal>0) msg += 'Extra Adult: ' + fmt(r.extraTotal) + ' (' + r.extraAdults + ' x Rs.800 x ' + parsed.nights + ' night(s))\n';
    if(r.kidsTotal>0) msg += 'Kids 6-12: ' + fmt(r.kidsTotal) + '\n';
    if(r.breakfastTotal>0) msg += 'Breakfast: ' + fmt(r.breakfastTotal) + '\n';
    msg += 'Grand Total: ' + fmt(r.total) + '\nAdvance: ' + fmt(r.advance) + ', balance before check-in.\nCheck-out: ' + r.checkOut + '\n\nBook here: ' + FORM_URL + '\nShall I hold this date?';
    return msg;
  }
  return 'Welcome to Pachapp Pool Villa! 🌿🏊\n\nLucky Hill, Meppadi, Wayanad - private villa, private pool, 4 rooms, hills view.\n\nWhich date? How many guests? What brings you to Wayanad?\n\nBook: ' + FORM_URL;
}

// ===== AIRTABLE =====
let dbBase=null;
try{ if(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID){ const AT=require('airtable'); dbBase=new AT({apiKey: process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID); } }catch(e){}
async function saveToDB(b){
  if(!dbBase) return false;
  try{
    const table = process.env.AIRTABLE_TABLE || 'Bookings';
    const existing = await dbBase(table).select({ filterByFormula: `AND({Date}='${b.date}', {Phone}='${b.phone}', {Name}='${b.name}')` }).firstPage();
    if(existing && existing.length>0) return true;
    await dbBase(table).create([{ fields: { Name: b.name||'Guest', Phone: b.phone||'', Date: b.date||'', Guests: b.guests||'', Rooms: b.rooms||'Full Villa', Total: b.total||0, Advance: b.advance||0, Status: b.status||'Pending - Waiting for Verification', UTR: b.utr||'', Source: 'WA AI' } }]);
    return true;
  }catch(e){ console.log('Airtable save fail '+e.message); return false; }
}

// ===== WHATSAPP CLOUD API SEND =====
async function sendWhatsApp(to, text){
  if(!WHATSAPP_TOKEN || !WHATSAPP_PHONE_ID){ console.log('No WhatsApp token/phone_id, skip send to '+to); return false; }
  try{
    const res = await fetch('https://graph.facebook.com/v21.0/' + WHATSAPP_PHONE_ID + '/messages', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + WHATSAPP_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body: text.slice(0,4000) } })
    });
    const j = await res.json();
    if(!res.ok) console.log('WA send fail', JSON.stringify(j).slice(0,500));
    return res.ok;
  }catch(e){ console.log('WA send error '+e.message); return false; }
}

const chatHistories = new Map();
const pendingBookings = new Map();

async function handleMessage(from, text, senderName, isGroup){
  const lower=(text||'').toLowerCase();
  const senderNumber = from;
  // Owner YES/NO confirm
  if(senderNumber===OWNER_NUMBER && (lower.trim()==='yes' || lower.trim()==='no' || lower.includes('confirm') || lower.includes('verified'))){
    let targetPhone=null, targetBooking=null;
    for(const [phone,b] of pendingBookings){ targetPhone=phone; targetBooking=b; }
    if(targetBooking){
      if(lower.trim()==='yes' || lower.includes('confirm') || lower.includes('verified')){
        targetBooking.status='Confirmed';
        await saveToDB(targetBooking);
        await sendWhatsApp(targetBooking.phone, 'Booking CONFIRMED - Pachapp Pool Villa! 🎉\n\nDate: '+targetBooking.date+'\nGuests: '+targetBooking.guests+'\nTotal: '+fmt(targetBooking.total)+'\nAdvance: '+fmt(targetBooking.advance)+' received\nBalance before check-in.\n\nMaps: '+MAPS_LINK+'\nNearby: '+NEARBY_LINK+'\n\nWelcome to Pachapp! 🌿');
        await sendWhatsApp(from, 'Confirmed to guest '+targetBooking.name);
        pendingBookings.delete(targetPhone);
      } else { await sendWhatsApp(from, 'Not confirmed.'); }
      return;
    }
  }
  // Payment UTR
  const hasUTR = lower.match(/utr|transaction|ref/i) || lower.match(/\b\d{10,18}\b/);
  if(hasUTR && (lower.includes('paid') || lower.includes('payment') || lower.includes('advance') || lower.includes('utr'))){
    const utrMatch=text.match(/\b\d{10,18}\b/);
    const utr=utrMatch ? utrMatch[0] : 'Screenshot received';
    const prev=pendingBookings.get(senderNumber);
    const pending={ name: senderName, phone: senderNumber, chatId: from, date: prev?.date || 'To confirm', guests: prev?.guests || '', total: prev?.total || 0, advance: prev?.advance || 0, utr, status: 'Pending - Waiting for Verification' };
    pendingBookings.set(senderNumber, pending);
    await sendWhatsApp(OWNER_NUMBER, 'PAYMENT VERIFICATION NEEDED\nGuest: '+senderName+' ('+senderNumber+')\nDate: '+pending.date+'\nUTR: '+utr+'\nAdvance: '+fmt(pending.advance)+'\n\nReply YES to confirm, NO to reject.');
    await sendWhatsApp(from, 'Payment screenshot + UTR '+utr+' received. ✅\n\nOwner will verify after checking bank and I will confirm your booking in a moment.');
    return;
  }
  // Normal AI + deterministic calc
  if(!chatHistories.has(from)) chatHistories.set(from, []);
  const history=chatHistories.get(from);
  history.push({ role:'user', content: text });
  const parsed = parseBookingDetails(text);
  let calc=null, calcContext='';
  if(parsed.checkIn){
    calc = calcTotal(parsed);
    calcContext = 'Check-in: '+parsed.checkIn+' | Nights: '+parsed.nights+' | Check-out: '+calc.checkOut+' | Type: '+parsed.bookingType+' | Rooms: '+calc.rooms+' (Auto need '+calc.autoRooms+') | Adults: '+parsed.adults+' | Kids 6-12: '+parsed.kidsHalf+' | Breakfast: '+parsed.breakfast+' | Base: '+fmt(calc.base)+' ('+calc.baseLabel+') | Extra: '+fmt(calc.extraTotal)+' | Kids: '+fmt(calc.kidsTotal)+' | Breakfast: '+fmt(calc.breakfastTotal)+' | TOTAL: '+fmt(calc.total)+' | ADVANCE: '+fmt(calc.advance)+' | OverCapacity: '+(calc.overCapacity?'YES':'NO');
    pendingBookings.set(senderNumber, { name: senderName, phone: senderNumber, chatId: from, date: parsed.checkIn, guests: text, total: calc.total, advance: calc.advance, rooms: parsed.bookingType==='Full Villa' ? 'Full Villa' : calc.rooms+' Room(s)', status: 'Enquiry' });
  }
  let reply = await askAI(text, isGroup, history, calcContext);
  if(!reply) reply = fallbackReply(text, parsed, calc || calcTotal({...parsed, rooms: parsed.rooms}));
  history.push({ role:'assistant', content: reply });
  if(history.length>16) chatHistories.set(from, history.slice(-16));
  await sendWhatsApp(from, reply);
  if(!isGroup && (lower.includes('photo') || lower.includes('video') || lower.includes('pics'))){
    await sendWhatsApp(from, 'Photos & videos here: ' + WEBSITE + ' 📸\nMaps: ' + MAPS_LINK + '\nBook: ' + FORM_URL);
  }
}

// ===== ROUTES =====
app.get('/health', (req,res)=>{
  res.json({ status:'ok', villa: VILLA_NAME, ready: true, method: 'Cloud API', has_token: !!WHATSAPP_TOKEN, has_phone_id: !!WHATSAPP_PHONE_ID, form_url: FORM_URL });
});
app.get('/', (req,res)=>{ res.send('Pachapp AI Agent - Cloud API - Running. Form: ' + FORM_URL); });
app.get('/Pachapp_1.png', (req,res)=>{
  const p=path.join(__dirname, 'Pachapp_1.png');
  if(fs.existsSync(p)) res.sendFile(p); else res.status(404).send('Logo not found');
});
app.get('/qr.png', (req,res)=>{
  const p=path.join(__dirname, 'qr.png');
  if(fs.existsSync(p)) res.sendFile(p); else res.status(404).send('QR not found');
});
app.get('/webhook', (req,res)=>{
  const mode=req.query['hub.mode'], token=req.query['hub.verify_token'], challenge=req.query['hub.challenge'];
  if(mode==='subscribe' && token===VERIFY_TOKEN) return res.status(200).send(challenge);
  return res.sendStatus(403);
});
app.post('/webhook', async (req,res)=>{
  try{
    res.sendStatus(200);
    const body=req.body;
    if(body.object!=='whatsapp_business_account') return;
    for(const entry of body.entry||[]){
      for(const change of entry.changes||[]){
        const value=change.value||{};
        // Incoming messages
        for(const msg of value.messages||[]){
          const from=msg.from;
          const text=msg.text?.body || msg.image?.caption || msg.video?.caption || '';
          if(!text) continue;
          const senderName=value.contacts?.find(c=>c.wa_id===from)?.profile?.name || 'Guest';
          // Group vs Direct: Cloud API groups come via different handling — treat as direct unless marked group
          const isGroup=false;
          await handleMessage(from, text, senderName, isGroup);
        }
        // Status updates ignore
      }
    }
  }catch(e){ console.log('webhook error '+e.message); }
});

app.listen(PORT, ()=> console.log('Pachapp AI Agent Ready - CLOUD API - BOT IS LIVE on '+PORT));
