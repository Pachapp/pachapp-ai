const express = require('express');
const axios = require('axios');
let Groq = null;
try{ Groq = require('groq-sdk'); }catch(e){ console.log('GROQ SDK NOT INSTALLED'); }
const groq = (Groq && process.env.GROQ_API_KEY) ? new Groq({apiKey: process.env.GROQ_API_KEY}) : null;
console.log('GROQ STATUS - HAS_SDK:' + (!!Groq) + ' HAS_KEY:' + (!!process.env.GROQ_API_KEY) + ' GROQ_READY:' + (!!groq));
const app = express();
app.use(express.json());

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
  const istToday = todayIST();
  const months = {jan:0, january:0, feb:1, february:1, mar:2, march:2, apr:3, april:3, may:4, jun:5, june:5, jul:6, july:6, aug:7, august:7, sep:8, sept:8, september:8, oct:9, october:9, nov:10, november:10, dec:11, december:11};
  const weekdays = {sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6};
  const dates = [];
  const addDate = (d)=>{ if(d && !dates.find(x=>x.getTime()===d.getTime())) dates.push(new Date(d.getTime())); };
  // Normalize ordinals
  let norm = lower.replace(/(\d{1,2})(st|nd|rd|th)\b/g, '$1');
  norm = norm.replace(/,/g,' ');
  // 1) Explicit range: "1 to 3 dec", "1-3 dec", "dec 1 to 3", "dec 1-3", "1 dec to 3 dec", "1/12 to 3/12"
  let rangeRe = /(\d{1,2})\s*(?:to|\-|\u2013)\s*(\d{1,2})\s*(jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)/;
  let rm = norm.match(rangeRe);
  if(rm){
    let d1=parseInt(rm[1],10), d2=parseInt(rm[2],10), mo=months[rm[3].slice(0,3)]!==undefined?months[rm[3].slice(0,3)]:months[rm[3]];
    // handle full month name: use first 3 letters
    let mkey = rm[3].substring(0,3); mo = months[mkey];
    let y=istToday.getFullYear();
    let dt1=new Date(y,mo,d1), dt2=new Date(y,mo,d2);
    if(dt1 < istToday) dt1.setFullYear(y+1);
    if(dt2 < istToday) dt2.setFullYear(y+1);
    if(dt2 < dt1) dt2.setMonth(dt2.getMonth()+1);
    addDate(dt1); addDate(dt2); return dates.sort((a,b)=>a-b);
  }
  // Range with month in middle: "dec 1 to dec 3" / "dec 1 - dec 3"
  let rangeRe2 = /(jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\s*(\d{1,2})\s*(?:to|\-)\s*(?:(jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)\s*)?(\d{1,2})/;
  let rm2 = norm.match(rangeRe2);
  if(rm2){
    let mo1 = months[rm2[1].substring(0,3)];
    let d1 = parseInt(rm2[2],10);
    let mo2 = rm2[3] ? months[rm2[3].substring(0,3)] : mo1;
    let d2 = parseInt(rm2[4],10);
    let y=istToday.getFullYear();
    let dt1=new Date(y,mo1,d1), dt2=new Date(y,mo2,d2);
    if(dt1 < istToday) dt1.setFullYear(y+1);
    if(dt2 < dt1) dt2.setFullYear(dt1.getFullYear());
    if(dt2 < istToday && dt1 >= istToday) dt2.setFullYear(dt1.getFullYear());
    addDate(dt1); addDate(dt2); return dates.sort((a,b)=>a-b);
  }
  // "for 2 nights / 2 days from dec 1" / "2 nights from tomorrow"
  let nightsRe = /for\s*(\d{1,2})\s*(night|nights|day|days)/;
  let nm = norm.match(nightsRe);
  let nights = nm ? parseInt(nm[1],10) : null;
  // Weekday: "next friday", "this friday", "coming friday", "friday"
  for(let wd in weekdays){
    if(norm.includes(wd)){
      let target = weekdays[wd];
      let base = new Date(istToday.getTime());
      let cur = base.getDay();
      let diff = (target - cur + 7) % 7;
      if(norm.includes('next '+wd) || norm.includes('coming '+wd)){
        diff = diff===0 ? 7 : diff+7;
        if(diff<=7 && norm.includes('next')) diff+=0;
        // next Friday when today is Friday should be +7, when today is Monday and next Friday = +4? Use +7 if diff==0 else diff, but for "next" we want next week's
        if(norm.includes('next '+wd)){
          // If diff is within this week, push to next week
          diff = diff===0 ? 7 : diff;
          // If today is before Friday this week, "next Friday" means Friday next week, not this Friday
          let thisWeekDiff = (target - cur + 7)%7;
          if(thisWeekDiff!==0) diff = thisWeekDiff + 7;
        }
      } else if(norm.includes('this '+wd)){
        if(diff===0) diff=0;
      } else {
        if(diff===0) diff=0;
      }
      let dt = new Date(base.getTime()+diff*86400000);
      addDate(dt);
      // If nights present, add checkout
      if(nights) addDate(new Date(dt.getTime()+nights*86400000));
      return dates.sort((a,b)=>a-b);
    }
  }
  // "next weekend" / "this weekend" / "weekend" / "coming weekend"
  if(norm.includes('weekend')){
    let base = new Date(istToday.getTime());
    let cur = base.getDay();
    // Saturday = 6
    let diffSat = (6 - cur + 7)%7;
    if(norm.includes('next weekend') || norm.includes('coming weekend')){
      diffSat = diffSat===0 ? 7 : diffSat+7;
      // If today is Mon-Fri, next weekend = Sat next week, not this Sat
      if(cur>=1 && cur<=5) diffSat = diffSat; // already +7 logic above handles
      if(cur===0) diffSat = 6; // Sunday -> next Sat is +6
      if(cur===6) diffSat = 7;
    } else if(norm.includes('this weekend')){
      if(diffSat===0) diffSat=0;
    }
    let sat = new Date(base.getTime()+diffSat*86400000);
    addDate(sat);
    addDate(new Date(sat.getTime()+86400000)); // Sun checkout = Sat+1? Actually Sat to Sun = 1 night, but for weekend stay Sat to Mon = 2 nights, use Sat to Mon
    // For weekend, checkout = Monday
    dates.length=0;
    addDate(sat);
    addDate(new Date(sat.getTime()+2*86400000));
    return dates.sort((a,b)=>a-b);
  }
  // "next week" / "this week"
  if(norm.includes('next week')){
    let base = new Date(istToday.getTime());
    let diffMon = (1 - base.getDay() + 7)%7;
    let nextMon = new Date(base.getTime()+(diffMon+7)*86400000);
    if(diffMon===0) nextMon = new Date(base.getTime()+7*86400000);
    addDate(nextMon); return dates.sort((a,b)=>a-b);
  }
  // "next month" / "next dec" / "in december"
  if(norm.includes('next month')){
    let y=istToday.getFullYear(), mo=istToday.getMonth()+1;
    if(mo>11){ mo=0; y++; }
    addDate(new Date(y,mo,1)); return dates.sort((a,b)=>a-b);
  }
  // Relative: tomorrow / day after tomorrow / today / tonight
  if(norm.includes('day after tomorrow')){
    addDate(new Date(istToday.getTime()+2*86400000));
    if(nights) addDate(new Date(istToday.getTime()+2*86400000+nights*86400000));
    return dates.sort((a,b)=>a-b);
  }
  if(norm.includes('tomorrow')){
    let tmr = new Date(istToday.getTime()+86400000);
    addDate(tmr);
    if(nights) addDate(new Date(tmr.getTime()+nights*86400000));
    // Continue to also parse other explicit dates if present, don't return yet if other date exists
    // If only tomorrow, return
    let hasOtherDate = /(\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))|((jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{1,2})|(\d{1,2}\s*[\/\-\.]\s*\d{1,2})/.test(norm.replace('tomorrow',''));
    if(!hasOtherDate) return dates.sort((a,b)=>a-b);
  }
  if(norm.includes('today') || norm.includes('tonight')){
    let hasOtherDate = /(\d{1,2}\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/.test(norm.replace('today','').replace('tonight',''));
    if(!hasOtherDate){ addDate(new Date(istToday.getTime())); return dates.sort((a,b)=>a-b); }
  }
  // YYYY-MM-DD
  let ymd = norm.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(ymd){ addDate(new Date(parseInt(ymd[1],10), parseInt(ymd[2],10)-1, parseInt(ymd[3],10))); return dates.sort((a,b)=>a-b); }
  // DD/MM, DD-MM, DD.MM
  const re1 = /(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})(?:\s*[\/\-\.]\s*(\d{2,4}))?/g;
  let m;
  while((m=re1.exec(norm))!==null){
    let d=parseInt(m[1],10), mo=parseInt(m[2],10)-1;
    let y = m[3] ? (parseInt(m[3],10)<100 ? 2000+parseInt(m[3],10) : parseInt(m[3],10)) : istToday.getFullYear();
    if(mo>=0 && mo<12 && d>=1 && d<=31){
      let dt=new Date(y,mo,d);
      if(!m[3] && dt < istToday) dt.setFullYear(y+1);
      addDate(dt);
    }
  }
  if(dates.length>0){
    // If nights + one date, add checkout
    if(nights && dates.length===1) addDate(new Date(dates[0].getTime()+nights*86400000));
    return dates.sort((a,b)=>a-b);
  }
  // Month + Day: "1 dec", "dec 1", "1 december", "december 1", with optional year
  const parts = norm.replace(/,/g,' ').split(/\s+/);
  for(let i=0;i<parts.length;i++){
    let key = parts[i].substring(0,3);
    if(months[key]!==undefined && months[parts[i]]!==undefined || months[key]!==undefined && ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].includes(key)){
      let mo = months[key];
      if(mo===undefined) continue;
      let d=null;
      // Check year nearby
      let y = istToday.getFullYear();
      // Look for year token
      for(let j=0;j<parts.length;j++){ if(/^20\d{2}$/.test(parts[j])) y=parseInt(parts[j],10); }
      if(i>0 && /^\d{1,2}$/.test(parts[i-1])) d=parseInt(parts[i-1],10);
      else if(i+1<parts.length && /^\d{1,2}$/.test(parts[i+1])) d=parseInt(parts[i+1],10);
      if(d){ let dt=new Date(y,mo,d); if(y===istToday.getFullYear() && dt < istToday) dt.setFullYear(y+1); addDate(dt); }
      else {
        // Month only: "in december", "december" -> 1st of that month
        if(parts.length===1 || norm.includes('in '+parts[i]) || norm.includes('for '+parts[i])){
          let dt=new Date(y,mo,1); if(dt < istToday) dt.setFullYear(y+1); addDate(dt);
        }
      }
    }
  }
  if(dates.length>0){
    if(nights && dates.length===1) addDate(new Date(dates[0].getTime()+nights*86400000));
    return dates.sort((a,b)=>a-b);
  }
  return dates.sort((a,b)=>a-b);
}
function getVillaTypeFlexible(text){
  const t = text.toLowerCase();
  if(t.includes('full villa') || t.includes('entire villa') || t.includes('whole villa') || t.includes('full house') || t.includes('full property') || t.includes('full') && t.includes('villa')) return 'Full Villa';
  if(t.includes('full villa') || t.includes('entire') || t.includes('whole villa')) return 'Full Villa';
  if(t.includes('villa')) return 'Full Villa';
  if(t.includes('room') || t.includes('bedroom') || t.includes('single') || t.includes('double')) return 'Rooms';
  return '';
}
function isVacancyAsk(text){
  const t = text.toLowerCase();
  const vacancyWords = ['free','available','availability','vacancy','vacant','empty','booking','book','reserve','reservation','stay','check','have','hai','need','want','looking','room','villa','tomorrow','today','tonight','weekend','next','dec','jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','monday','tuesday','wednesday','thursday','friday','saturday','sunday','date','night','day'];
  for(let w of vacancyWords) if(t.includes(w)) return true;
  if(/\d/.test(t)) return true;
  return false;
}
function todayIST(){ const ist = new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Kolkata'})); ist.setHours(0,0,0,0); return ist; }
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

function getWiseObjectionAnswer(text){
  const t = text.toLowerCase();
  if(t.includes('expensive') || t.includes('costly') || t.includes('cost') || t.includes('too much') || t.includes('high price') || t.includes('rate') || t.includes('price') || t.includes('tariff') || t.includes('how much') || t.includes('charge') || t.includes('discount') || t.includes('offer') || t.includes('cheap') || t.includes('less')){
    return 'I understand - You want best value. Pachapp is a full private villa - 4 King rooms, 7 bathrooms, Private Pool with Jacuzzi, Private Kitchen, Caretaker 24 hours. Not a single room hotel. For Full Villa, Breakfast is free. Advance is only 20% to lock your date, balance at check-in. Advance is not refundable as we block the full villa for you. If you fill the booking form, host will confirm the exact rate for your dates and guests. Shall I send the form?';
  }
  if(t.includes('safe') || t.includes('safety') || t.includes('secure') || t.includes('cctv')){
    return 'Yes, very safe. CCTV, Caretaker on call 24 hours, Inverter backup, First aid kit, Fire extinguisher. It is a private villa inside tea plantation view, mountain view, quiet and secure. Families with kids and elders stay comfortably.';
  }
  if(t.includes('family') || t.includes('kids') || t.includes('children') || t.includes('elder') || t.includes('old people') || t.includes('baby')){
    return 'Perfect for family. Max 20 guests, 4 King rooms, 7 bathrooms - Each room attached. Pool depth 120 cm, kids allowed with adult. Private Kitchen, so you can cook for kids. Library, Games - Chess, Carrom, Badminton for family time. Would you like Full Villa for full privacy?';
  }
  if(t.includes('couple') || t.includes('honeymoon') || t.includes('romantic')){
    return 'Very good for couples - Private Pool, Private Villa, Tea plantation view, Mountain view, Quiet. Pool 8 AM to 11 PM, Campfire 7 PM to 11 PM if you want. For couples, Rooms also work, Full Villa gives full privacy. What dates are you planning?';
  }
  if(t.includes('bachelor') || t.includes('friends') || t.includes('party') || t.includes('birthday') || t.includes('celebrat')){
    return 'Great for friends / celebration. Party / DJ allowed, Music till 11 PM, Alcohol allowed, Smoking allowed but not in music rooms. Pool, Campfire Rs 500, Barbecue - Free self use, Rs 250 staff help, Rs 750 per 1 Kg Chicken. Parking for 6 cars. Max 20 guests. Shall I check your date?';
  }
  if(t.includes('think') || t.includes('later') || t.includes('discuss') || t.includes('will tell') || t.includes('call back') || t.includes('let me see')){
    return 'Take your time, no hurry. Dates in Wayanad get booked fast on weekends. If you tell me your date, I can check and hold the idea for you. Shall I send the booking form so you can decide with family?';
  }
  if(t.includes('thank') || t.includes('nice') || t.includes('good') || t.includes('great') || t.includes('okay') || t.includes('ok ')){
    // Only if guest is happy and we have dates, nudge to close
    return null; // handled in webhook with memory
  }
  return null;
}
async function findNextAvailable(checkin, checkout){
  // Try next 1-7 days for same duration, return first available
  const dur = checkout.getTime() - checkin.getTime();
  for(let i=1;i<=7;i++){
    let nIn = new Date(checkin.getTime()+i*86400000);
    let nOut = new Date(nIn.getTime()+dur);
    let avail = await checkAvailability(nIn, nOut);
    if(avail) return {checkin:nIn, checkout:nOut};
  }
  return null;
}
async function askGroq(userText, mem){
  if(!groq) return null;
  try{
    const systemPrompt = `You are Pachapp Pool Villa AI Host - Wise, knowledgeable, intelligent, smart, matured, tactical to close business and keep guest happy.
You are in Wayanad, Kerala - Pachapp Pool Villa.
REAL DATA ONLY - Never invent. Use only this data:
- Arrival 2 PM, Departure 12 PM. Max 20 guests. 4 rooms, all king size, 7 bathrooms each attached. Bed linen, towels, toiletries provided. Extra mattress / extra person charge applies.
- Facilities: Wi-Fi, CCTV, TV, Hot water, Filtered water, Free and Paid Breakfast Dinner, Pet friendly Rs 1000, Free parking 6 cars, Private Kitchen - stove, fridge, utensils, kettle (kettle in kitchen not room), Inverter, First aid kit, Fire extinguisher, Caretaker 24 hours, Housekeeping if asked.
- Food: Breakfast free for Full Villa only, Dinner Rs 250, Tea/Coffee Paid.
- Pool: Private, Depth 120 cm, Kids allowed with adult, Pool towels NOT provided, Jacuzzi in pool working, Pool 8 AM-11 PM.
- Activities: Library (books inside villa), Art Gallery (Photography inside villa), Meeting hall inside villa 20-40 people, Swimming pool.
- Games: Chess, Ludo, Snake and ladder, Carrom board, Badminton, Jumping rope. No football ground, No playground.
- Paid: Barbecue free self use, Rs 250 staff assistance, Rs 750 per 1 Kg Chicken Barbecue, Grill till 11 PM. Campfire Rs 500, 7 PM-11 PM. Music rent: Keyboard Thomman 88 keys Rs 2000, Roland rhythm pad Rs 1000, Guitar Washburn electric Rs 1000, Tabla Rs 1000, Music 7 PM-11 PM. Owner is Music Composer, Live Music can be arranged on request - ask host for details. No separate Karaoke system.
- Rules: 20% Advance mandatory, Advance NOT refundable, Balance at check-in, Show valid ID, Diseased not allowed in pool, No outdoor activities in bad weather. Smoking yes but drinks/smokes NOT allowed in music rooms. Alcohol yes. Party/DJ yes, Music till 11 PM. Early/Late check-in charge yes. Pet charge Rs 1000.
- Nearby: All within 2 km, Tea plantation view yes, Mountain view yes.
- Location: Pachapp Pool Villa, Wayanad, Kerala. Website https://www.pachapp.green for photos, map, directions. For exact Google Map pin, ask host.
- Booking: Booking form https://pachapp-ai-1.onrender.com/booking-form.html - Advance only 20%, balance at check-in.
- Photos: First ask -> 3 photos, Second more photos -> 10 photos, Third -> website only. Use only real Pachapp photos.
- Style: One question per reply. Availability first if dates given. Be warm, mature, tactical. If date not available, suggest next free date. If guest says expensive, explain value, don't argue, offer form. If guest says yes to form, send form. If guest says thank you / okay, close tactically.
- Memory: Guest dates: ${mem.checkin ? 'Checkin '+mem.checkin+' Checkout '+mem.checkout : 'No dates yet'} Villa: ${mem.villaType || 'Not known'}
- Never say you are AI, never say you don't know, never repeat same greeting. Answer directly, then ask one question.`;
    const comp = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{role:'system', content: systemPrompt}, {role:'user', content: userText}],
      temperature: 0.6,
      max_tokens: 400
    });
    return comp.choices[0].message.content.trim();
  }catch(e){ console.log('GROQ ERROR ' + e.message + ' DETAIL:' + JSON.stringify(e.response ? e.response.data : 'no-response') + ' HAS_KEY:' + (!!process.env.GROQ_API_KEY) + ' HAS_SDK:' + (!!Groq)); return null; }
}
function getAmenitiesAnswer(text){
  const tl = text.toLowerCase();
  if(tl.includes('coordinate') || tl.includes('cordinate') || tl.includes('latitude') || tl.includes('longitude') || tl.includes('lat') || tl.includes('lng') || tl.includes('gps') || tl.includes('pin') || tl.includes('google pin')){
    return 'Exact Google coordinates / live pin - Please see our website https://www.pachapp.green for map, or ask host for live location pin. Pachapp Pool Villa is in Wayanad, Kerala - Tea plantation view, Mountain view. What dates are you planning?';
  }
  if(tl.includes('google map') || tl.includes('map link') || tl.includes('map') || tl.includes('where is') || tl.includes('where is this') || tl.includes('location') || tl.includes('address') || tl.includes('direction') || tl.includes('how to reach') || tl.includes('how to come') || tl.includes('reach') || tl.includes('place is') || tl.includes('where are you') || tl.includes('wayanad where')){
    return 'Pachapp Pool Villa is in Wayanad, Kerala - Tea plantation view, Mountain view. Nearby places all within 2 km. For exact Google Map link and directions, please see our website: ' + 'https://www.pachapp.green' + ' - Or ask host for live location pin. What dates are you planning? I will check availability.';
  }
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
  if(t.includes('karaoke') || t.includes('karoke') || t.includes('kara') || t.includes('ktv')) return 'No separate Karaoke system in the listed facilities. You have Music instruments for rent - Keyboard Rs 2000, Roland Rs 1000, Guitar Rs 1000, Tabla Rs 1000 - and Owner is a Music Composer, Live Music can be arranged on request. Please ask host if you want Karaoke setup.';
  if(t.includes('live music') || t.includes('live') || t.includes('composer') || t.includes('owner') || t.includes('singer') || t.includes('singing') || t.includes('concert') || t.includes('performance') || t.includes('show')){
    return 'Owner is a Music Composer. Live Music can be arranged on request - Please ask host for live music / performance details and charges. Instruments also available for rent: ' + MUSIC_RENT + ' Music time: 7 PM to 11 PM.';
  }
  if(t.includes('music') || t.includes('keyboard') || t.includes('guitar') || t.includes('tabla') || t.includes('instrument') || t.includes('roland')) return MUSIC_RENT + ' Music time: 7 PM to 11 PM. Owner is a Music Composer - Live Music can be arranged on request, please ask host.';
  if(t.includes('timing') || t.includes('time') || t.includes('open') || t.includes('close') || t.includes('start')) return TIMINGS;
  if(t.includes('checkin') || t.includes('check-in') || t.includes('arrival') || t.includes('check in')) return 'Arrival / Check-in time: ' + CHECKIN + '.';
  if(t.includes('checkout') || t.includes('check-out') || t.includes('departure') || t.includes('check out')) return 'Departure / Check-out time: ' + CHECKOUT + '.';
  if(t.includes('advance') || t.includes('payment') || t.includes('refund') || t.includes('cancel')) return 'Important: ' + PIN_POINTS;
  if(t.includes('wifi') || t.includes('wi-fi') || t.includes('internet')) return 'Wi-Fi available.';
  if(t.includes('activity') || t.includes('activities')) return 'Activities: ' + ACTIVITIES + '.';
  if(t.includes('football') || t.includes('ground') || t.includes('playground') || t.includes('cricket') || t.includes('volleyball')) return 'No football ground at Pachapp. We have Badminton, Chess, Ludo, Snake and ladder, Carrom board, Jumping rope. No playground, no football ground.';
  if(t.includes('facilit') || t.includes('amenit') || t.includes('amini') || t.includes('what is there') || t.includes('what do you have')) return AMENITIES_SUMMARY;
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
      const isMore = lower.includes('more');
      if(isMore){
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
        // FIRST Photos - ALWAYS 3, reset count - even if guest asked before
        mem.photoCount=0;
        for(const p of FIRST_PHOTOS){ try{ await sendImage(from,p); }catch(e){ console.log('SEND IMAGE FAIL ' + p); } }
        await sendText(from, 'These are 3 photos - 1 Room, 1 Outdoor, 1 Pool.\n\nWant more photos? Type - more photos');
        return res.sendStatus(200);
      }
    }
    // Wise Host: YES = send booking form - STRICT exact match only, not substring 'ha' in 'have'
    const cleanYes = lower.replace(/[?.!]/g,'').trim();
    const isYes = ['yes','yeah','yep','sure','ok','okay','yes please','please send','send form','send','confirm','yes send','ok send','yes sir','yes madam','please'].includes(cleanYes);
    if(isYes && mem.checkin && mem.checkout){
      const villaTxt = mem.villaType ? ' - ' + mem.villaType : '';
      await sendText(from, 'Perfect. Here is your booking form for ' + fmt(mem.checkin) + ' to ' + fmt(mem.checkout) + villaTxt + ':\n' + BOOKING_FORM + '\n\nFill it to lock your date - Advance only 20%, balance at check-in. I will keep your date in mind.');
      return res.sendStatus(200);
    }
    if(isYes && !mem.checkin){
      await sendText(from, 'Great. What dates are you planning? Tell me like - 28 Nov, or tomorrow, or next weekend - I will check immediately.');
      return res.sendStatus(200);
    }
    // Wise Host: if guest says thanks / okay and we have dates, close tactically
    if((lower.includes('thank') || lower.includes('okay') || lower.includes('ok ') || lower === 'ok' || lower.includes('nice') || lower.includes('good')) && mem.checkin && mem.checkout && mem.villaType){
      await sendText(from, 'Happy to help. Your ' + mem.villaType + ' for ' + fmt(mem.checkin) + ' to ' + fmt(mem.checkout) + ' is in high demand. Shall I send the booking form to lock it? Advance is only 20%, balance at check-in.');
      return res.sendStatus(200);
    }
    const amen = getAmenitiesAnswer(text);
    if(amen){
      const dates = parseDates(text);
      if(dates.length>=1){
        const cin = dates[0];
        if(cin < todayIST()){ await sendText(from, fmt(cin) + ' is already passed. Today is ' + fmt(todayIST()) + '. Please give a future date. What dates are you planning?'); return res.sendStatus(200); }
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
      if(cin < todayIST()){ await sendText(from, fmt(cin) + ' is already passed. Today is ' + fmt(todayIST()) + '. Please give a future date. What dates are you planning?'); return res.sendStatus(200); }
      const cout = dates[1] || new Date(cin.getTime()+86400000);
      mem.checkin=cin; mem.checkout=cout;
      const avail = await checkAvailability(cin, cout);
      if(!avail){
        const nxt = await findNextAvailable(cin, cout);
        if(nxt){
          mem.checkin=nxt.checkin; mem.checkout=nxt.checkout;
          await sendText(from, 'That date is already booked - I am sorry. Good news - ' + fmt(nxt.checkin) + ' to ' + fmt(nxt.checkout) + ' is AVAILABLE. Many guests take the next free date so they do not miss Wayanad. Would you like Full Villa or Rooms for ' + fmt(nxt.checkin) + '?');
        } else {
          await sendText(from, 'That date is already booked. Would you like to try another date? What dates work for you? I will check immediately.');
        }
        return res.sendStatus(200);
      }
      let villa = mem.villaType || '';
      let flexVilla = getVillaTypeFlexible(text);
      if(flexVilla) villa=flexVilla;
      if(villa) mem.villaType=villa;
      if(villa){
        await sendText(from, 'Great news - AVAILABLE for ' + fmt(cin) + ' to ' + fmt(cout) + ' - ' + villa + '. Private Pool, 4 King rooms, Tea plantation view. This date is in demand. Booking form:\n' + BOOKING_FORM + '\n\nFill it to lock your date - Advance only 20%, balance at check-in.');
        return res.sendStatus(200);
      }
      await sendText(from, 'Great news - AVAILABLE for ' + fmt(cin) + ' to ' + fmt(cout) + '. For full privacy, most families take Full Villa - 4 King rooms, Private Pool, Free Breakfast. For smaller group, Rooms also work. Which would you prefer - Full Villa or Rooms?');
      return res.sendStatus(200);
    }
    if(getVillaTypeFlexible(text) || lower.includes('full')){
      let villa = getVillaTypeFlexible(text) || 'Full Villa';
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
      await sendText(from, 'Namaskaram, Welcome to Pachapp Pool Villa, Wayanad. I am here to help you plan a happy stay. What dates are you planning?');
      return res.sendStatus(200);
    }
    // V40: Location / Coordinates in main flow - never goes to greeting
    if(text.toLowerCase().includes('coordinate') || text.toLowerCase().includes('cordinate') || text.toLowerCase().includes('latitude') || text.toLowerCase().includes('longitude') || text.toLowerCase().includes('gps') || text.toLowerCase().includes('pin') || text.toLowerCase().includes('google map') || text.toLowerCase().includes('map link') || text.toLowerCase().includes('where is') || text.toLowerCase().includes('where is this') || text.toLowerCase().includes('location') || text.toLowerCase().includes('address')){
      await sendText(from, 'Pachapp Pool Villa is in Wayanad, Kerala - Tea plantation view, Mountain view. Exact Google coordinates / live pin - Please see https://www.pachapp.green for map, or ask host for live location pin. What dates are you planning?');
      return res.sendStatus(200);
    }
    // Smart AI Agent: Use Groq for any question rule-based didn't understand - don't repeat same greeting
    const groqAns = await askGroq(text, mem);
    if(groqAns){
      await sendText(from, groqAns);
    } else {
      await sendText(from, 'Got it - Can you tell me what you want to know? Dates / Photos / Amenities / Music / Location / Price? I will check for you right away.');
    }
    return res.sendStatus(200);
  }catch(e){ console.log('WEBHOOK ERROR ' + e.message + ' DETAIL:' + JSON.stringify(e.response ? e.response.data : 'no-response')); return res.sendStatus(200); }
});

app.get('/webhook', (req,res)=>{
  const VERIFY = process.env.VERIFY_TOKEN || 'pachapp123';
  if(req.query['hub.verify_token']===VERIFY) return res.send(req.query['hub.challenge']);
  return res.sendStatus(403);
});

app.get('/', (req,res)=> res.send('Pachapp AI Live - V40 Groq Model Fixed'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('Live on ' + PORT));
