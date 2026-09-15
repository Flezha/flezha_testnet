/**
 * Kraken-format order book snapshot generator for Flezha testnet.
 *
 * Generates order book snapshots in the Kraken WebSocket **v2** book format, as
 * `wss://ws.kraken.com/v2` sends them:
 *   {"channel":"book","type":"snapshot","data":[
 *     {"symbol":"BTC/DEMO1","bids":[{"price":41999.75,"qty":1.5}],
 *      "asks":[{"price":42000.25,"qty":1.2}],"checksum":123456789}]}
 *
 * Config:
 *   pairs: string[]     — trading pairs (default: ["BTC/DEMO1"])
 *   levels: number      — number of bid/ask levels (default: 100)
 *   basePrice: number   — mid price (default: 42000)
 *   spread: number      — price increment between levels (default: 0.50)
 *   maxQuantity: number — max quantity per level (default: 5.0)
 */

// Per-pair state
const pairState = {};

function getState(pair, config) {
  if (!pairState[pair]) {
    pairState[pair] = {
      midPrice: config.basePrice || 42000,
    };
  }
  return pairState[pair];
}

function generate(config) {
  const pairs = config.pairs || ['BTC/DEMO1'];
  const levels = config.levels || 100;
  const spread = config.spread || 0.5;
  const maxQuantity = config.maxQuantity || 5.0;

  // Pick a random pair
  const pair = pairs[Math.floor(Math.random() * pairs.length)];
  const state = getState(pair, config);

  // Drift mid price slightly
  const drift = state.midPrice * 0.0005 * (Math.random() * 2 - 1);
  state.midPrice = Math.max(1, state.midPrice + drift);

  const halfSpread = spread / 2;

  const level = (price, i) => ({
    price: Number(price.toFixed(2)),
    // Quantity decays with distance from mid
    qty: Number((maxQuantity * Math.random() * (1 - i / (levels * 1.5)) + 0.001).toFixed(8)),
  });

  // Bid levels descend from mid - halfSpread; ask levels ascend from mid + halfSpread.
  const bids = [];
  const asks = [];
  for (let i = 0; i < levels; i++) {
    bids.push(level(state.midPrice - halfSpread - i * spread, i));
    asks.push(level(state.midPrice + halfSpread + i * spread, i));
  }

  return JSON.stringify({
    channel: 'book',
    type: 'snapshot',
    data: [{ symbol: pair, bids, asks, checksum: Math.floor(Math.random() * 4294967295) }],
  });
}

module.exports = {
  name: 'order_book',
  generate: generate,
  defaultConfig: {
    pairs: ['BTC/DEMO1', 'BTC/DEMO2'],
    levels: 100,
    basePrice: 42000,
    spread: 0.5,
    maxQuantity: 5.0,
  },
};
