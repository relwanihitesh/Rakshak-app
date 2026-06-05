const dns = require('dns');
const mongoose = require('mongoose');

const DEFAULT_DNS_SERVERS = ['8.8.8.8', '1.1.1.1'];

function getDnsServers() {
  return (process.env.MONGO_DNS_SERVERS || '')
    .split(',')
    .map(server => server.trim())
    .filter(Boolean);
}

function isLoopbackDns(server) {
  return server === '::1' || server === '127.0.0.1' || server.startsWith('127.');
}

function configureMongoSrvDns(uri) {
  if (!uri || !uri.startsWith('mongodb+srv://')) return;

  const configuredServers = getDnsServers();
  const currentServers = dns.getServers();
  const shouldUseFallback =
    configuredServers.length > 0 ||
    (currentServers.length > 0 && currentServers.every(isLoopbackDns));

  if (!shouldUseFallback) return;

  const servers = configuredServers.length > 0 ? configuredServers : DEFAULT_DNS_SERVERS;
  dns.setServers(servers);
  console.log(`MongoDB SRV DNS servers: ${dns.getServers().join(', ')}`);
}

async function connectMongo() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI is missing. Add it to rakshak/.env.');
  }

  configureMongoSrvDns(uri);

  try {
    return await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000
    });
  } catch (err) {
    if (err.message && err.message.includes('querySrv')) {
      err.message +=
        ' | Atlas SRV lookup failed. Check DNS/VPN/firewall, or set MONGO_DNS_SERVERS=8.8.8.8,1.1.1.1 in .env.';
    }
    throw err;
  }
}

module.exports = connectMongo;
