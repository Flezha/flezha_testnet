/**
 * Trade message generator for Flezha testnet.
 *
 * Generates trade messages in the testnet's WebSocket **v2** trade format:
 *   {"channel":"trade","type":"update","data":[
 *     {"symbol":"BTC/DEMO1","side":"buy","price":42000.12,"qty":0.5,
 *      "ord_type":"market","trade_id":123,"timestamp":"2026-08-07T12:34:56.123456Z"}]}
 *
 * Config:
 *   pairs: string[]        — trading pairs (default: ["BTC/DEMO1"])
 *   basePrice: number      — starting price (default: 42000)
 *   volatility: number     — max price change per tick as fraction (default: 0.002)
 *   maxVolume: number      — max trade volume (default: 2.0)
 *   decimals: number       — decimal places a price is rounded to (default: 2)
 */

// Per-pair state survives across generate() calls
const pairState = {};

let tradeId = 0;

function getState(pair, config) {
  if (!pairState[pair]) {
    pairState[pair] = {
      price: config.basePrice || 42000,
    };
  }
  return pairState[pair];
}

// The v2 format stamps every trade RFC 3339 in UTC with microsecond precision.
function rfc3339(nowMs) {
  return `${new Date(nowMs).toISOString().replace('Z', '')}000Z`;
}

function generate(config) {
  const pairs = config.pairs || ['BTC/DEMO1'];
  const volatility = config.volatility || 0.002;
  const maxVolume = config.maxVolume || 2.0;
  const decimals = config.decimals ?? 2;

  // Pick a random pair for this tick
  const pair = pairs[Math.floor(Math.random() * pairs.length)];
  const state = getState(pair, config);

  // Random walk price
  const change = state.price * volatility * (Math.random() * 2 - 1);
  state.price = Math.max(1, state.price + change);

  // Generate 1-3 trades per message
  const tradeCount = Math.floor(Math.random() * 3) + 1;
  const timestamp = rfc3339(Date.now());
  const data = [];

  for (let i = 0; i < tradeCount; i++) {
    const tradePrice = state.price + (Math.random() - 0.5) * state.price * 0.0001;
    const volume = Math.random() * maxVolume + 0.00001;
    tradeId += 1;

    data.push({
      symbol: pair,
      side: Math.random() > 0.5 ? 'buy' : 'sell',
      price: Number(tradePrice.toFixed(decimals)),
      qty: Number(volume.toFixed(8)),
      ord_type: Math.random() > 0.3 ? 'market' : 'limit',
      trade_id: tradeId,
      timestamp,
    });
  }

  return JSON.stringify({ channel: 'trade', type: 'update', data });
}

module.exports = {
  name: 'trade',
  generate: generate,
  defaultConfig: {
    pairs: ['BTC/DEMO1', 'BTC/DEMO2'],
    basePrice: 42000,
    volatility: 0.002,
    maxVolume: 2.0,
    decimals: 2,
  },
};
