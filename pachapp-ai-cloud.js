const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, jidNormalizedUser, downloadMediaMessage } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const http = require('http');
const fs = require('fs');
const path = require('path');
const Airtable = require('airtable');
const pino = require('pino');
const PORT = process.env.PORT || 10000;
const OWNER_NUMBER = '918943666911';
const BOT_PHONE = '971529100668';
const VILLA_NAME = 'Pachapp Pool Villa';
const MAPS_LINK = 'https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16';
const FORM_URL = process.env.FORM_URL || (process.env.RENDER_EXTERNAL_URL ? process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '') + '/booking-form.html' : 'https://pachapp-ai-1.onrender.com/booking-form.html');
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
const SYSTEM_PROMPT = `You are Pachapp Pool Villa AI Host - humane, warm. Villa: Pachapp Pool Villa, Lucky Hill, Meppadi, Wayanad. RULES: Answer REAL answer FIRST, then ask date, guests. NEVER price without date. Reply in guest language. GROUP: 1-2 lines only. DIRECT: elaborated humane. PRICING LOCKED: Full Villa Weekday Rs.6400, Weekend Fri/Sat/Sun Rs.8000, Includes 4 rooms, 8 adults + 8 kids below 6, Breakfast FREE. Extra adult Rs.800. Kids below 6 FREE, Kids 6-12 Rs.400 per night. Rooms Rs.1600 per room per night, Extra adult = Adults - (Rooms x 2), Breakfast Rs.100 per person per night. Rooms follow Adults only, Kids 6-12 do NOT change rooms or nights. ADVANCE: 1 Room 1 Night Adults <=2 = Rs.1600, Total up to Rs.10000 = Rs.2000, else 20%. Pay to 0091 996 191 7169, Name UDAYABHANU. FORM: When guest says booking form / want book / book straight, send FORM link once. FORM_URL = ` + FORM_URL;
async function askAI(userMsg,isGroup,history){if(!groq)return null;try{const mode=isGroup?'MODE: GROUP - 1-2 lines only.':'MODE: DIRECT - Elaborated humane.';const c=await groq.chat.completions.create({model:'llama-3.1-8b-instant',messages:[{role:'system',content:SYSTEM_PROMPT+'\n'+mode},...(history||[]).slice(-8),{role:'user',content:userMsg}],temperature:0.7,max_tokens:isGroup?120:600});return c.choices[0]?.message?.content||null;}catch(e){console.log('Groq error',e.message);return null;}}
function fallbackReply(text,isGroup){ const lower=text.toLowerCase(); const hasDate=parseDate(text); if(lower.includes('booking form')||lower.includes('give me form')||lower.includes('want book')||lower.includes('book straight')||lower.includes('book now')){return 'Here is your booking form 💚\n\n'+FORM_URL+'\n\nFill Check-in + Nights + Guests, Pay Advance to 0091 996 191 7169 (UDAYABHANU), enter UTR. I will confirm.';} if(lower.includes('pool')){if(isGroup)return 'Yes, private pool, 4 rooms, full villa private. Which date? How many guests?';return 'Yes! Private pool just for you - no sharing. 🏊\n\nWhich date? How many guests?';} if(lower.includes('price')||lower.includes('rate')||lower.includes('cost')){if(!hasDate){if(isGroup)return 'Price depends on date - weekday / weekend different. Which date? How many guests?';return 'Price depends on date 😊\n\nFull Villa: Weekday Rs.6400, Weekend Fri/Sat/Sun Rs.8000 (Breakfast FREE)\nRooms: 1 Room Rs.1600 per night\n\nWhich date? How many guests?\n\nOr book directly: '+FORM_URL;}const type=getDateType(text);const price=type==='weekday'?PRICING.fullWeekday:PRICING.fullWeekend;if(isGroup)return type+' - Full Villa '+formatPrice(price)+', Breakfast FREE.';return 'For '+text+' - '+type+' - Full Villa '+formatPrice(price)+' ✨\n\nPrivate villa, 4 rooms, pool, Breakfast FREE, 8 adults + 8 kids below 6. Extra Rs.800.\n\nAdvance '+formatPrice(calcAdvance(price))+'.\n\nBook here: '+FORM_URL;} if(isGroup)return 'Pachapp Pool Villa, Meppadi, Wayanad - Private villa, pool, 4 rooms. Which date? How many guests?'; return 'Welcome to Pachapp Pool Villa! 🌿🏊\n\nLucky Hill, Meppadi, Wayanad - private villa, pool, 4 rooms.\n\nWhich date? How many guests?\n\nBook directly: '+FORM_URL; }
let lastQR=null; let lastPairCode=null; let isReady=false; let sock=null;
const server=http.createServer(async(req,res)=>{
  if(req.url==='/health'){res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'ok',villa:VILLA_NAME,ready:isReady,form_url:FORM_URL,method:'Baileys - No Chrome'}));return;}
  if(req.url==='/form'||req.url==='/booking-form'){res.writeHead(302,{Location:'/booking-form.html'});res.end();return;}
  if(req.url==='/booking-form.html'||req.url==='/Pachapp_1.png'||req.url==='/qr.png'){ const fileName=req.url==='/booking-form.html'?'booking-form.html':(req.url.toLowerCase().includes('pachapp')?'Pachapp_1.png':'qr.png'); const filePath=path.join(__dirname,fileName); if(fs.existsSync(filePath)){const ext=path.extname(fileName).toLowerCase();const type=ext==='.html'?'text/html':'image/png';res.writeHead(200,{'Content-Type':type});fs.createReadStream(filePath).pipe(res);return;} res.writeHead(404,{'Content-Type':'text/plain'});res.end('File not found: '+fileName+' - Upload to GitHub root.');return; }
  if(req.url==='/qr'||req.url==='/pair'){ if(isReady){res.writeHead(200,{'Content-Type':'text/html'});res.end('<h2 style="text-align:center;font-family:sans-serif">Already Linked! Bot Ready - Baileys.</h2>');return;} let pairHtml=''; if(lastPairCode){pairHtml='<div style="border:3px solid green;padding:20px;margin:20px;background:#eaffea"><h1 style="font-size:50px;letter-spacing:8px">'+lastPairCode+'</h1><p><b>Pairing Code</b><br>On BOT phone 0529100668: WA - Linked Devices - Link with phone number - Enter this code</p></div>';} else {pairHtml='<p>Pairing code loading... Refresh in 20 sec.</p>';} let qrHtml=''; if(lastQR){try{const qrImage=await QRCode.toDataURL(lastQR,{width:350,margin:2});qrHtml='<p><b>SCAN QR:</b></p><img src="'+qrImage+'" style="width:320px;height:320px;border:2px solid #000"/>';}catch(e){}} else {qrHtml='<p>QR loading... Refresh.</p>';} res.writeHead(200,{'Content-Type':'text/html'});res.end('<html><body style="text-align:center;font-family:sans-serif"><h2>Pachapp - Link Bot (Baileys - No Chrome)</h2>'+pairHtml+qrHtml+'<p><a href="/qr">Refresh</a></p></body></html>');return; }
  res.writeHead(200,{'Content-Type':'text/plain'});res.end('Pachapp AI Running - Baileys No Chrome - /qr to link - /booking-form.html - FORM_URL='+FORM_URL);
});
server.listen(PORT,()=>console.log('Health on '+PORT+' FORM_URL='+FORM_URL+' Baileys No Chrome'));
const chatHistories=new Map(); const pendingBookings=new Map();
async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  const { version } = await fetchLatestBaileysVersion();
  sock = makeWASocket({ version, auth: state, printQRInTerminal: false, logger: pino({level:'silent'}), browser: ['Pachapp AI','Chrome','1.0'] });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update)=>{
    const { connection, lastDisconnect, qr } = update;
    if(qr){ lastQR=qr; console.log('QR - Open /qr'); }
    if(connection==='open'){ isReady=true; lastQR=null; lastPairCode=null; console.log('Ready - Baileys No Chrome - FORM_URL='+FORM_URL); }
    if(connection==='close'){ isReady=false; const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut; console.log('Closed, reconnect?', shouldReconnect); if(shouldReconnect) startBot(); }
  });
  setTimeout(async()=>{
    try{ if(!isReady && sock && !sock.authState.creds.registered){ const code = await sock.requestPairingCode(BOT_PHONE.replace(/[^0-9]/g,'')); lastPairCode=code; console.log('Pairing Code: '+code); } }catch(e){ console.log('Pairing code error', e.message); }
  }, 5000);
  sock.ev.on('messages.upsert', async ({ messages })=>{
    for(const msg of messages){
      try{
        if(!msg.message || msg.key.fromMe) continue;
        const jid = msg.key.remoteJid;
        if(jid==='status@broadcast') continue;
        const isGroup = jid.endsWith('@g.us');
        const senderNumber = jid.replace('@s.whatsapp.net','').replace('@c.us','');
        const senderName = msg.pushName || 'Guest';
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || '';
        const lower = text.toLowerCase();
        console.log('Msg '+senderName+': '+text.slice(0,100));
        if(senderNumber===OWNER_NUMBER && (lower.trim()==='yes'||lower.includes('confirm'))){ let tp=null,tb=null; for(const [ph,b] of pendingBookings){tp=ph;tb=b;} if(tb){ tb.status='Confirmed'; await saveToAirtable(tb); try{ await sock.sendMessage(tb.chatId,{text:'Booking CONFIRMED - Pachapp Pool Villa! 🎉\n\nDate: '+tb.date+'\nTotal: '+formatPrice(tb.total)+'\nAdvance received\n\nMaps: '+MAPS_LINK}); }catch(e){} await sock.sendMessage(jid,{text:'Confirmed to guest '+tb.name}); pendingBookings.delete(tp);} return; }
        if(!isGroup && (lower.includes('booking form')||lower.includes('give me form')||lower.includes('want book')||lower.includes('book straight')||lower.includes('book now'))){
          const cap='Pachapp Pool Villa - Booking Form 💚\n\n'+FORM_URL+'\n\nFill Check-in + Nights + Guests, Pay Advance to 0091 996 191 7169 (UDAYABHANU), enter UTR. I will confirm.';
          try{ const imgPath=path.join(__dirname,'Pachapp_1.png'); if(fs.existsSync(imgPath)){ await sock.sendMessage(jid,{image:fs.readFileSync(imgPath),caption:cap}); } else { await sock.sendMessage(jid,{text:cap}); } }catch(e){ await sock.sendMessage(jid,{text:cap}); }
          continue;
        }
        if(!chatHistories.has(jid)) chatHistories.set(jid,[]);
        const history=chatHistories.get(jid); history.push({role:'user',content:text});
        let reply=await askAI(text,isGroup,history); if(!reply) reply=fallbackReply(text,isGroup);
        history.push({role:'assistant',content:reply}); if(history.length>16) chatHistories.set(jid,history.slice(-16));
        const pd=parseDate(text); if(pd){const type=getDateType(text);const price=type==='weekday'?PRICING.fullWeekday:PRICING.fullWeekend;pendingBookings.set(senderNumber,{name:senderName,phone:senderNumber,chatId:jid,date:pd.toISOString().slice(0,10),guests:text,total:price,advance:calcAdvance(price),status:'Enquiry'});}
        await sock.sendMessage(jid,{text:reply});
      }catch(e){ console.log('Message error', e.message); }
    }
  });
}
startBot();
