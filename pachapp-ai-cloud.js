const express = require('express');
const axios = require('axios');
// V44 Gork via axios - NO gorq-sdk needed
const groqReady = !!process.env.GROQ_API_KEY;
console.log('GROQ READY:' + groqReady);

const app = express();
app.use(express.json());
app.use(express.static(__dirname));
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = '606463179209554';
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appQrwByIT5af54K3';
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tbleQTjZjOAbPq3sd';
const GITHUB_BASE = 'https://raw.githubusercontent.com/Pachapp/pachapp-ai/main/';
const BOOKING_FORM = 'https://pachapp-ai-1.onrender.com/booking-form.html';
const WEBSITE = 'https://www.pachapp.green';
const FIRST_PHOTOS = [GITHUB_BASE + 'room1.jpg', GITHUB_BASE + 'outdoor1.jpg', GITHUB_BASE + 'pool1.jpg'];
const SECOND_PHOTOS = [GITHUB_BASE + 'room1.jpg', GITHUB_BASE + 'room2.jpg', GITHUB_BASE + 'room3.jpg', GITHUB_BASE + 'room4.jpg', GITHUB_BASE + 'pool1.jpg', GITHUB_BASE + 'pool2.jpg', GITHUB_BASE + 'pool3.jpg', GITHUB_BASE + 'outdoor1.jpg', GITHUB_BASE + 'outdoor2.jpg', GITHUB_BASE + 'outdoor3.jpg'];

const memory = {};
function getMem(phone){ if(!memory[phone]) memory[phone]={photoCount:0, history:[], checkin:null, checkout:null, villaType:''}; return memory[phone]; }

function parseDates(text){
  const lower = text.toLowerCase();
  const months = {jan:0, january:0, feb:1, february:1, mar:2, march:2, apr:3, april:3, may:4, jun:5, june:5, jul:6, july:6, aug:7, august:7, sep:8, sept:8, september:8, oct:9, october:9, nov:10, november:10, dec:11, december:11};
  const dates = [];
  const re1 = /(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})/g; let m;
  while((m=re1.exec(lower))!==null){ let d=parseInt(m[1],10), mo=parseInt(m[2],10)-1; if(mo>=0 && mo<12 && d>=1 && d<=31){ let y=new Date().getFullYear(); let dt=new Date(y,mo,d); if(dt < new Date(new Date().setHours(0,0,0,0))) dt.setFullYear(y+1); dates.push(dt); } }
  const parts = lower.replace(/,/g,' ').split(/\s+/);
  for(let i=0;i<parts.length;i++){ if(months[parts[i]]!==undefined){ let mo=months[parts[i]]; let d=null; if(i>0 && /^\d{1,2}$/.test(parts[i-1])) d=parseInt(parts[i-1],10); else if(i+1<parts.length && /^\d{1,2}$/.test(parts[i+1])) d=parseInt(parts[i+1],10); if(d){ let y=new Date().getFullYear(); let dt=new Date(y,mo,d); if(dt < new Date(new Date().setHours(0,0,0,0))) dt.setFullYear(y+1); if(!dates.find(x=>x.getTime()===dt.getTime())) dates.push(dt); } } }
  // tomorrow / today / weekend / next friday
  const today = new Date(); today.setHours(0,0,0,0);
  if(lower.includes('tomorrow')) dates.push(new Date(today.getTime()+86400000));
  if(lower.includes('today')) dates.push(new Date(today.getTime()));
  if(lower.includes('next weekend') || lower.includes('weekend')){ let d=new Date(today); d.setDate(d.getDate()+((6-d.getDay()+7)%7)); dates.push(d); }
  return dates.sort((a,b)=>a-b);
}
function todayIST(){ const ist = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Kolkata'})); ist.setHours(0,0,0,0); return ist; }
function fmt(d){ return d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); }
async function checkAvailability(checkin, checkout){
  try{
    const url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + AIRTABLE_TABLE_ID;
    const res = await axios.get(url, {headers:{Authorization:'Bearer ' + AIRTABLE_API_KEY}, params:{pageSize:100}});
    const records = res.data.records || [];
    for(const r of records){ const f = r.fields || {}; const exIn = f.Checkin || f['Check-in'] || f.CheckIn || f.Date; const exOut = f.Checkout || f['Check-out'] || f.CheckOut; if(!exIn || !exOut) continue; const eIn = new Date(exIn), eOut = new Date(exOut); if(checkin < eOut && checkout > eIn) return false; }
    return true;
  }catch(e){ console.log('AVAIL ERROR ' + e.message); return true; }
}
async function sendText(to, body){ await axios.post('https://graph.facebook.com/v22.0/' + PHONE_NUMBER_ID + '/messages', {messaging_product:'whatsapp', to:to, type:'text', text:{body:body}}, {headers:{Authorization:'Bearer ' + WHATSAPP_TOKEN, 'Content-Type':'application/json'}}); }
async function sendImage(to, link, caption){ await axios.post('https://graph.facebook.com/v22.0/' + PHONE_NUMBER_ID + '/messages', {messaging_product:'whatsapp', to:to, type:'image', image:{link:link, caption:caption||''}}, {headers:{Authorization:'Bearer ' + WHATSAPP_TOKEN, 'Content-Type':'application/json'}}); }

