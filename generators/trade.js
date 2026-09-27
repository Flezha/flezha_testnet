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
 *   jumpPercent: number    — set by the server for one tick: send a single market
 *                            trade this percent away from the price, which then
 *                            carries on from where it was
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
  const timestamp = rfc3339(Date.now());

  const trade = (price, ordType) => {
    tradeId += 1;
    return {
      symbol: pair,
      side: Math.random() > 0.5 ? 'buy' : 'sell',
      price: Number(price.toFixed(decimals)),
      qty: Number((Math.random() * maxVolume + 0.00001).toFixed(8)),
      ord_type: ordType,
      trade_id: tradeId,
      timestamp,
    };
  };

  // A jump is one spike: a single market trade at the moved price. The walk is
  // left where it was, so the trades after it do not all look like the jump.
  if (config.jumpPercent !== undefined) {
    const data = [trade(state.price * (1 + config.jumpPercent / 100), 'market')];
    return JSON.stringify({ channel: 'trade', type: 'update', data });
  }

  // Random walk price
  const change = state.price * volatility * (Math.random() * 2 - 1);
  state.price = Math.max(Number.EPSILON, state.price + change);

  // Generate 1-3 trades per message
  const tradeCount = Math.floor(Math.random() * 3) + 1;
  const data = [];
  for (let i = 0; i < tradeCount; i++) {
    const tradePrice = state.price + (Math.random() - 0.5) * state.price * 0.0001;
    data.push(trade(tradePrice, Math.random() > 0.3 ? 'market' : 'limit'));
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
