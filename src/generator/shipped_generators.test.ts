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

// fails when: the repository ships no generators, so a Kraken subscribe is
// acked and then streams nothing.
test('the shipped trade generator streams Kraken v2 trades for the subscribed symbol', () => {
  const [frame] = framesFor('trade');

  assert.ok(frame, 'no trade frame after subscribing');
  assert.equal(frame.type, 'update');
  for (const trade of frame.data) {
    assert.equal(trade.symbol, 'BTC/DEMO1');
    assert.ok(['buy', 'sell'].includes(trade.side));
    assert.ok(trade.price > 0 && trade.qty > 0);
  }
});

test('the shipped order book generator streams a Kraken v2 snapshot for the subscribed symbol', () => {
  const [frame] = framesFor('book');

  assert.ok(frame, 'no book frame after subscribing');
  assert.equal(frame.type, 'snapshot');
  assert.equal(frame.data[0].symbol, 'BTC/DEMO1');
  assert.ok(frame.data[0].bids.length > 0 && frame.data[0].asks.length > 0);
});