// BEAUTIFUL HUMAN HOST - Grok is the brain. No keyword spaghetti. Grok understands meaning like a human.
async function askGrokHuman(userText, mem, availInfo){
  if(!groqReady) return null;
  const systemPrompt = `You are Uday, the warm, wise, mature human host of Pachapp Pool Villa, Wayanad, Kerala. You talk like a beautiful human, not a robot. You never repeat the same greeting. You remember what guest said. You answer directly, then ask only ONE question.

YOUR REAL DATA - Never invent anything else. If guest asks something not in this data, say you will check with host, do not make up:
- Location: Pachapp Pool Villa, Wayanad, Kerala. Tea plantation view Yes, Mountain view Yes. Nearby all within 2 km. Website https://www.pachapp.green has map. For exact Google coordinates / live pin, say "Please see website for map, or I will share live pin from host" - Never invent lat/long numbers.
- Rooms: 4 rooms, all King size beds, each room attached bathroom, total 7 bathrooms. Bed linen, towels, toiletries provided. Pool towels NOT provided. Max 20 guests for Full Villa. Extra mattress / extra person charge applies.
- Arrival 2 PM, Departure 12 PM.
- Facilities: Wi-Fi, CCTV, TV, Hot water, Filtered water, Free and Paid Breakfast/Dinner, Pet friendly Rs 1000, Free parking 6 cars, Private Kitchen with stove, fridge, utensils, kettle (kettle in kitchen not room), Inverter, First aid kit, Fire extinguisher, Caretaker 24 hours, Housekeeping if asked.
- Food: Breakfast free for Full Villa only. Dinner Rs 250. Tea/Coffee Paid.
- Pool: Private, Depth 120 cm, Kids with adult, Jacuzzi in pool working, Pool 8 AM-11 PM.
- Activities: Library (books inside villa), Art Gallery (Photography inside villa), Meeting hall inside villa 20-40 people, Swimming pool.
- Games: Chess, Ludo, Snake and ladder, Carrom board, Badminton, Jumping rope. No football ground, No playground.
- Paid: Barbecue free self use, Rs 250 staff help, Rs 750 per 1 Kg Chicken, Grill till 11 PM. Campfire Rs 500, 7 PM-11 PM. Music rent: Keyboard Thomman 88 keys Rs 2000, Roland rhythm pad Rs 1000, Guitar Washburn electric Rs 1000, Tabla Rs 1000, Music 7 PM-11 PM. Owner is Music Composer. Live Music can be arranged on request - ask host for details. No separate Karaoke system.
- Rules: 20% Advance mandatory, Advance NOT refundable, Balance at check-in, Show valid ID, Diseased not allowed in pool, No outdoor activities in bad weather. Smoking yes but drinks/smokes NOT in music rooms. Alcohol yes. Party/DJ yes, Music till 11 PM. Early/Late check-in charge yes. Pet charge Rs 1000.
- Booking form: https://pachapp-ai-1.onrender.com/booking-form.html - Advance only 20%, balance at check-in.
- Photos: You do NOT send photos, system sends them. If guest wants photos, say "Sending photos" in your reply - system will send them separately.

HOW YOU TALK LIKE A BEAUTIFUL HUMAN:
- Guest says "where is it" -> Answer location warmly: "We are in Wayanad, Kerala, in tea plantation view..." - Do NOT say "Okay - Rooms" or "Tell me dates" as first line.
- Guest says "google map link" -> Give website + ask host for pin, do NOT repeat same sentence twice, do NOT add "What dates are you planning?" twice.
- Guest says "how many rooms" -> Answer "We have 4 rooms..." - Do NOT say "Okay - Rooms" - That is not a booking, it is a question.
- Guest says "hi" -> Greet once warmly, ask dates once.
- Guest says dates -> Availability is given to you below, use it. If AVAILABLE, celebrate and offer booking form. If NOT AVAILABLE, be sorry, suggest next free date if given, ask for other dates. Never say "Okay - Rooms" for a question.
- Guest says "expensive" -> Understand value, explain private villa value, offer form, don't argue.
- Guest says "yes" -> If we have dates, send form. If no dates, ask dates.
- Always ONE question at end, never two "What dates?" in same message. Never duplicate a line.
- Keep it short, warm, human - 2-4 lines, not a long list unless guest asks for full amenities.
- Remember: Guest dates in memory: ${mem.checkin ? fmt(mem.checkin)+' to '+fmt(mem.checkout) : 'No dates yet'} Villa: ${mem.villaType || 'Not known'} Photo count: ${mem.photoCount}
- Availability info for this message: ${availInfo || 'No dates in this message'}
- Conversation history: ${mem.history.slice(-6).map(h=>h.role+': '+h.text).join(' | ')}
`;
  try{
    const resp = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
     model: 'openai/gpt-oss-20b',
      messages: [{role:'system', content: systemPrompt}, {role:'user', content: userText}],
      temperature: 0.7,
      max_tokens: 350
   
                }, {headers: {Authorization: 'Bearer ' + process.env.GROQ_API_KEY}});
      return resp.data.choices[0].message.content.trim();
  }catch(e){ console.log('GROQ ERROR ' + e.message); return null; }
}

