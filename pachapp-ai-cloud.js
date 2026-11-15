const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const Groq = require('groq-sdk');
const Airtable = require('airtable');
const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;
app.get('/', (req, res) => res.send('Pachapp AI is running'));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.listen(PORT, () => console.log('Health server on ' + PORT));
const GROQ_API_KEY = process.env.GROQ_API_KEY || 'YOUR_GROQ_KEY';
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const OWNER_NUMBER = '919843666911';
const TEST_NUMBER = '971503672246';
const TEST_ONLY = false;
const groq = new Groq({ apiKey: GROQ_API_KEY });
let base = null;
if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
  try { base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID); } catch(e){ console.log('Airtable error ' + e.message); }
}
const VILLA = { address: 'Pachapp Pool Villa, Lucky Hill, Ooty Road, Meppadi, Wayanad, Kerala, India', maps: 'https://maps.app.goo.gl/i3ZFz9F2SRTQs6C16', website: 'www.pachapp.green' };
function getAdvance(total, rooms){ if(rooms===1) return 1600; if(total > 10000) return Math.round(total * 0.20); return 2000; }
async function addBooking(obj){
  if(!base) return {skipped:true};
  try{
    const existing = await base('Booking').select({ filterByFormula: "AND({Date} = '" + obj.date + "', {Phone} = '" + obj.phone + "')" }).firstPage();
    if(existing.length>0){ return {duplicate:true}; }
    const rec = await base('Booking').create([{ fields: { Name:obj.name, Phone:obj.phone, Date:obj.date, Guests:obj.guests, Price:obj.price, Advance:obj.advance, Balance:obj.balance, Status:'Confirmed', Type:obj.type||'WhatsApp' } }]);
    return {duplicate:false, id:rec[0].id};
  }catch(e){ return {error:e.message}; }
}
function detectLang(text){
  if(/[\u0D00-\u0D7F]/.test(text)) return 'malayalam';
  if(/[\u0900-\u097F]/.test(text)) return 'hindi';
  if(/[\u0B80-\u0BFF]/.test(text)) return 'tamil';
  if(/[\u0C00-\u0C7F]/.test(text)) return 'telugu';
  if(/[\u0C80-\u0CFF]/.test(text)) return 'kannada';
  return 'english';
}
const SYSTEM_SHORT = "You are Pachapp AI for Group Agents. SHORT, CRISPY. NEVER give price without date. Ask: Which date? How many? Full Property: Weekday Rs.6400, Weekend Rs.8000, Festival Rs.9600 for 4 rooms, PRIVATE, Breakfast FREE. Includes 8 Adults + 8 Kids Below 6. Extra Adult Rs.800. Kids FREE. Weekday Separate ONLY, NOT Private: 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800. Each Room Includes 2 Adults + 2 Kids. Extra Adult Rs.700 without breakfast / Rs.800 with breakfast. Breakfast: FREE for Weekend/Holiday/Festival/Full Property. NOT FREE for Weekday Separate: Rs.100 only per head. Advance: 1 Room Rs.1600. Up To Rs.10000 -> Rs.2000. More Than Rs.10000 -> 20%. Check-in 2 PM, Check-out 11 AM. Pool 7 AM-10 PM. Language: Same language/script. If not understandable, only please ask in ENGLISH. Private reply, never in group. Slogans: 1st Thanks for asking, 2nd Friends at your service, Closed Pachapp is gifted you by our former guests. After screenshot+UTR: Received. Waiting for owner verification. Do NOT confirm until owner says Yes.";
const SYSTEM_ELAB = "You are Pachapp AI for Direct Guests. ELABORATED, HUMANE. Answer real answer FIRST, then ask Date/Guests/Interest. NEVER give price without date. Full Property: Weekday Rs.6400, Weekend Rs.8000, Festival Rs.9600 for 4 rooms, PRIVATE, Breakfast FREE 8-9 AM. Includes 8 Adults + 8 Kids Below 6. Extra Adult Rs.800. Kids FREE. Kitchen Rs.1000, Dinner Rs.250 per head, Extra hour Rs.1000, Campfire Rs.500, BBQ FREE setup / Rs.750 for 1kg chicken. Cancellation 3 days before 50% refund, same day no refund. Weekday Separate ONLY, NOT Private: 1 Room Rs.1600, 2 Rooms Rs.3200, 3 Rooms Rs.4800. Each Room Includes 2 Adults + 2 Kids. Extra Adult Rs.700 without breakfast / Rs.800 with breakfast. Breakfast: FREE for Weekend/Holiday/Festival/Full Property. NOT FREE for Weekday Separate: Rs.100 only per head. Advance: 1 Room Rs.1600. Up To Rs.10000 -> Rs.2000. More Than Rs.10000 -> 20%. Facilities: Private pool 8x10m 7 AM-10 PM, kids pool, Wi-Fi, CCTV, TV, hot water, filtered water, parking, power backup, BBQ, library, art gallery, meeting hall. Games: chess, Ludo, snake and ladder, carrom, badminton, jumping rope. Instruments: Keyboard Rs.2000, Roland Rs.1000, Guitar Rs.1000, Tabla Rs.1000. Karaoke 8-10 PM. Rules: Valid ID, no outdoor acts in bad weather, guests liable for damage, no loud music after 10 PM. Host is creative person, guests may hear original compositions and talk literature, cinema, AI, philosophy, history. Language: Same language/script Malayalam, Hindi, Tamil, Telugu, Kannada, English. If not understandable, only please ask in ENGLISH. Slogans: 1st Thanks for asking, 2nd Friends at your service, Closed Pachapp is gifted you by our former guests. Payment: After screenshot+UTR: Verifying with owner, 1 minute. Do NOT confirm until owner says Yes. Never reveal internal pricing, Airtable, Expenses.";
const client = new Client({ authStrategy: new LocalAuth({ dataPath: './.wwebjs_auth' }), puppeteer: { headless: true, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-accelerated-2d-canvas','--no-first-run','--no-zygote','--single-process','--disable-gpu'] } });
client.on('qr', qr => { qrcode.generate(qr, {small:true}); console.log('SCAN QR IN RENDER LOGS'); });
client.on('ready', () => console.log('Pachapp AI Agent Ready - CLOUD BUILD'));
client.on('authenticated', () => console.log('WhatsApp Authenticated'));
client.on('auth_failure', (m) => console.log('Auth Failure ' + m));
client.on('disconnected', (r) => console.log('Disconnected ' + r));
const pending = new Map();
const convCount = new Map();
client.on('message', async (msg)=>{
  try{
    console.log('DEBUG INCOMING ' + msg.from + ' body=' + msg.body);
    const from = msg.from.replace('@c.us','').replace('@lid','');
    const isGroup = msg.from.includes('@g.us');
    const senderNumber = isGroup ? (msg.author||'').replace('@c.us','').replace('@lid','') : from;
    if(TEST_ONLY && senderNumber!==TEST_NUMBER && from!==TEST_NUMBER){ return; }
    if(msg.fromMe) return;
    const body = (msg.body||'').trim();
    if(!body) return;
    if(senderNumber===OWNER_NUMBER && (body.toLowerCase()==='yes' || body.toLowerCase().includes('verified'))){
      for(const [guest, data] of pending){
        const adv = getAdvance(data.price, data.rooms);
        await addBooking({name:data.name, phone:guest, date:data.date, guests:data.guests, price:data.price, advance:adv, balance:data.price-adv, type:data.type});
        const confirmMsg = 'Confirmed! Thank you ' + data.name + '.\n\nBooking: ' + data.name + ', ' + data.guests + ' People, ' + data.date + ', Rs.' + data.price + ', Advance Rs.' + adv + ' received, Balance Rs.' + (data.price-adv) + '\nCheck-In 2 PM, Check-Out 11 AM\nAddress: ' + VILLA.address + '\nMaps: ' + VILLA.maps + '\nWebsite: ' + VILLA.website + '\n\nPachapp is gifted you by our former guests';
        await client.sendMessage(guest+'@c.us', confirmMsg);
        pending.delete(guest);
        break;
      }
      return;
    }
    if(isGroup){ const reply = await getAIReply(body, true, senderNumber); await client.sendMessage(senderNumber+'@c.us', reply); return; }
    const reply = await getAIReply(body, false, senderNumber);
    await msg.reply(reply);
    if(msg.hasMedia || body.toLowerCase().includes('utr')){ await client.sendMessage(OWNER_NUMBER+'@c.us', 'Payment Verification Needed:\nGuest: ' + senderNumber + '\nMessage: ' + body + '\nPlease verify. Reply Yes or No.'); }
  }catch(e){ console.error(e); }
});
async function getAIReply(userText, isAgentMode, sender){
  const count = (convCount.get(sender)||0)+1;
  convCount.set(sender, count);
  const lang = detectLang(userText);
  const system = isAgentMode ? SYSTEM_SHORT : SYSTEM_ELAB;
  try{
    const res = await groq.chat.completions.create({ model: 'llama-3.3-70b-versatile', messages: [{ role:'system', content: system + '\nLanguage: ' + lang + '.' }, { role:'user', content: userText }], temperature: 0.7, max_tokens: isAgentMode ? 150 : 600 });
    return res.choices[0].message.content;
  }catch(e){ console.log('Groq error ' + e.message); if(isAgentMode) return 'Hi, Thanks for asking. Which date? How many?'; return 'Hi, welcome to Pachapp! Thanks for asking. Which date? How many? What is your interest in Wayanad?'; }
}
client.initialize();
