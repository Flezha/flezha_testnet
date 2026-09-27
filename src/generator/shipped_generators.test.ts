import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as path from 'path';

import { loadGenerators } from './generator_loader';
import { SubscriptionRouter } from '../server/subscription_router';
import { DEFAULT_CONFIG } from '../server/testnet_config';
import { FakeTimers } from '../util/fake_timers.test-support';

function framesFor(channel: string): Record<string, any>[] {
  const sent: string[] = [];
  const router = new SubscriptionRouter(
    loadGenerators(path.resolve('generators')),
    DEFAULT_CONFIG,
    (m) => sent.push(m),
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