app.post('/webhook', async (req,res)=>{
  try{
    const entry = req.body.entry && req.body.entry[0] && req.body.entry[0].changes && req.body.entry[0].changes[0] && req.body.entry[0].changes[0].value;
    const msg = entry && entry.messages && entry.messages[0];
    if(!msg || msg.type!=='text'){ return res.sendStatus(200); }
    const from = msg.from;
    const text = msg.text.body.trim();
    const lower = text.toLowerCase();
    const mem = getMem(from);
    mem.history.push({role:'Guest', text:text}); if(mem.history.length>12) mem.history.shift();

    // PHOTOS - Only rule left, because Grok cannot send images. System sends them, Grok says "Sending photos"
    if(lower.includes('photo') || lower.includes('image') || lower.includes('pic')){
      if(lower.includes('more')){
        if(mem.photoCount===0){
          mem.photoCount=1;
          for(const p of SECOND_PHOTOS){ try{ await sendImage(from,p); }catch(e){ console.log('SEND IMAGE FAIL ' + p); } }
          await sendText(from, 'These are 10 photos - 4 Rooms, 3 Pool, 3 Outdoor.\n\nWant all photos + videos? Type - more photos');
          return res.sendStatus(200);
        } else {
          mem.photoCount=2;
          await sendText(from, 'For all photos + videos, please visit our website:\n' + WEBSITE);
          return res.sendStatus(200);
        }
      } else {
        mem.photoCount=0;
        for(const p of FIRST_PHOTOS){ try{ await sendImage(from,p); }catch(e){ console.log('SEND IMAGE FAIL ' + p); } }
        await sendText(from, 'These are 3 photos - 1 Room, 1 Outdoor, 1 Pool.\n\nWant more photos? Type - more photos');
        return res.sendStatus(200);
      }
    }

    // DATES + AIRTABLE - Check real availability, then let Grok speak like human
    const dates = parseDates(text);
    let availInfo = null;
    if(dates.length>=1){
      const cin = dates[0];
      if(cin < todayIST()){ availInfo = fmt(cin)+' is already passed. Today is '+fmt(todayIST())+'. Ask for future date.'; }
      else {
        const cout = dates[1] || new Date(cin.getTime()+86400000);
        mem.checkin=cin; mem.checkout=cout;
        if(lower.includes('full')) mem.villaType='Full Villa'; else if(lower.includes('room')) mem.villaType='Rooms';
        const avail = await checkAvailability(cin, cout);
        availInfo = avail ? 'AVAILABLE for '+fmt(cin)+' to '+fmt(cout) : 'NOT AVAILABLE for '+fmt(cin)+' to '+fmt(cout);
      }
    } else if(lower.includes('full villa') || lower === 'full' || lower === 'villa'){ mem.villaType='Full Villa'; }

    // BEAUTIFUL HUMAN - Grok handles EVERYTHING else: where is it, how many rooms, map, music, karaoke, price, family, etc.
    const humanAns = await askGrokHuman(text, mem, availInfo);
    if(humanAns){
      mem.history.push({role:'Host', text:humanAns});
      await sendText(from, humanAns);
      // If Grok offered booking form and we have dates + villa, send form link as well (only if Grok mentioned form)
      if(humanAns.toLowerCase().includes('booking form') && mem.checkin && mem.checkout){
        await sendText(from, 'Booking form:\n' + BOOKING_FORM + '\n\nFill it to lock your date - Advance only 20%, balance at check-in.');
      }
      return res.sendStatus(200);
    }
    // If Grok is down, one human fallback, not same greeting repeat
    await sendText(from, 'Namaskaram, Welcome to Pachapp Pool Villa, Wayanad. I am Uday, your host. Tell me your dates and I will check for you right away.');
    return res.sendStatus(200);
  }catch(e){ console.log('WEBHOOK ERROR ' + e.message); return res.sendStatus(200); }
});

