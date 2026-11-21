const http = require('http');
const fs = require('fs');
const path = require('path');
const Airtable = require('airtable');
const PORT = process.env.PORT || 10000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'pachapp123';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const OWNER_NUMBER = '918943666911';
const VILLA_NAME = 'Pachapp Pool Villa';
const MAPS_LINK = 'https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16';
const FORM_URL = (process.env.RENDER_EXTERNAL_URL ? process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '') + '/booking-form.html' : 'https://pachapp-ai-1.onrender.com/booking-form.html');
console.log('FORM_URL = ' + FORM_URL);
const PRICING = { fullWeekday: 6400, fullWeekend: 8000, extraAdult: 800, kidsHalf: 400, breakfast: 100 };
function parseDate(text){ if(!text) return null; text=text.toLowerCase().trim(); const months={jan:0,january:0,feb:1,february:1,mar:2,march:2,apr:3,april:3,may:4,jun:5,june:5,jul:6,july:6,aug:7,august:7,sep:8,sept:8,september:8,oct:9,october:9,nov:10,november:10,dec:11,december:11}; let m; m=text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/); if(m) return new Date(parseInt(m[1]),parseInt(m[2])-1,parseInt(m[3])); m=text.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)/); if(m&&months[m[2]]!==undefined){const now=new Date();let y=now.getFullYear();let d=new Date(y,months[m[2]],parseInt(m[1]));if(d<now)d=new Date(y+1,months[m[2]],parseInt(m[1]));return d;} m=text.match(/([a-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?/); if(m&&months[m[1]]!==undefined){const now=new Date();let y=now.getFullYear();let d=new Date(y,months[m[1]],parseInt(m[2]));if(d<now)d=new Date(y+1,months[m[1]],parseInt(m[2]));return d;} if(text.includes('tomorrow')){const d=new Date();d.setDate(d.getDate()+1);return d;} if(text.includes('today')) return new Date(); return null; }
function isWeekend(d){const day=d.getDay();return day===5||day===6||day===0;}
function getDateType(text){const d=parseDate(text);if(!d)return 'weekday';if(isWeekend(d))return 'weekend';return 'weekday';}
function calcAdvance(total){if(total<=1600)return 1600;if(total<=10000)return 2000;return Math.round(total*0.20);}
function formatPrice(n){return 'Rs.'+n.toLocaleString('en-IN');}
let airtableBase=null; if(process.env.AIRTABLE_API_KEY&&process.env.AIRTABLE_BASE_ID){try{airtableBase=new Airtable({apiKey:process.env.AIRTABLE_API_KEY}).base(process.env.AIRTABLE_BASE_ID);}catch(e){}}
async function saveToAirtable(b){if(!airtableBase)return false;try{await airtableBase('Booking').create([{fields:{Name:b.name||'Guest',Phone:b.phone||'',Date:b.date||'',Guests:b.guests||'',Rooms:b.rooms||'Full Villa',Total:b.total||0,Advance:b.advance||0,Status:b.status||'Pending',UTR:b.utr||'',Source:'WhatsApp AI'}}]);return true;}catch(e){return false;}}
let groq=null; try{const {Groq}=require('groq-sdk'); if(process.env.GROQ_API_KEY) groq=new Groq({apiKey:process.env.GROQ_API_KEY});}catch(e){}
const SYSTEM_PROMPT = `You are Pachapp Pool Villa AI Host - humane, warm. Villa: Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. RULES: Answer REAL answer FIRST, then ask date, guests. NEVER price without date. Reply in guest language. DIRECT: elaborated humane. PRICING LOCKED: Full Villa Weekday Rs.6400, Weekend Fri/Sat/Sun Rs.8000, Includes 4 rooms, 8 adults + 8 kids below 6, Breakfast FREE. Extra adult Rs.800. Kids below 6 FREE, Kids 6-12 Rs.400 per night. Rooms Rs.1600 per room per night, Extra adult = Adults - (Rooms x 2), Breakfast Rs.100 per person per night. Rooms follow Adults only, Kids 6-12 do NOT change rooms or nights. ADVANCE: 1 Room 1 Night Adults <=2 = Rs.1600, Total up to Rs.10000 = Rs.2000, else 20%. Pay to 0091 996 191 7169, Name UDAYABHANU. FORM: When guest says booking form / want book / book straight, send FORM link once. FORM_URL = ` + FORM_URL;
async function askAI(userMsg,history){if(!groq)return null;try{const c=await groq.chat.completions.create({model:'llama-3.1-8b-instant',messages:[{role:'system',content:SYSTEM_PROMPT},...(history||[]).slice(-8),{role:'user',content:userMsg}],temperature:0.7,max_tokens:600});return c.choices[0]?.message?.content||null;}catch(e){console.log('Groq error',e.message);return null;}}
function fallbackReply(text){ const lower=text.toLowerCase(); const hasDate=parseDate(text); if(lower.includes('booking form')||lower.includes('give me form')||lower.includes('want book')||lower.includes('book straight')||lower.includes('book now')){return 'Here is your booking form 💚\n\n'+FORM_URL+'\n\nFill Check-in + Nights + Guests, Pay Advance to 0091 996 191 7169 (UDAYABHANU), enter UTR. I will confirm.';} if(lower.includes('pool')){return 'Yes! Private pool just for you - no sharing. 🏊\n\nWhich date? How many guests?';} if(lower.includes('price')||lower.includes('rate')||lower.includes('cost')){if(!hasDate){return 'Price depends on date 😊\n\nFull Villa: Weekday Rs.6400, Weekend Fri/Sat/Sun Rs.8000 (Breakfast FREE)\nRooms: 1 Room Rs.1600 per night\n\nWhich date? How many guests?\n\nOr book directly: '+FORM_URL;}const type=getDateType(text);const price=type==='weekday'?PRICING.fullWeekday:PRICING.fullWeekend;return 'For '+text+' - '+type+' - Full Villa '+formatPrice(price)+' ✨\n\nPrivate villa, 4 rooms, pool, Breakfast FREE, 8 adults + 8 kids below 6. Extra Rs.800.\n\nAdvance '+formatPrice(calcAdvance(price))+'.\n\nBook here: '+FORM_URL;} return 'Welcome to Pachapp Pool Villa! 🌿🏊\n\nLucky Hill, Meppadi, Wayanad - private villa, pool, 4 rooms.\n\nWhich date? How many guests?\n\nBook directly: '+FORM_URL; }
async function sendWhatsApp(to, text){
  if(!WHATSAPP_TOKEN || !PHONE_NUMBER_ID){ console.log('No WHATSAPP_TOKEN or PHONE_NUMBER_ID'); return; }
  try{
    const res = await fetch('https://graph.facebook.com/v21.0/' + PHONE_NUMBER_ID + '/messages', { method:'POST', headers:{'Authorization':'Bearer '+WHATSAPP_TOKEN,'Content-Type':'application/json'}, body: JSON.stringify({messaging_product:'whatsapp', to: to, type:'text', text:{preview_url:true, body: text}}) });
    const data = await res.json(); if(!res.ok) console.log('Send error', JSON.stringify(data));
  }catch(e){ console.log('Send error', e.message); }
}
const chatHistories=new Map(); const pendingBookings=new Map();
const server=http.createServer(async(req,res)=>{
  const url = new URL(req.url, 'http://localhost');
  if(url.pathname==='/health'){ res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify({status:'ok',villa:VILLA_NAME,method:'Meta Cloud API',form_url:FORM_URL,has_token:!!WHATSAPP_TOKEN,has_phone_id:!!PHONE_NUMBER_ID})); return; }
  if(url.pathname==='/webhook' && req.method==='GET'){
    const mode=url.searchParams.get('hub.mode'); const token=url.searchParams.get('hub.verify_token'); const challenge=url.searchParams.get('hub.challenge');
    if(mode==='subscribe' && token===VERIFY_TOKEN){ res.writeHead(200,{'Content-Type':'text/plain'}); res.end(challenge); return; }
    res.writeHead(403); res.end('Forbidden'); return;
  }
  if(url.pathname==='/webhook' && req.method==='POST'){
    let body=''; req.on('data',c=>body+=c); req.on('end', async()=>{
      try{
        const data=JSON.parse(body);
        const entry=data.entry?.[0]; const change=entry?.changes?.[0]; const value=change?.value;
        const msg=value?.messages?.[0];
        if(msg && msg.type==='text'){
          const from=msg.from; const text=msg.text?.body||''; const lower=text.toLowerCase();
          console.log('Msg '+from+': '+text.slice(0,100));
          if(from===OWNER_NUMBER && (lower.trim()==='yes'||lower.includes('confirm'))){ let tp=null,tb=null; for(const [ph,b] of pendingBookings){tp=ph;tb=b;} if(tb){ tb.status='Confirmed'; await saveToAirtable(tb); await sendWhatsApp(tb.phone,'Booking CONFIRMED - Pachapp Pool Villa! 🎉\n\nDate: '+tb.date+'\nTotal: '+formatPrice(tb.total)+'\nAdvance received\n\nMaps: '+MAPS_LINK); await sendWhatsApp(from,'Confirmed to guest '+tb.name); pendingBookings.delete(tp);} res.writeHead(200); res.end('EVENT_RECEIVED'); return; }
          if(lower.includes('booking form')||lower.includes('give me form')||lower.includes('want book')||lower.includes('book straight')||lower.includes('book now')){
            await sendWhatsApp(from,'Pachapp Pool Villa - Booking Form 💚\n\n'+FORM_URL+'\n\nFill Check-in + Nights + Guests, Pay Advance to 0091 996 191 7169 (UDAYABHANU), enter UTR. I will confirm.');
            res.writeHead(200); res.end('EVENT_RECEIVED'); return;
          }
          if(!chatHistories.has(from)) chatHistories.set(from,[]);
          const history=chatHistories.get(from); history.push({role:'user',content:text});
          let reply=await askAI(text,history); if(!reply) reply=fallbackReply(text);
          history.push({role:'assistant',content:reply}); if(history.length>16) chatHistories.set(from,history.slice(-16));
          const pd=parseDate(text); if(pd){const type=getDateType(text);const price=type==='weekday'?PRICING.fullWeekday:PRICING.fullWeekend;pendingBookings.set(from,{name:'Guest',phone:from,chatId:from,date:pd.toISOString().slice(0,10),guests:text,total:price,advance:calcAdvance(price),status:'Enquiry'});}
          await sendWhatsApp(from, reply);
        }
      }catch(e){ console.log('Webhook error', e.message); }
      res.writeHead(200); res.end('EVENT_RECEIVED');
    }); return;
  }
  if(url.pathname==='/booking-form.html' || url.pathname==='/form'){
    const filePath=path.join(__dirname,'booking-form.html');
    if(fs.existsSync(filePath)){ res.writeHead(200,{'Content-Type':'text/html'}); fs.createReadStream(filePath).pipe(res); return; }
    res.writeHead(404,{'Content-Type':'text/plain'}); res.end('File not found: booking-form.html - Upload to GitHub root.'); return;
  }
  if(url.pathname==='/Pachapp_1.png'){
    const filePath=path.join(__dirname,'Pachapp_1.png');
    if(fs.existsSync(filePath)){ res.writeHead(200,{'Content-Type':'image/png'}); fs.createReadStream(filePath).pipe(res); return; }
    res.writeHead(404); res.end('Not found'); return;
  }
  res.writeHead(200,{'Content-Type':'text/plain'}); res.end('Pachapp AI Running - Meta Cloud API - /health - /webhook - /booking-form.html - FORM_URL='+FORM_URL);
});
server.listen(PORT,()=>console.log('Health on '+PORT+' FORM_URL='+FORM_URL+' Meta Cloud API'));
