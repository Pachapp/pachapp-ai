const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appQrwByIT5af54K3';
const AIRTABLE_TABLE_ID = process.env.AIRTABLE_TABLE_ID || 'tbleQTjZjOAbPq3sd';

const GITHUB_BASE = 'https://raw.githubusercontent.com/Pachapp/pachapp-ai/main/';
const BOOKING_FORM = 'https://pachapp-ai-1.onrender.com/booking-form.html';
const WEBSITE = 'https://www.pachapp.green';

const FIRST_PHOTOS = [GITHUB_BASE + 'room1.jpg', GITHUB_BASE + 'outdoor1.jpg', GITHUB_BASE + 'pool1.jpg'];
const SECOND_PHOTOS = [GITHUB_BASE + 'room1.jpg', GITHUB_BASE + 'room2.jpg', GITHUB_BASE + 'room3.jpg', GITHUB_BASE + 'room4.jpg', GITHUB_BASE + 'pool1.jpg', GITHUB_BASE + 'pool2.jpg', GITHUB_BASE + 'pool3.jpg', GITHUB_BASE + 'outdoor1.jpg', GITHUB_BASE + 'outdoor2.jpg', GITHUB_BASE + 'outdoor3.jpg'];

const CHECKIN = '2 PM';
const CHECKOUT = '12 PM';
const MAX_GUESTS = 'Max 20 guests for Full Villa';
const ROOMS_INFO = '4 rooms, all King size beds, each room has attached bathroom, total 7 bathrooms. Bed linen, towels, toiletries provided. Extra mattress / extra person charge applies.';
const FACILITIES = 'Wi-Fi, CCTV, TV, Hot water, Filtered water, Free and Paid Breakfast / Dinner, Pet friendly (Rs 1000 pet charge), Free parking for 6 cars, Private Kitchen with stove, fridge, utensils, kettle (kettle in kitchen, not in room), Inverter for power backup, First aid kit, Fire extinguisher, Caretaker on call 24 hours, Housekeeping / Cleaning if asked';
const ACTIVITIES = 'Library (books inside villa), Art Gallery (Photography inside villa), Meeting hall inside villa for 20-40 people, Swimming pool, Pool Jacuzzi in pool';
const GAMES = 'Chess, Ludo, Snake and ladder, Carrom board, Badminton, Jumping rope';
const FOOD_INFO = 'Breakfast Free for Full Villa only. Dinner Paid Rs 250. Tea / Coffee Free and Paid options. Kettle in kitchen, not in room.';
const POOL_INFO = 'Pool Private, Depth 120 cm, Kids allowed with adult, Pool towels not provided, Pool Jacuzzi in pool, Working Yes. Pool: 8 AM to 11 PM. Please always enquire with the staff in charge.';
const PAID_BARBECUE = 'Barbecue - Free for self use, Rs 250 for staff assistance, Rs 750 per 1 Kg of Chicken Barbecue serving.';
const PAID_CAMPFIRE = 'Campfire - Rs 500.';
const MUSIC_RENT = 'Music instruments on Rent - Keyboard (Thomman 88 keys): Rs 2000, Roland rhythm pad: Rs 1000, Guitar (Washburn electric): Rs 1000, Tabla: Rs 1000.';
const TIMINGS = 'Starting time - Pool: 8 AM, Campfire: 7 PM, Music: 7 PM. Closing time - Pool: 11 PM, Music: 11 PM, Campfire: 11 PM, Grill: 11 PM. Swimming pool - please always enquire with the staff in charge.';
const RULES = 'Smoking allowed, but drinks and smokes not allowed in music rooms. Alcohol allowed. Party / DJ allowed, Music till 11 PM. Early check-in / Late check-out charge applies.';
const PIN_POINTS = '20% Advance mandatory. Advance is not refundable. Balance payments at check-in time. Please show your valid ID at arrival. Diseased are not allowed in the pool. No Outdoor Activities in bad weather.';
const NEARBY = 'All nearby within 2 km. Tea plantation view Yes, Mountain view Yes.';
const AMENITIES_SUMMARY = 'Pachapp Pool Villa - Wayanad\n\nArrival: ' + CHECKIN + '\nDeparture: ' + CHECKOUT + '\n\n' + MAX_GUESTS + '\n' + ROOMS_INFO + '\n\nFacilities: ' + FACILITIES + '\n\nActivities: ' + ACTIVITIES + '\n\nGames: ' + GAMES + '\n\nFood: ' + FOOD_INFO + '\n\nPool: ' + POOL_INFO + '\n\nPaid Activities: ' + PAID_BARBECUE + ' ' + PAID_CAMPFIRE + '\n\n' + MUSIC_RENT + '\n\nTimings: ' + TIMINGS + '\n\nRules: ' + RULES + '\n\nNearby: ' + NEARBY + '\n\nImportant: ' + PIN_POINTS;