app.get('/webhook', (req,res)=>{
  const VERIFY = process.env.VERIFY_TOKEN || 'pachapp123';
  if(req.query['hub.verify_token']===VERIFY) return res.send(req.query['hub.challenge']);
  return res.sendStatus(403);
});
app.post('/api/bookings', async (req,res)=>{
  try{
    const b = req.body || {};
    const token = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
    const baseId = process.env.AIRTABLE_BASE_ID;
    const table = process.env.AIRTABLE_TABLE || process.env.AIRTABLE_TABLE_NAME || 'Bookings';
    if(!token || !baseId){ return res.json({ok:false, error:'Airtable not configured'}); }
   const fields = {Name: b.name, Phone: b.phone, Checkin: b.date, Checkout: b.checkout, Nights: b.nights, Stay: b.stay, Adults: b.adults, Kids06: b.kids06, Kids612: b.kids612, Breakfast: b.breakfast, Notes: b.notes, Total: b.total, Advance: b.advance, Status: b.status || 'Pending - Waiting for Verification', UTR: b.utr};
const r = await axios.post('https://api.airtable.com/v0/' + baseId + '/' + table, {records:[{fields:fields}]}, {headers:{Authorization:'Bearer '+token, 'Content-Type':'application/json'}});
return res.json({ok:true, id: r.data.id});});
app.get('/', (req,res)=> res.send('Pachapp AI Live - V44 Grok via Axios'));const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('Live on ' + PORT));
