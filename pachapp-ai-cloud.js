// Pachapp AI - DRIVE PHOTOS VERSION - Cloud API + VOICE ALL LANGUAGES
// Photos = Google Drive, NOT website. Website has NO gallery.
// Main: https://drive.google.com/drive/folders/113zNhiOsHIvSWM6Uvt04GQojISQKO1TI
// OUTDOOR: https://drive.google.com/drive/folders/1K7Xy55ktCLXqZ0c2IVKkQ3UcfuVjGCfh
// POOL: https://drive.google.com/drive/folders/1RUsjNpD0IlyPRAhcKBtXHWVTMU_LcFYh
// ROOMS: https://drive.google.com/drive/folders/10tN84VxjXvNYiuzOx5sT2XHl46su3mgO
// QR Code: https://drive.google.com/drive/folders/1P2pAgfc36HWsRNKAdswEVW7k8D1cxvCz
const express = require('express');
const app = express();
app.use(express.json({ limit: '10mb' }));
const PORT = process.env.PORT || 10000;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '606463179209554';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'pachapp123';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OWNER_NUMBER = '918943666911';
const BOT_PHONE = '971529100668';
const WEBSITE = 'https://www.pachapp.green';
const MAPS_LINK = 'https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16';
const NEARBY_LINK = 'https://pachapp.green/here-around/';
// --- GOOGLE DRIVE PHOTOS - REAL LINKS ---
const PHOTOS_LINK = 'https://drive.google.com/drive/folders/113zNhiOsHIvSWM6Uvt04GQojISQKO1TI';
const POOL_PHOTOS_LINK = 'https://drive.google.com/drive/folders/1RUsjNpD0IlyPRAhcKBtXHWVTMU_LcFYh';
const ROOM_PHOTOS_LINK = 'https://drive.google.com/drive/folders/10tN84VxjXvNYiuzOx5sT2XHl46su3mgO';
const OUTDOOR_PHOTOS_LINK = 'https://drive.google.com/drive/folders/1K7Xy55ktCLXqZ0c2IVKkQ3UcfuVjGCfh';
const ACTIVITIES_PHOTOS_LINK = 'https://drive.google.com/drive/folders/1K7Xy55ktCLXqZ0c2IVKkQ3UcfuVjGCfh';
const QR_CODE_LINK = 'https://drive.google.com/drive/folders/1P2pAgfc36HWsRNKAdswEVW7k8D1cxvCz';
const VIDEO_TOUR_LINK = 'https://drive.google.com/drive/folders/113zNhiOsHIvSWM6Uvt04GQojISQKO1TI';
const PRICING = { fullWeekday: 6400, fullWeekend: 8000, fullFestival: 9600, separate1: 1600, separate2: 3200, separate3: 4800 };
const FESTIVALS = new Set(['2026-01-01','2026-01-02','2026-12-24','2026-12-25','2026-12-26','2026-12-27','2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2026-08-28','2026-08-29','2026-08-30','2026-08-31','2026-09-01','2026-10-02','2026-10-20','2026-10-21','2026-04-14','2026-05-01','2026-08-15']);
function isFestival(d){ return FESTIVALS.has(d.toISOString().slice(0,10)); }
function isWeekend(d){ const day=d.getDay(); return day===0||day===6; }
function parseDate(text){
  if(!text) return null; text=text.toLowerCase().trim();
  const months={jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11};
  let m;
  m=text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if(m) return new Date(parseInt(m[1]),parseInt(m[2])-1,parseInt(m[3]));
  m=text.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/); if(m){ let y=parseInt(m[3]); if(y<100) y+=2000; return new Date(y,parseInt(m[2])-1,parseInt(m[1])); }
  m=text.match(/(\d{1,2})[\/\-](\d{1,2})\b/); if(m){ const now=new Date(); let y=now.getFullYear(); let d=new Date(y,parseInt(m[2])-1,parseInt(m[1])); if(d<now) d=new Date(y+1,parseInt(m[2])-1,parseInt(m[1])); return d; }
  m=text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)/); if(m&&months[m[2]]!==undefined){ const now=new Date(); let y=now.getFullYear(); let d=new Date(y,months[m[2]],parseInt(m[1])); if(d<now) d=new Date(y+1,months[m[2]],parseInt(m[1])); return d; }
  m=text.match(/([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/); if(m&&months[m[1]]!==undefined){ const now=new Date(); let y=now.getFullYear(); let d=new Date(y,months[m[1]],parseInt(m[2])); if(d<now) d=new Date(y+1,months[m[1]],parseInt(m[2])); return d; }
  if(text.includes('tomorrow')){ const d=new Date(); d.setDate(d.getDate()+1); return d; }
  if(text.includes('today')) return new Date();
  return null;
}
function getDateType(text){ const d=parseDate(text); if(!d) return 'weekday'; if(isFestival(d)) return 'festival'; if(isWeekend(d)) return 'weekend'; return 'weekday'; }
function calcAdvance(total){ if(total<=1600) return 1600; if(total<=10000) return 2000; return Math.round(total*0.20); }
function formatPrice(n){ return 'Rs.'+n.toLocaleString('en-IN'); }
let dbBase=null;
try{ if(process.env.AIRTABLE_API_KEY && process.env.AIRTABLE_BASE_ID){ const AT=require('airtable'); dbBase=new AT({apiKey:process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID); } }catch(e){}
async function saveToDB(booking){
  if(!dbBase) return false;
  try{
    const existing=await dbBase('Booking').select({filterByFormula:`AND({Date}='${booking.date}', {Phone}='${booking.phone}', {Name}='${booking.name}')`}).firstPage();
    if(existing && existing.length>0) return true;
    await dbBase('Booking').create([{fields:{Name:booking.name||'Guest',Phone:booking.phone||'',Date:booking.date||'',Guests:booking.guests||'',Rooms:booking.rooms||'Full Villa',Total:booking.total||0,Advance:booking.advance||0,Status:booking.status||'Pending',UTR:booking.utr||'',Source:'WA AI'}}]);
    return true;
  }catch(e){ return false; }
}
let gq=null;
try{ const {Groq}=require('groq-sdk'); if(GROQ_API_KEY) gq=new Groq({apiKey:GROQ_API_KEY}); }catch(e){}
const SYSTEM_PROMPT = `You are Pachapp Pool Villa AI Host - humane, warm, creative, not a bot. Villa: Pachapp Pool Villa, Lucky Hill, Ooty Road, Meppadi, Wayanad, Kerala, Website https://www.pachapp.green, Maps https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16. Owners Uday Hue, Reshma Uday, Sarwaswa Uday.
OWNER IS ARTIST: Owner Uday Hue is a musician, composer, poet, singer, creative person. He composes original songs, music, poetry. When guest asks about live music, music, songs, concert, poetry, singing, jam, performance - answer about OWNER: If Uday Hue is at the villa during your stay, there is a good chance to hear his own original compositions, live music, poetry - a rare, personal experience. Do NOT give generic "we can arrange a local band" as first answer. First say about owner and his compositions, then say if owner is not there we can try local artist. Never promise guaranteed, say good chances if owner is there. Ask what style they like - folk, classical, contemporary.
RULES:
1. Answer directly. NEVER start with "First the right answer", "Here is the answer", "Answer:", "The answer is", "First," "Let me tell you the answer" or any meta phrase like that. Start directly with the real answer sentence. Example: Guest "Live music?" -> Start "If Uday Hue is at the villa..." NOT "Answer: Yes..." NOT "First the right answer is...".
2. Answer REAL answer FIRST, then ask which day, how many guests, exact interest in Wayanad.
3. NEVER give price without date. NEVER say let me check Indian Calendar, personal/group, routine, internal pricing.
4. ALL LANGUAGES - TYPED + VOICE: Reply in guest language, original script Malayalam, Hindi, Tamil, Telugu, Kannada, English. Typed and voice both. If guest types in Malayalam, reply in Malayalam. If guest sends voice in Hindi, reply in Hindi. If guest sends voice in Tamil, reply in Tamil. Never switch to English unless guest uses English. If not understandable, say only Please ask in ENGLISH.
5. For GROUP AGENTS: short crispy 1-2 line replies only, close in 3-4 messages, NEVER private reply in group. When agents in GROUP ask for images/photos, send SPECIFIC Google Drive links: Rooms: https://drive.google.com/drive/folders/10tN84VxjXvNYiuzOx5sT2XHl46su3mgO, Pool: https://drive.google.com/drive/folders/1RUsjNpD0IlyPRAhcKBtXHWVTMU_LcFYh, Outdoor: https://drive.google.com/drive/folders/1K7Xy55ktCLXqZ0c2IVKkQ3UcfuVjGCfh, Activities: https://drive.google.com/drive/folders/1K7Xy55ktCLXqZ0c2IVKkQ3UcfuVjGCfh (Activities photos are in OUTDOOR folder). Do NOT send website link for photos.
6. For DIRECT guests (outside group): When they ask for images/photos, send SPECIFIC Google Drive link if they ask specific (rooms -> ROOMS Drive link, pool -> POOL Drive link, outdoor -> OUTDOOR Drive link, activities -> OUTDOOR Drive link) OR send Main Drive link if they ask general photos: https://drive.google.com/drive/folders/113zNhiOsHIvSWM6Uvt04GQojISQKO1TI. You can also send Website https://www.pachapp.green for general info, but NOT for photos.
7. PHOTOS: Photos are ONLY on Google Drive. Website has NO gallery. NEVER say "Gallery", "Photos Gallery", "Gallery link", "Gallery of website". Always say "Drive" or "Photos Link" with Drive link. Website link https://www.pachapp.green is ONLY for general info, NOT for photos.
8. QR CODE: When guest asks for QR, payment QR, booking QR, UPI QR - send QR Code Drive link: https://drive.google.com/drive/folders/1P2pAgfc36HWsRNKAdswEVW7k8D1cxvCz
9. VOICE: Guest may send voice note. You receive transcribed text. Treat it exactly like text. Do NOT say "I cannot hear voice" or "I cannot listen". Answer normally as if guest typed it. Do NOT ask guest to type. If transcription has [voice] marker, ignore marker and answer content.
10. Never give inappropriate, sexual, political, religious hate, or abusive answers. Always stay polite, family-safe, villa host tone. If guest asks inappropriate question, politely decline and bring back to villa booking.
PRICING FULL VILLA PRIVATE: Weekday Rs.6400, Weekend Rs.8000, Festival Rs.9600, Includes 4 rooms, 8 adults + 8 kids below 6, Breakfast FREE. Extra adult Rs.800. Kids below 6 FREE.
WEEKDAY SEPARATE SHARED Weekday Only: 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800, Each room 2 adults + 2 kids below 6, Extra adult Rs.700 without breakfast / Rs.800 with breakfast, Breakfast NOT FREE Rs.100 only per head, MUST ask with/without breakfast. Weekend/Festival Whole Villa ONLY.
ADVANCE: 1 Room Rs.1600, Total up to Rs.10000 Rs.2000 minimum, Total over Rs.10000 20%, Balance before check-in, UPI/cash. Payment screenshot + UTR, owner verifies, AI confirms ONLY after owner Yes.
BOOKING: A-Table master, skip duplicate by date+phone+name, guests never see A-Table, only confirmation + QR. No Air-bnb automation. Booking +91 8943666911`;
async function askAI(userMsg, isGroup, history){
  if(!gq) return null;
  try{
    const modeNote = isGroup ? 'MODE: GROUP AGENT - 1-2 lines only, crispy.' : 'MODE: DIRECT GUEST - Elaborated humane, inspiring.';
    const c = await gq.chat.completions.create({ model:'llama-3.1-8b-instant', messages:[{role:'system', content: SYSTEM_PROMPT+'\n'+modeNote}, ...(history||[]).slice(-8), {role:'user', content:userMsg}], temperature:0.7, max_tokens: isGroup?120:600 });
    return c.choices[0]?.message?.content || null;
  }catch(e){ console.log('Groq chat error '+e.message); return null; }
}
function fallbackReply(text, isGroup){
  const lower=(text||'').toLowerCase();
  if(lower.includes('live music')||lower.includes('music')||lower.includes('song')){
    return 'If Uday Hue is at the villa during your stay, there is a good chance to hear his own original compositions, live music, poetry. What style do you like - folk, classical, contemporary?';
  }
  if(lower.includes('qr')){
    return 'QR Code: '+QR_CODE_LINK+'\nWebsite: '+WEBSITE+'\nMaps: '+MAPS_LINK;
  }
  if(lower.includes('photo')||lower.includes('video')||lower.includes('pics')||lower.includes('pool')||lower.includes('room')){
    if(lower.includes('pool')) return 'Pool photos - Drive: '+POOL_PHOTOS_LINK+' 📸\nAll Photos: '+PHOTOS_LINK+'\nMaps: '+MAPS_LINK;
    if(lower.includes('room')) return 'Room photos - Drive: '+ROOM_PHOTOS_LINK+' 📸\nAll Photos: '+PHOTOS_LINK+'\nMaps: '+MAPS_LINK;
    if(lower.includes('activit')) return 'Activities photos - Drive: '+ACTIVITIES_PHOTOS_LINK+' 📸 (in OUTDOOR folder)\nAll Photos: '+PHOTOS_LINK+'\nMaps: '+MAPS_LINK;
    if(lower.includes('outdoor')||lower.includes('outside')) return 'Outdoor photos - Drive: '+OUTDOOR_PHOTOS_LINK+' 📸\nAll Photos: '+PHOTOS_LINK+'\nMaps: '+MAPS_LINK;
    return 'Photos - Drive: '+PHOTOS_LINK+' 📸\nPool: '+POOL_PHOTOS_LINK+'\nRooms: '+ROOM_PHOTOS_LINK+'\nOutdoor / Activities: '+OUTDOOR_PHOTOS_LINK+'\nQR Code: '+QR_CODE_LINK+'\nWebsite (info only): '+WEBSITE+'\nMaps: '+MAPS_LINK;
  }
  if(lower.includes('price')||lower.includes('rate')||lower.includes('cost')||lower.includes('charge')){
    return 'Price depends on date. Please tell me which date and how many guests? Weekday Full Villa Rs.6400, Weekend Rs.8000, Festival Rs.9600. Weekday Separate: 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800.';
  }
  if(isGroup) return 'Pachapp Pool Villa, Meppadi, Wayanad. Full Villa Weekday Rs.6400, Weekend Rs.8000. Which date, how many guests?';
  return 'Welcome to Pachapp Pool Villa, Meppadi, Wayanad! 🌿\n\nPlease tell me which date, how many guests, and what you love in Wayanad - nature, music, food?\n\nPhotos - Drive: '+PHOTOS_LINK+'\nWebsite: '+WEBSITE+'\nMaps: '+MAPS_LINK;
}
async function sendWhatsApp(to, text){
  try{
    const res = await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
      method:'POST',
      headers:{ 'Authorization':`Bearer ${WHATSAPP_TOKEN}`, 'Content-Type':'application/json' },
      body: JSON.stringify({ messaging_product:'whatsapp', to, type:'text', text:{ body: text } })
    });
    const data = await res.json();
    console.log('WhatsApp send status '+res.status+' '+JSON.stringify(data).slice(0,300));
    return { status: res.status, data };
  }catch(e){ console.log('WhatsApp send error '+e.message); return { status:0, data:null }; }
}
async function getMediaUrl(mediaId){
  const r = await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, { headers:{ 'Authorization':`Bearer ${WHATSAPP_TOKEN}` } });
  const j = await r.json();
  return j.url;
}
async function downloadMediaBuffer(url){
  const r = await fetch(url, { headers:{ 'Authorization':`Bearer ${WHATSAPP_TOKEN}` } });
  return Buffer.from(await r.arrayBuffer());
}
async function transcribeVoice(mediaId, mimeType){
  try{
    if(!GROQ_API_KEY) return null;
    const url = await getMediaUrl(mediaId);
    if(!url) return null;
    const buf = await downloadMediaBuffer(url);
    console.log('Voice audio downloaded bytes='+buf.length+' mime='+mimeType);
    const form = new FormData();
    const ext = (mimeType||'').includes('mp4') ? 'mp4' : (mimeType||'').includes('mpeg') ? 'mp3' : 'ogg';
    const blob = new Blob([buf], { type: mimeType || 'audio/ogg' });
    form.append('file', blob, `voice.${ext}`);
    form.append('model', 'whisper-large-v3');
    form.append('response_format', 'json');
    form.append('temperature', '0');
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', { method:'POST', headers:{ 'Authorization':`Bearer ${GROQ_API_KEY}` }, body: form });
    const j = await r.json();
    console.log('Whisper status '+r.status+' text='+(j.text||'').slice(0,200));
    if(j.text) return j.text.trim();
    return null;
  }catch(e){ console.log('Transcribe error '+e.message); return null; }
}
const chatHistories = new Map();
const pendingBookings = new Map();
app.get('/webhook', (req,res)=>{
  const mode=req.query['hub.mode'];
  const token=req.query['hub.verify_token'];
  const challenge=req.query['hub.challenge'];
  if(mode==='subscribe' && token===VERIFY_TOKEN){ console.log('Webhook VERIFIED'); return res.status(200).send(challenge); }
  return res.sendStatus(403);
});
app.get('/', (req,res)=> res.send('Pachapp AI Cloud API + Voice + Drive Photos - LIVE'));
app.get('/health', (req,res)=> res.json({ ok:true, phone: BOT_PHONE }));
app.post('/webhook', async (req,res)=>{
  try{
    const body=req.body;
    if(body.object!=='whatsapp_business_account'){ return res.sendStatus(200); }
    const entry=body.entry?.[0];
    const change=entry?.changes?.[0];
    const value=change?.value;
    const messages=value?.messages;
    if(!messages || messages.length===0){ return res.sendStatus(200); }
    for(const m of messages){
      const from=m.from;
      const type=m.type;
      const senderName = value.contacts?.[0]?.profile?.name || 'Guest';
      console.log(`MESSAGE from ${from} type=${type} name=${senderName}`);
      if(from===OWNER_NUMBER){
        const txt=(m.text?.body||'').toLowerCase().trim();
        if(txt==='yes' || txt==='no' || txt.includes('confirm') || txt.includes('verified')){
          let targetPhone=null, targetBooking=null;
          for(const [phone,b] of pendingBookings){ targetPhone=phone; targetBooking=b; }
          if(targetBooking){
            if(txt==='yes' || txt.includes('confirm') || txt.includes('verified')){
              targetBooking.status='Confirmed';
              await saveToDB(targetBooking);
              await sendWhatsApp(targetBooking.phone, `Booking CONFIRMED - Pachapp Pool Villa! 🎉\n\nDate: ${targetBooking.date}\nGuests: ${targetBooking.guests}\nTotal: ${formatPrice(targetBooking.total)}\nAdvance: ${formatPrice(targetBooking.advance)} received\nBalance before check-in.\n\nMaps: ${MAPS_LINK}\nNearby: ${NEARBY_LINK}\n\nWelcome to Pachapp! 🌿`);
              await sendWhatsApp(from, 'Confirmed to guest '+targetBooking.name);
              pendingBookings.delete(targetPhone);
            } else { await sendWhatsApp(from, 'Not confirmed.'); }
            continue;
          }
        }
      }
      let text='';
      let isVoice=false;
      if(type==='text'){ text=m.text?.body||''; }
      else if(type==='audio' || type==='voice'){
        isVoice=true;
        const mediaId = m.audio?.id || m.voice?.id;
        const mime = m.audio?.mime_type || m.voice?.mime_type || 'audio/ogg';
        console.log('VOICE message mediaId='+mediaId);
        const transcribed = await transcribeVoice(mediaId, mime);
        if(!transcribed){
          await sendWhatsApp(from, 'I heard your voice note, but could not hear clearly. Could you please send again, or type in ENGLISH / Malayalam? 🎙️');
          continue;
        }
        text = transcribed;
        console.log('VOICE transcribed: '+text);
      } else if(type==='image'){
        const caption=m.image?.caption||'';
        const utrMatch=caption.match(/\b\d{10,18}\b/);
        const utr=utrMatch?utrMatch[0]:'Screenshot received';
        const pending={ name:senderName, phone:from, date: pendingBookings.get(from)?.date || 'To confirm', guests: pendingBookings.get(from)?.guests||'', total: pendingBookings.get(from)?.total||0, advance: pendingBookings.get(from)?.advance||0, utr, status:'Pending' };
        pendingBookings.set(from, pending);
        await sendWhatsApp(OWNER_NUMBER, `PAYMENT VERIFICATION NEEDED\nGuest: ${senderName} (${from})\nDate: ${pending.date}\nUTR: ${utr}\nAdvance: ${formatPrice(pending.advance)}\n\nReply YES to confirm, NO to reject.`);
        await sendWhatsApp(from, `Payment screenshot + UTR ${utr} received. ✅\n\nOwner will verify and I will confirm your booking in a moment.`);
        continue;
      } else {
        await sendWhatsApp(from, 'Please send text or voice note - I can answer in Malayalam, Hindi, Tamil, Telugu, Kannada, English. 🎙️');
        continue;
      }
      if(!text) continue;
      const lower=text.toLowerCase();
      const utrInText = text.match(/\b\d{10,18}\b/);
      if(utrInText && (lower.includes('paid') || lower.includes('utr') || lower.includes('payment') || lower.includes('advance'))){
        const utr=utrInText[0];
        const pending={ name:senderName, phone:from, date: pendingBookings.get(from)?.date || 'To confirm', guests: pendingBookings.get(from)?.guests||'', total: pendingBookings.get(from)?.total||0, advance: pendingBookings.get(from)?.advance||0, utr, status:'Pending' };
        pendingBookings.set(from, pending);
        await sendWhatsApp(OWNER_NUMBER, `PAYMENT VERIFICATION NEEDED\nGuest: ${senderName} (${from})\nDate: ${pending.date}\nUTR: ${utr}\nAdvance: ${formatPrice(pending.advance)}\n\nReply YES to confirm, NO to reject.`);
        await sendWhatsApp(from, `Payment screenshot + UTR ${utr} received. ✅\n\nOwner will verify and I will confirm your booking in a moment.`);
        continue;
      }
      if(!chatHistories.has(from)) chatHistories.set(from, []);
      const history=chatHistories.get(from);
      const aiInput = isVoice ? `[voice] ${text}` : text;
      history.push({ role:'user', content: aiInput });
      let reply = await askAI(aiInput, false, history);
      if(!reply){ console.log('AI null, using fallback'); reply=fallbackReply(text, false); }
      else { console.log('AI replied: '+reply.slice(0,100)); }
      history.push({ role:'assistant', content: reply });
      if(history.length>16) chatHistories.set(from, history.slice(-16));
      const parsedDate=parseDate(text);
      if(parsedDate){
        const t=getDateType(text);
        const price=t==='weekday'?PRICING.fullWeekday:t==='weekend'?PRICING.fullWeekend:PRICING.fullFestival;
        pendingBookings.set(from, { name:senderName, phone:from, date:parsedDate.toISOString().slice(0,10), guests:text, total:price, advance:calcAdvance(price), status:'Enquiry' });
      }
      await sendWhatsApp(from, reply);
      if(lower.includes('qr')){
        if(!reply.includes('drive.google.com')){ await sendWhatsApp(from, `QR Code - Drive: ${QR_CODE_LINK}\nWebsite: ${WEBSITE}\nMaps: ${MAPS_LINK}`); }
      }
      if(lower.includes('photo')||lower.includes('video')||lower.includes('pics')||lower.includes('photos')){
        if(!reply.includes('drive.google.com')){
          if(lower.includes('pool')){ await sendWhatsApp(from, `Pool photos - Drive: ${POOL_PHOTOS_LINK} 📸\nAll Photos: ${PHOTOS_LINK}\nMaps: ${MAPS_LINK}`); }
          else if(lower.includes('room')){ await sendWhatsApp(from, `Room photos - Drive: ${ROOM_PHOTOS_LINK} 📸\nAll Photos: ${PHOTOS_LINK}\nMaps: ${MAPS_LINK}`); }
          else if(lower.includes('activit')){ await sendWhatsApp(from, `Activities photos - Drive: ${ACTIVITIES_PHOTOS_LINK} 📸 (in OUTDOOR folder)\nAll Photos: ${PHOTOS_LINK}\nMaps: ${MAPS_LINK}`); }
          else if(lower.includes('outdoor')||lower.includes('outside')){ await sendWhatsApp(from, `Outdoor photos - Drive: ${OUTDOOR_PHOTOS_LINK} 📸\nAll Photos: ${PHOTOS_LINK}\nMaps: ${MAPS_LINK}`); }
          else { await sendWhatsApp(from, `Photos - Drive: ${PHOTOS_LINK} 📸\nPool: ${POOL_PHOTOS_LINK}\nRooms: ${ROOM_PHOTOS_LINK}\nOutdoor / Activities: ${OUTDOOR_PHOTOS_LINK}\nQR Code: ${QR_CODE_LINK}\nWebsite (info only): ${WEBSITE}\nMaps: ${MAPS_LINK}`); }
        }
      }
    }
    return res.sendStatus(200);
  }catch(e){ console.log('Webhook error '+e.message); return res.sendStatus(200); }
});
app.listen(PORT, ()=> console.log('Pachapp AI Cloud API + VOICE + DRIVE PHOTOS LIVE on '+PORT));