const memory = {};
function getMem(phone){ if(!memory[phone]) memory[phone]={photoCount:0}; return memory[phone]; }

function parseDates(text){
  const lower = text.toLowerCase();
  const months = {jan:0, january:0, feb:1, february:1, mar:2, march:2, apr:3, april:3, may:4, jun:5, june:5, jul:6, july:6, aug:7, august:7, sep:8, sept:8, september:8, oct:9, october:9, nov:10, november:10, dec:11, december:11};
  const dates = [];
  const re1 = /(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})/g;
  let m;
  while((m=re1.exec(lower))!==null){
    let d=parseInt(m[1],10), mo=parseInt(m[2],10)-1;
    if(mo>=0 && mo<12 && d>=1 && d<=31){
      let y=new Date().getFullYear();
      let dt=new Date(y,mo,d);
      if(dt < new Date(new Date().setHours(0,0,0,0))) dt.setFullYear(y+1);
      dates.push(dt);
    }
  }
  const parts = lower.replace(/,/g,' ').split(/\s+/);
  for(let i=0;i<parts.length;i++){
    if(months[parts[i]]!==undefined){
      let mo=months[parts[i]];
      let d=null;
      if(i>0 && /^\d{1,2}$/.test(parts[i-1])) d=parseInt(parts[i-1],10);
      else if(i+1<parts.length && /^\d{1,2}$/.test(parts[i+1])) d=parseInt(parts[i+1],10);
      if(d){ let y=new Date().getFullYear(); let dt=new Date(y,mo,d); if(dt < new Date(new Date().setHours(0,0,0,0))) dt.setFullYear(y+1); if(!dates.find(x=>x.getTime()===dt.getTime())) dates.push(dt); }
    }
  }
  return dates.sort((a,b)=>a-b);
}
function fmt(d){ return d.toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}); }

async function checkAvailability(checkin, checkout){
  try{
    const url = 'https://api.airtable.com/v0/' + AIRTABLE_BASE_ID + '/' + AIRTABLE_TABLE_ID;
    const res = await axios.get(url, {headers:{Authorization:'Bearer ' + AIRTABLE_API_KEY}, params:{pageSize:100}});
    const records = res.data.records || [];
    for(const r of records){
      const f = r.fields || {};
      const exIn = f.Checkin || f['Check-in'] || f.CheckIn || f.Date;
      const exOut = f.Checkout || f['Check-out'] || f.CheckOut;
      if(!exIn || !exOut) continue;
      const eIn = new Date(exIn), eOut = new Date(exOut);
      if(checkin < eOut && checkout > eIn) return false;
    }
    return true;
  }catch(e){ console.log('AVAIL ERROR ' + e.message); return true; }
}

async function sendText(to, body){ if(!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) console.log('MISSING ENV PHONE_NUMBER_ID or WHATSAPP_TOKEN');
  await axios.post('https://graph.facebook.com/v22.0/' + PHONE_NUMBER_ID + '/messages', {messaging_product:'whatsapp', to:to, type:'text', text:{body:body}}, {headers:{Authorization:'Bearer ' + WHATSAPP_TOKEN, 'Content-Type':'application/json'}});
}
async function sendImage(to, link, caption){
  await axios.post('https://graph.facebook.com/v22.0/' + PHONE_NUMBER_ID + '/messages', {messaging_product:'whatsapp', to:to, type:'image', image:{link:link, caption:caption||''}}, {headers:{Authorization:'Bearer ' + WHATSAPP_TOKEN, 'Content-Type':'application/json'}});
}

