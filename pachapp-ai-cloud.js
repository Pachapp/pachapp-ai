const express = require('express');
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 10000;
const TOKEN = process.env.WHATSAPP_TOKEN || '';
const PHONE_ID = process.env.WHATSAPP_PHONE_ID || '';
const VERIFY = process.env.VERIFY_TOKEN || 'pachapp-verify-123';
console.log('TEST BOT BOOT token=' + !!TOKEN + ' phone=' + !!PHONE_ID);
app.get('/health', (req, res) => { res.json({ status: 'ok', has_token: !!TOKEN, has_phone_id: !!PHONE_ID }); });
app.get('/webhook', (req, res) => { if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY) return res.status(200).send(req.query['hub.challenge']); return res.sendStatus(403); });
app.post('/webhook', async (req, res) => {
  console.log('WEBHOOK HIT ' + JSON.stringify(req.body).slice(0, 1000));
  res.sendStatus(200);
  try {
    const body = req.body;
    if (body.object !== 'whatsapp_business_account') return;
    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const v = change.value || {};
        for (const m of v.messages || []) {
          const from = m.from;
          const text = (m.text && m.text.body) || 'hi';
          console.log('GOT MSG from ' + from + ' : ' + text);
          const r = await fetch('https://graph.facebook.com/v21.0/' + PHONE_ID + '/messages', { method: 'POST', headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: from, type: 'text', text: { body: 'Test reply OK - I got: ' + text } }) });
          const j = await r.json();
          console.log('SEND RESULT ' + r.status + ' ' + JSON.stringify(j).slice(0, 500));
        }
      }
    }
  } catch (e) { console.log('ERR ' + e.message); }
});
app.listen(PORT, function () { console.log('TEST BOT LIVE on ' + PORT); });
