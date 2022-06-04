require('dotenv').config();
const express = require('express');
const path = require('path');
const app = express();
const cors = require('cors');
const CronJob = require('cron').CronJob;
const db = require('./utils/db');
const { saveDefaultUsers, saveWinners, updateWinnersOfThisWeek } = require('./controllers/siteController');
const { CRON_TIMEZONE } = require('./utils/constants');

// Connect Database
try {
  db.connect(function (err) {
    if (err) {
      throw err;
    }
    console.log("DB Connected!");
  });
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

// Avoid cors error
app.use(cors({
  origin: '*'
}));

// Init Middleware
app.use(express.json());

// Define Routes
app.use('/api/site', require('./routes/siteRoutes'));
app.use('/api/game', require('./routes/gameRoutes'));

//  Insert default winners into db.
saveDefaultUsers();

new CronJob('0 0 18 * * 5', saveWinners, null, true, CRON_TIMEZONE);
new CronJob('*/20 * * * * *', updateWinnersOfThisWeek, null, true, CRON_TIMEZONE);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