function getAmenitiesAnswer(text){
  const t = text.toLowerCase();
  if(t.includes('how many') && (t.includes('guest') || t.includes('people') || t.includes('person') || t.includes('max') || t.includes('capacity'))) return MAX_GUESTS + '.';
  if(t.includes('bathroom') || t.includes('toilet') || t.includes('washroom')) return 'Total 7 bathrooms. Each room has attached bathroom.';
  if(t.includes('bed')) return ROOMS_INFO;
  if(t.includes('towel') || t.includes('linen') || t.includes('toiletries')) return 'Bed linen, towels, toiletries provided. Pool towels not provided.';
  if(t.includes('extra') && (t.includes('mattress') || t.includes('person'))) return 'Extra mattress / extra person charge applies. Please ask host for rate.';
  if(t.includes('kitchen') || t.includes('stove') || t.includes('fridge') || t.includes('kettle') || t.includes('utensil')) return 'Private Kitchen Yes - Stove, fridge, utensils, kettle. Kettle in kitchen, not in room.';
  if(t.includes('breakfast') || t.includes('dinner') || t.includes('food') || t.includes('tea') || t.includes('coffee')) return 'Food: ' + FOOD_INFO;
  if(t.includes('pool') && (t.includes('deep') || t.includes('depth') || t.includes('120') || t.includes('kid') || t.includes('child'))) return POOL_INFO;
  if(t.includes('pool') && (t.includes('jacuzzi'))) return 'Pool Jacuzzi in pool, Working Yes. Pool: 8 AM to 11 PM. Please always enquire with the staff in charge.';
  if(t.includes('caretaker') || t.includes('host') || t.includes('staff') || t.includes('housekeeping') || t.includes('cleaning')) return 'Caretaker on call 24 hours. Housekeeping / Cleaning if asked.';
  if(t.includes('inverter') || t.includes('power') || t.includes('generator') || t.includes('backup') || t.includes('current')) return 'Inverter Yes - Power backup available.';
  if(t.includes('first aid') || t.includes('fire') || t.includes('safety')) return 'First aid kit Yes, Fire extinguisher Yes, CCTV Yes.';
  if(t.includes('library') || t.includes('art gallery') || t.includes('photography') || t.includes('meeting hall') || t.includes('meeting')) return 'Library (books inside villa), Art Gallery (Photography inside villa), Meeting hall inside villa for 20-40 people.';
  if(t.includes('smoking') || t.includes('smoke') || t.includes('alcohol') || t.includes('drink') || t.includes('party') || t.includes('dj')) return RULES;
  if(t.includes('early') || (t.includes('late') && t.includes('check'))) return 'Early check-in / Late check-out charge applies.';
  if(t.includes('pet') || t.includes('dog') || t.includes('cat')) return 'Pet friendly - Pet charge Rs 1000.';
  if(t.includes('parking') || t.includes('car') || t.includes('vehicle')) return 'Free parking for 6 cars.';
  if(t.includes('near') || t.includes('nearby') || t.includes('distance') || t.includes('town') || t.includes('shop') || t.includes('view') || t.includes('tea plantation') || t.includes('mountain')) return NEARBY;
  if(t.includes('game') || t.includes('chess') || t.includes('ludo') || t.includes('carrom') || t.includes('badminton')) return 'Games at Pachapp: ' + GAMES + '.';
  if(t.includes('barbecue') || t.includes('barbeque') || t.includes('bbq') || t.includes('grill')) return PAID_BARBECUE + ' Grill closing: 11 PM.';
  if(t.includes('campfire') || t.includes('camp fire') || t.includes('bonfire')) return PAID_CAMPFIRE + ' Campfire time: 7 PM to 11 PM.';
  if(t.includes('music') || t.includes('keyboard') || t.includes('guitar') || t.includes('tabla') || t.includes('instrument') || t.includes('roland')) return MUSIC_RENT + ' Music time: 7 PM to 11 PM.';
  if(t.includes('timing') || t.includes('time') || t.includes('open') || t.includes('close') || t.includes('start')) return TIMINGS;
  if(t.includes('checkin') || t.includes('check-in') || t.includes('arrival') || t.includes('check in')) return 'Arrival / Check-in time: ' + CHECKIN + '.';
  if(t.includes('checkout') || t.includes('check-out') || t.includes('departure') || t.includes('check out')) return 'Departure / Check-out time: ' + CHECKOUT + '.';
  if(t.includes('advance') || t.includes('payment') || t.includes('refund') || t.includes('cancel')) return 'Important: ' + PIN_POINTS;
  if(t.includes('wifi') || t.includes('wi-fi') || t.includes('internet')) return 'Wi-Fi available.';
  if(t.includes('activity') || t.includes('activities')) return 'Activities: ' + ACTIVITIES + '.';
  if(t.includes('facilit') || t.includes('amenit') || t.includes('what is there') || t.includes('what do you have')) return AMENITIES_SUMMARY;
  return null;
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
    const amen = getAmenitiesAnswer(text);
    if(amen){
      const dates = parseDates(text);
      if(dates.length>=1){
        const cin = dates[0];
        const cout = dates[1] || new Date(cin.getTime()+86400000);
        mem.checkin=cin; mem.checkout=cout;
        const avail = await checkAvailability(cin, cout);
        const availLine = avail ? ('AVAILABLE for ' + fmt(cin) + ' to ' + fmt(cout) + '.') : ('NOT AVAILABLE for ' + fmt(cin) + ' to ' + fmt(cout) + '. Please try other dates.');
        await sendText(from, availLine + '\n\n' + amen + '\n\nShall I send you the booking form?');
        return res.sendStatus(200);
      }
      await sendText(from, amen + '\n\nWhat dates are you planning?');
      return res.sendStatus(200);
    }
    const dates = parseDates(text);
    if(dates.length>=1){
      const cin = dates[0];
      const cout = dates[1] || new Date(cin.getTime()+86400000);
      mem.checkin=cin; mem.checkout=cout;
      const avail = await checkAvailability(cin, cout);
      if(!avail){
        await sendText(from, 'NOT AVAILABLE for ' + fmt(cin) + ' to ' + fmt(cout) + '.\n\nPlease try other dates. What dates?');
        return res.sendStatus(200);
      }
      let villa = mem.villaType || '';
      if(lower.includes('full villa') || lower.includes('full') || lower.includes('villa')) villa='Full Villa';
      else if(lower.includes('room')) villa='Rooms';
      if(villa) mem.villaType=villa;
      if(villa){
        await sendText(from, 'AVAILABLE for ' + fmt(cin) + ' to ' + fmt(cout) + ' - ' + villa + '.\n\nBooking form:\n' + BOOKING_FORM + '\n\nPlease fill it to confirm.');
        return res.sendStatus(200);
      }
      await sendText(from, 'AVAILABLE for ' + fmt(cin) + ' to ' + fmt(cout) + '.\n\nDo you want Full Villa or Rooms?');
      return res.sendStatus(200);
    }
    if(lower.includes('full villa') || lower.includes('full') || lower.includes('villa') || lower.includes('room')){
      let villa='Rooms';
      if(lower.includes('full') || lower.includes('villa')) villa='Full Villa';
      mem.villaType=villa;
      if(mem.checkin && mem.checkout){
        await sendText(from, 'AVAILABLE for ' + fmt(mem.checkin) + ' to ' + fmt(mem.checkout) + ' - ' + villa + '.\n\nBooking form:\n' + BOOKING_FORM + '\n\nPlease fill it to confirm.');
        return res.sendStatus(200);
      }
      await sendText(from, 'Okay - ' + villa + '.\n\nWhat dates are you planning?');
      return res.sendStatus(200);
    }
    if(lower.includes('book') || lower.includes('form') || lower.includes('confirm')){
      if(mem.checkin && mem.checkout && mem.villaType){
        await sendText(from, 'AVAILABLE for ' + fmt(mem.checkin) + ' to ' + fmt(mem.checkout) + ' - ' + mem.villaType + '.\n\nBooking form:\n' + BOOKING_FORM);
        return res.sendStatus(200);
      }
      await sendText(from, 'What dates are you planning?');
      return res.sendStatus(200);
    }
    if(lower.includes('hi') || lower.includes('hello') || lower.includes('hey')){
      await sendText(from, 'Hi, Welcome to Pachapp Pool Villa, Wayanad.\n\nWhat dates are you planning?');
      return res.sendStatus(200);
    }
    await sendText(from, 'Welcome to Pachapp Pool Villa, Wayanad.\n\nWhat dates are you planning?');
    return res.sendStatus(200);
  }catch(e){ console.log('WEBHOOK ERROR ' + e.message + ' DETAIL:' + JSON.stringify(e.response ? e.response.data : 'no-response')); return res.sendStatus(200); }
});

app.get('/webhook', (req,res)=>{
  const VERIFY = process.env.VERIFY_TOKEN || 'pachapp123';
  if(req.query['hub.verify_token']===VERIFY) return res.send(req.query['hub.challenge']);
  return res.sendStatus(403);
});

app.get('/', (req,res)=> res.send('Pachapp AI Live - V26'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('Live on ' + PORT));
