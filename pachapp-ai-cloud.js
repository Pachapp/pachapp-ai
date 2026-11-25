const express = require('express');
const axios = require('axios');
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

async function sendText(to, body){
  if(!PHONE_NUMBER_ID || !WHATSAPP_TOKEN) console.log('MISSING ENV PHONE_NUMBER_ID or WHATSAPP_TOKEN');
  await axios.post('https://graph.facebook.com/v22.0/' + PHONE_NUMBER_ID + '/messages', {messaging_product:'whatsapp', to:to, type:'text', text:{body:body}}, {headers:{Authorization:'Bearer ' + WHATSAPP_TOKEN, 'Content-Type':'application/json'}});
}
async function sendImage(to, link, caption){
  await axios.post('https://graph.facebook.com/v22.0/' + PHONE_NUMBER_ID + '/messages', {messaging_product:'whatsapp', to:to, type:'image', image:{link:link, caption:caption||''}}, {headers:{Authorization:'Bearer ' + WHATSAPP_TOKEN, 'Content-Type':'application/json'}});
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

app.get('/', (req,res)=> res.send('Pachapp AI Live - ROLLBACK V22'));
const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=> console.log('Live on ' + PORT));
