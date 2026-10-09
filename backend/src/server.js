require('dotenv').config();
const app = require('./app');
const env = require('./config/env');
const pool = require('./config/db');

const PORT = env.port;

app.listen(PORT, () => {
  console.log(`API WMS jalan di http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/v1/health`);
});
