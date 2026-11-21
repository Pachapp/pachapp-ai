const express = require('express');
const path = require('path');
const app = express();

// This line lets Render show qr.png and Pachapp_1.png
app.use(express.static(__dirname));

app.get('/booking-form', (req, res) => {
  res.sendFile(path.join(__dirname, 'booking-form.html'));
});

app.get('/', (req, res) => {
  res.send('Pachapp AI is live');
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Server on ' + PORT));

// Start WhatsApp bot too
require('./pachapp-ai-cloud.js');
