require('dotenv').config();
const mongoose = require('mongoose');
const { execFileSync } = require('node:child_process');
const config = require('../src/config/env');
const { AccessGuard } = require('../src/modules/mqttAccess/access.guard');
const guard = new AccessGuard();
let stopping = false, timer;
function notify(value) {
  if (process.env.NOTIFY_SOCKET) execFileSync('systemd-notify', [value], {stdio:'ignore'});
}
async function stop(code) {
  if(stopping) return;
  stopping=true; clearTimeout(timer);
  try { await guard.setReady(false); } catch { /* database may be unavailable */ }
  try { await guard.purgeBrokerClients(); } catch { console.error('Broker cleanup unavailable; supervisor must stop broker.'); }
  await mongoose.disconnect();
  process.exit(code);
}
async function tick() {
  if(stopping) return;
  try {
    await guard.tick(); notify('WATCHDOG=1');
    timer=setTimeout(tick,config.mqttAccess.guardIntervalMs);
  } catch (err) { console.error('MQTT access guard failed:',err.message); await stop(1); }
}
(async () => {
  if(!config.mqttAccess.enabled) throw new Error('Set MQTT_ACCESS_ENABLED=true to run the access guard');
  if(!config.mongoUri) throw new Error('MONGODB_URI is required');
  mongoose.set('bufferCommands',false);
  await mongoose.connect(config.mongoUri,{serverSelectionTimeoutMS:3000,socketTimeoutMS:3000});
  // Load all policy models before evaluating grants.
  // Allow the supervised broker to start after this Type=simple service.
  const deadline = Date.now() + 20000;
  while (true) {
    try { await guard.start(); break; }
    catch (err) {
      if (Date.now() >= deadline || stopping) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  notify('READY=1'); notify('WATCHDOG=1');
  console.log('MQTT access guard ready');
  timer=setTimeout(tick,config.mqttAccess.guardIntervalMs);
})().catch(err => {console.error(err.message);stop(1);});
process.on('SIGINT',()=>stop(0));
process.on('SIGTERM',()=>stop(0));
