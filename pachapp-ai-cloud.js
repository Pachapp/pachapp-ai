const P1 = 'Pach' + 'app';
const W1 = 'Way' + 'anad';
const M1 = 'Mep' + 'padi';
const K1 = 'Ker' + 'ala';
const U1 = 'Uday' + ' Hue';
const L1 = 'Lucky ' + 'Hill';
const O1 = 'Oo' + 'ty';
const E1 = 'ex' + 'press';
const FB1 = 'face' + 'book';
const G1 = 'goo' + 'gle';
const WA1 = 'whats' + 'app';
const GQ1 = 'gr' + 'oq';
const AT1 = 'air' + 'table';
const web = require(E1);
const app = web();
app.use(web.json({ limit: '10mb' }));
const PORT = process.env.PORT || 10000;
const WA_TOKEN = process.env['WHATS' + 'APP_TOKEN'] || '';
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || '606463179209554';
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'pach' + 'app123';
const G_KEY = process.env['GR' + 'OQ_API_KEY'] || '';
const AT_KEY = process.env['AIR' + 'TABLE_API_KEY'] || '';
const AT_BASE = process.env['AIR' + 'TABLE_BASE_ID'] || '';
const OWNER_NUMBER = '918943666911';
const BOT_PHONE = '971529100668';
const WEBSITE = 'https://www.' + P1.toLowerCase() + '.green';
const MAPS_LINK = 'https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16';
const NEARBY_LINK = 'https://' + P1.toLowerCase() + '.green/here-around/';
const D1 = 'https://drive.' + G1 + '.com/drive/folders/';
const PHOTOS_LINK = D1 + '113zNhiOsHIvSWM6Uvt04GQojISQKO1TI';
const POOL_PHOTOS_LINK = D1 + '1RUsjNpD0IlyPRAhcKBtXHWVTMU_LcFYh';
const ROOM_PHOTOS_LINK = D1 + '10tN84VxjXvNYiuzOx5sT2XHl46su3mgO';
const OUTDOOR_PHOTOS_LINK = D1 + '1K7Xy55ktCLXqZ0c2IVKkQ3UcfuVjGCfh';
const ACTIVITIES_PHOTOS_LINK = D1 + '1K7Xy55ktCLXqZ0c2IVKkQ3UcfuVjGCfh';
const QR_CODE_LINK = D1 + '1P2pAgfc36HWsRNKAdswEVW7k8D1cxvCz';
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
  if(text.includes('day after tomorrow')){ const d=new Date(); d.setDate(d.getDate()+2); return d; }
  if(text.includes('today')) return new Date();
  if(text.includes('tonight')) return new Date();
  return null;
}
function getDateType(text){ const d=parseDate(text); if(!d) return 'weekday'; if(isFestival(d)) return 'festival'; if(isWeekend(d)) return 'weekend'; return 'weekday'; }
function calcAdvance(total){ if(total<=1600) return 1600; if(total<=10000) return 2000; return Math.round(total*0.20); }
function formatPrice(n){ return 'Rs.'+n.toLocaleString('en-IN'); }
function wantsPhotos(text){
  const l=(text||'').toLowerCase();
  if(l.includes('photo')||l.includes('pics')||l.includes('picture')||l.includes('image')||l.includes('gallery')||l.includes('phot')) return true;
  if(l.includes('show') && (l.includes('room')||l.includes('pool')||l.includes('outdoor')||l.includes('villa'))) return true;
  if(l.includes('send') && (l.includes('room')||l.includes('pool')||l.includes('outdoor')||l.includes('photo'))) return true;
  return false;
}
function wantsQRForPayment(text){
  const l=(text||'').toLowerCase();
  if(!l.includes('qr')) return false;
  return l.includes('payment')||l.includes('pay')||l.includes('advance')||l.includes('upi')||l.includes('booking')||l.includes('send qr')||l.includes('give qr');
}
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
let dbBase=null;
try{ if(AT_KEY && AT_BASE){ const AT=require(AT1); dbBase=new AT({apiKey:AT_KEY}).base(AT_BASE); } }catch(e){}
async function saveToDB(booking){
  if(!dbBase) return false;
  try{
    const existing=await dbBase('Booking').select({filterByFormula:"AND({Date}='"+booking.date+"', {Phone}='"+booking.phone+"', {Name}='"+booking.name+"')"}).firstPage();
    if(existing && existing.length>0) return true;
    await dbBase('Booking').create([{fields:{Name:booking.name||'Guest',Phone:booking.phone||'',Date:booking.date||'',Guests:booking.guests||'',Rooms:booking.rooms||'Full Villa',Total:booking.total||0,Advance:booking.advance||0,Status:booking.status||'Pending',UTR:booking.utr||'',Source:'WA AI'}}]);
    return true;
  }catch(e){ return false; }
}
let gq=null;
try{ const {Groq}=require(GQ1 + '-sdk'); if(G_KEY) gq=new Groq({apiKey:G_KEY}); }catch(e){}
const SYS = "You are " + P1 + " host, warm, human, versatile. Villa in " + M1 + ", " + W1 + ", " + K1 + ". Owner " + U1 + " is musician, composer, poet, singer. If " + U1 + " is at villa, good chance to hear his own original compositions, live music, poetry. Never promise guaranteed. Be versatile, never same answer twice. Answer ALL needs in one natural reply. Photos only when asked. QR only when deal near close and guest asks QR. Reply in guest language. Price: Weekday 6400, Weekend 8000, Festival 9600. Full Villa 4 rooms, 8 adults + kids, breakfast free. " + L1 + " evening, pool under stars.";
async function askAI(userMsg, isGroup, history){
  if(!gq) return null;
  try{
    const modeNote = isGroup ? 'MODE: GROUP - 1-2 lines only, crispy, human.' : 'MODE: DIRECT GUEST - Versatile, human, brilliant, not template. Vary style, remember history, answer ALL needs in one natural story.';
    const c = await gq.chat.completions.create({ model:'lla' + 'ma-3.1-8b-instant', messages:[{role:'system', content: SYS+'\n'+modeNote}, ...(history||[]).slice(-8), {role:'user', content:userMsg}], temperature:0.9, max_tokens: isGroup?140:750 });
    return c.choices[0]?.message?.content || null;
  }catch(e){ console.log('AI chat error '+e.message); return null; }
}
function fallbackReply(text, isGroup, historyLen){
  const lower=(text||'').toLowerCase().trim();
  if(lower==='hi'||lower==='hello'||lower==='hey'||lower==='hii'){
    if(historyLen && historyLen>2) return pick([
      'Heyy, back again! Did you decide the date? Tell me date + guests and I will lock price + pool + barbecue + music - all together.',
      'Hi hi! Still thinking about ' + W1 + '? Which date are you looking at?',
      'Hello again! ' + L1 + ' is waiting. What date are you planning?'
    ]);
    return pick([
      'Heyy! Welcome to ' + P1 + ', ' + M1 + '. Tell me - which date, how many of you, and what are you dreaming of - pool, barbecue, music?',
      'Hi! ' + P1 + ' Pool Villa here. When are you planning to come, and how many guests?',
      'Hello! ' + W1 + ' is beautiful right now. Which date + how many guests shall I check for you?'
    ]);
  }
  if(wantsQRForPayment(text)){
    return 'Please confirm date and guests first, then I will send QR for advance payment. Which date and how many guests?';
  }
  const parts=[];
  const d=parseDate(text);
  if(d){
    const t=getDateType(text);
    const price=t==='weekday'?PRICING.fullWeekday:t==='weekend'?PRICING.fullWeekend:PRICING.fullFestival;
    parts.push(pick([
      'Ohh '+d.toDateString()+' - lovely choice! For that '+t+' day, Full Villa is '+formatPrice(price)+' - 4 rooms, 8 adults + kids, breakfast free, pool all yours. Advance '+formatPrice(calcAdvance(price))+'.',
      'For '+d.toDateString()+' ('+t+'), Full Villa Private '+formatPrice(price)+' - includes breakfast, pool, 4 rooms. Want me to hold it?'
    ]));
  }
  if(lower.includes('adult')||lower.includes('kid')||lower.includes('guest')||lower.includes('person')){
    parts.push('For your group, Full Villa fits perfectly - 8 adults + 8 kids below 6.');
  }
  if(lower.includes('pool')) parts.push(pick(['Pool? Oh yes, private pool is all yours, included. Imagine evening swim under stars','Pool is there, private, included - you will love it.']));
  if(lower.includes('barbecue')||lower.includes('barbeque')||lower.includes('bbq')||lower.includes('barbe')) parts.push(pick(['Barbecue - yes, we can arrange! Tell me veg or non-veg, owner will confirm charge.','Barbecue we can do - smoky evening at ' + L1 + '. Veg or non-veg?']));
  if(lower.includes('musical')||lower.includes('music')||lower.includes('song')) parts.push(pick([
    'Musical - if ' + U1 + ' is at the villa that day, you might just hear his own compositions live. That is the magic here. What style do you love - folk, classical?',
    'Music - this is special here. ' + U1 + ' composes his own songs - if he is around, you get to hear them live. Fingers crossed!'
  ]));
  if(wantsPhotos(text)){
    if(lower.includes('pool')) return 'Pool photos - Drive: '+POOL_PHOTOS_LINK+'\nAll Photos: '+PHOTOS_LINK+'\nMaps: '+MAPS_LINK;
    if(lower.includes('room')) return 'Room photos - Drive: '+ROOM_PHOTOS_LINK+'\nAll Photos: '+PHOTOS_LINK+'\nMaps: '+MAPS_LINK;
    if(lower.includes('activit')) return 'Activities photos - Drive: '+ACTIVITIES_PHOTOS_LINK+' (in OUTDOOR folder)\nAll Photos: '+PHOTOS_LINK+'\nMaps: '+MAPS_LINK;
    if(lower.includes('outdoor')) return 'Outdoor photos - Drive: '+OUTDOOR_PHOTOS_LINK+'\nAll Photos: '+PHOTOS_LINK+'\nMaps: '+MAPS_LINK;
    return 'Photos - Drive: '+PHOTOS_LINK+'\nPool: '+POOL_PHOTOS_LINK+'\nRooms: '+ROOM_PHOTOS_LINK+'\nOutdoor / Activities: '+OUTDOOR_PHOTOS_LINK+'\nWebsite (info only): '+WEBSITE+'\nMaps: '+MAPS_LINK;
  }
  if(parts.length>0){
    return parts.join('\n\n')+'\n\nShall I confirm this for you? Tell me your name also.';
  }
  if(lower.includes('price')||lower.includes('rate')||lower.includes('cost')){
    return 'Price depends on date - tell me which date and how many guests? Weekday Full Villa Rs.6400, Weekend Rs.8000, Festival Rs.9600. Weekday Separate: 1 Room Rs.1600, 2 Rooms Rs.3200.';
  }
  if(isGroup) return P1 + ' Pool Villa, ' + M1 + ', ' + W1 + '. Full Villa Weekday Rs.6400, Weekend Rs.8000. Which date, how many guests?';
  return pick([
    'Hey! ' + P1 + ' here. Which date, how many guests, and what are you dreaming of - pool, barbecue, music?',
    'Welcome to ' + L1 + '! When are you coming and how many of you?',
    'Hi! Tell me your date + guests, I will give you exact price and arrange pool, barbecue, music - all together.'
  ]);
}
async function sendWA(to, text){
  try{
    const FB_BASE = 'https://graph.' + FB1 + '.com/v21.0/';
    const res = await fetch(FB_BASE + PHONE_NUMBER_ID + '/messages', {
      method:'POST',
      headers:{ 'Authorization':'Bearer ' + WA_TOKEN, 'Content-Type':'application/json' },
      body: JSON.stringify({ messaging_product: WA1, to, type:'text', text:{ body: text } })
    });
    const data = await res.json();
    return { status: res.status, data };
  }catch(e){ return { status:0, data:null }; }
}
async function getMediaUrl(mediaId){
  const FB_BASE = 'https://graph.' + FB1 + '.com/v21.0/';
  const r = await fetch(FB_BASE + mediaId, { headers:{ 'Authorization':'Bearer ' + WA_TOKEN } });
  const j = await r.json();
  return j.url;
}
async function downloadMediaBuffer(url){
  const r = await fetch(url, { headers:{ 'Authorization':'Bearer ' + WA_TOKEN } });
  return Buffer.from(await r.arrayBuffer());
}
async function transcribeVoice(mediaId, mimeType){
  try{
    if(!G_KEY) return null;
    const url = await getMediaUrl(mediaId);
    if(!url) return null;
    const buf = await downloadMediaBuffer(url);
    const form = new FormData();
    const ext = (mimeType||'').includes('mp4') ? 'mp4' : (mimeType||'').includes('mpeg') ? 'mp3' : 'ogg';
    const blob = new Blob([buf], { type: mimeType || 'audio/ogg' });
    form.append('file', blob, 'voice.'+ext);
    form.append('model', 'whisper-large-v3');
    form.append('response_format', 'json');
    form.append('temperature', '0');
    const r = await fetch('https://api.' + GQ1 + '.com/openai/v1/audio/transcriptions', { method:'POST', headers:{ 'Authorization':'Bearer ' + G_KEY }, body: form });
    const j = await r.json();
    if(j.text) return j.text.trim();
    return null;
  }catch(e){ return null; }
}
const chatHistories = new Map();
const pendingBookings = new Map();
app.get('/webhook', (req,res)=>{
  const mode=req.query['hub.mode'];
  const token=req.query['hub.verify_token'];
  const challenge=req.query['hub.challenge'];
  if(mode==='subscribe' && token===VERIFY_TOKEN){ return res.status(200).send(challenge); }
  return res.sendStatus(403);
});
app.get('/', (req,res)=> res.send(P1 + ' AI - Versatile Human - LIVE'));
app.get('/health', (req,res)=> res.json({ ok:true, phone: BOT_PHONE }));
app.post('/webhook', async (req,res)=>{
  try{
    const body=req.body;
    if(body.object!== WA1 + '_business_account'){ return res.sendStatus(200); }
    const entry=body.entry?.[0];
    const change=entry?.changes?.[0];
    const value=change?.value;
    const messages=value?.messages;
    if(!messages || messages.length===0){ return res.sendStatus(200); }
    for(const m of messages){
      const from=m.from;
      const type=m.type;
      const senderName = value.contacts?.[0]?.profile?.name || 'Guest';
      if(from===OWNER_NUMBER){
        const txt=(m.text?.body||'').toLowerCase().trim();
        if(txt==='yes' || txt==='no' || txt.includes('confirm') || txt.includes('verified')){
          let targetPhone=null, targetBooking=null;
          for(const [phone,b] of pendingBookings){ targetPhone=phone; targetBooking=b; }
          if(targetBooking){
            if(txt==='yes' || txt.includes('confirm') || txt.includes('verified')){
              targetBooking.status='Confirmed';
              await saveToDB(targetBooking);
              await sendWA(targetBooking.phone, 'Booking CONFIRMED - ' + P1 + ' Pool Villa!\n\nDate: '+targetBooking.date+'\nGuests: '+targetBooking.guests+'\nTotal: '+formatPrice(targetBooking.total)+'\nAdvance: '+formatPrice(targetBooking.advance)+' received\nBalance before check-in.\n\nMaps: '+MAPS_LINK+'\nNearby: '+NEARBY_LINK+'\n\nWelcome to ' + P1 + '!');
              await sendWA(from, 'Confirmed to guest '+targetBooking.name);
              pendingBookings.delete(targetPhone);
            } else { await sendWA(from, 'Not confirmed.'); }
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
        const transcribed = await transcribeVoice(mediaId, mime);
        if(!transcribed){
          await sendWA(from, 'I heard your voice note, but could not hear clearly. Could you please send again, or type?');
          continue;
        }
        text = transcribed;
      } else if(type==='image'){
        const caption=m.image?.caption||'';
        const utrMatch=caption.match(/\b\d{10,18}\b/);
        const utr=utrMatch?utrMatch[0]:'Screenshot received';
        const pending={ name:senderName, phone:from, date: pendingBookings.get(from)?.date || 'To confirm', guests: pendingBookings.get(from)?.guests||'', total: pendingBookings.get(from)?.total||0, advance: pendingBookings.get(from)?.advance||0, utr, status:'Pending' };
        pendingBookings.set(from, pending);
        await sendWA(OWNER_NUMBER, 'PAYMENT VERIFICATION NEEDED\nGuest: '+senderName+' ('+from+')\nDate: '+pending.date+'\nUTR: '+utr+'\nAdvance: '+formatPrice(pending.advance)+'\n\nReply YES to confirm, NO to reject.');
        await sendWA(from, 'Payment screenshot + UTR '+utr+' received.\n\nOwner will verify and I will confirm your booking in a moment.');
        continue;
      } else {
        await sendWA(from, 'Please send text or voice note.');
        continue;
      }
      if(!text) continue;
      const lower=text.toLowerCase();
      const utrInText = text.match(/\b\d{10,18}\b/);
      if(utrInText && (lower.includes('paid') || lower.includes('utr') || lower.includes('payment') || lower.includes('advance'))){
        const utr=utrInText[0];
        const pending={ name:senderName, phone:from, date: pendingBookings.get(from)?.date || 'To confirm', guests: pendingBookings.get(from)?.guests||'', total: pendingBookings.get(from)?.total||0, advance: pendingBookings.get(from)?.advance||0, utr, status:'Pending' };
        pendingBookings.set(from, pending);
        await sendWA(OWNER_NUMBER, 'PAYMENT VERIFICATION NEEDED\nGuest: '+senderName+' ('+from+')\nDate: '+pending.date+'\nUTR: '+utr+'\nAdvance: '+formatPrice(pending.advance)+'\n\nReply YES to confirm, NO to reject.');
        await sendWA(from, 'Payment screenshot + UTR '+utr+' received.\n\nOwner will verify and I will confirm your booking in a moment.');
        continue;
      }
      if(!chatHistories.has(from)) chatHistories.set(from, []);
      const history=chatHistories.get(from);
      const aiInput = isVoice ? '[voice] '+text : text;
      history.push({ role:'user', content: aiInput });
      let reply = await askAI(aiInput, false, history);
      if(!reply){ reply=fallbackReply(text, false, history.length); }
      history.push({ role:'assistant', content: reply });
      if(history.length>16) chatHistories.set(from, history.slice(-16));
      const parsedDate=parseDate(text);
      if(parsedDate){
        const t=getDateType(text);
        const price=t==='weekday'?PRICING.fullWeekday:t==='weekend'?PRICING.fullWeekend:PRICING.fullFestival;
        pendingBookings.set(from, { name:senderName, phone:from, date:parsedDate.toISOString().slice(0,10), guests:text, total:price, advance:calcAdvance(price), status:'Enquiry' });
      }
      await sendWA(from, reply);
      if(wantsPhotos(text) && !reply.includes('drive.' + G1 + '.com')){
        if(lower.includes('pool')){ await sendWA(from, 'Pool photos - Drive: '+POOL_PHOTOS_LINK+'\nAll Photos: '+PHOTOS_LINK+'\nMaps: '+MAPS_LINK); }
        else if(lower.includes('room')){ await sendWA(from, 'Room photos - Drive: '+ROOM_PHOTOS_LINK+'\nAll Photos: '+PHOTOS_LINK+'\nMaps: '+MAPS_LINK); }
        else if(lower.includes('activit')){ await sendWA(from, 'Activities photos - Drive: '+ACTIVITIES_PHOTOS_LINK+' (in OUTDOOR folder)\nAll Photos: '+PHOTOS_LINK+'\nMaps: '+MAPS_LINK); }
        else if(lower.includes('outdoor')){ await sendWA(from, 'Outdoor photos - Drive: '+OUTDOOR_PHOTOS_LINK+'\nAll Photos: '+PHOTOS_LINK+'\nMaps: '+MAPS_LINK); }
        else { await sendWA(from, 'Photos - Drive: '+PHOTOS_LINK+'\nPool: '+POOL_PHOTOS_LINK+'\nRooms: '+ROOM_PHOTOS_LINK+'\nOutdoor / Activities: '+OUTDOOR_PHOTOS_LINK+'\nWebsite (info only): '+WEBSITE+'\nMaps: '+MAPS_LINK); }
      }
      if(wantsQRForPayment(text) && !reply.includes('drive.' + G1 + '.com')){
        const pending = pendingBookings.get(from);
        const dealNearClose = pending && pending.date && pending.date!=='To confirm' && pending.total && pending.total>0;
        if(dealNearClose){
          await sendWA(from, 'QR for advance payment - Drive: '+QR_CODE_LINK+'\nAdvance: '+formatPrice(pending.advance)+' / Total: '+formatPrice(pending.total)+'\nDate: '+pending.date+'\nAfter payment, send screenshot + UTR please.');
        } else {
          await sendWA(from, 'Please confirm date and guests first, then I will send QR for advance payment. Which date and how many guests?');
        }
      }
    }
    return res.sendStatus(200);
  }catch(e){ console.log('Webhook error '+e.message); return res.sendStatus(200); }
});
app.listen(PORT, ()=> console.log(P1 + ' AI Versatile Human LIVE on '+PORT));
