import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as path from 'path';

import { loadGenerators } from './generator_loader';
import { SubscriptionRouter } from '../server/subscription_router';
import { DEFAULT_CONFIG } from '../server/testnet_config';
import { FakeTimers } from '../util/fake_timers.test-support';
import { STEADY_MARKET } from '../server/market';

function framesFor(channel: string): Record<string, any>[] {
  const sent: string[] = [];
  const router = new SubscriptionRouter(
    loadGenerators(path.resolve('generators')),
    DEFAULT_CONFIG,
    (m) => sent.push(m),
    STEADY_MARKET,
    new FakeTimers(),
    () => '2026-09-15T00:00:00.000Z'
  );

  router.handle(
    JSON.stringify({ method: 'subscribe', params: { channel, symbol: ['BTC/DEMO1'] }, req_id: 1 })
  );

  return sent.map((s) => JSON.parse(s)).filter((f) => f.channel === channel && f.data);
}

// fails when: the repository ships no generators, so a v2 subscribe is
// acked and then streams nothing.
test('the shipped trade generator streams v2 trades for the subscribed symbol', () => {
  const [frame] = framesFor('trade');

  assert.ok(frame, 'no trade frame after subscribing');
  assert.equal(frame.type, 'update');
  for (const trade of frame.data) {
    assert.equal(trade.symbol, 'BTC/DEMO1');
    assert.ok(['buy', 'sell'].includes(trade.side));
    assert.ok(trade.price > 0 && trade.qty > 0);
  }
});

test('the shipped order book generator streams a v2 snapshot for the subscribed symbol', () => {
  const [frame] = framesFor('book');

  assert.ok(frame, 'no book frame after subscribing');
  assert.equal(frame.type, 'snapshot');
  assert.equal(frame.data[0].symbol, 'BTC/DEMO1');
  assert.ok(frame.data[0].bids.length > 0 && frame.data[0].asks.length > 0);
});

// fails when: every price is rounded to two decimals, so a currency pair quoted
// to five moves in steps of a whole cent and a 2 % rule never sees it rise.
test('the trade generator rounds a price to the decimals its symbol is tuned for', () => {
  const generators = loadGenerators(path.resolve('generators'));
  const trade = generators.get('trade')!;
  const frame = JSON.parse(trade.generate({ pairs: ['EUR/USD'], basePrice: 1.085, decimals: 5 }));

  for (const t of frame.data) {
    assert.ok(Math.abs(t.price - 1.085) < 0.01, `price ${t.price} strayed from its base`);
    assert.equal(t.price, Number(t.price.toFixed(5)));
  }
  assert.ok(
    frame.data.some((t: { price: number }) => t.price !== Number(t.price.toFixed(2))),
    'every price was still rounded to two decimals'
  );
});

// fails when: the trade generator ignores the server's jump, or keeps the
// price up after it, so /jump starts a run of orders instead of exactly one.
test('a jump is one market trade at the moved price, and the price carries on from before it', () => {
  const trade = loadGenerators(path.resolve('generators')).get('trade')!;
  const config = { pairs: ['JUMP/TEST'], basePrice: 100, decimals: 5, volatility: 0.001 };
  const before = JSON.parse(trade.generate(config)).data[0].price;
  const spike = JSON.parse(trade.generate({ ...config, jumpPercent: 12 })).data;
  const after = JSON.parse(trade.generate(config)).data[0].price;

  assert.equal(spike.length, 1);
  assert.equal(spike[0].ord_type, 'market');
  assert.ok(Math.abs(spike[0].price / before - 1.12) < 0.003, `spike at ${spike[0].price}, not 12% above ${before}`);
  assert.ok(Math.abs(after / before - 1) < 0.003, `price stayed up at ${after} after the spike`);
});
