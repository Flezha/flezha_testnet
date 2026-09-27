/**
 * The generated market's two controls: a pause that stops every generator
 * tick, and a one-off price jump waiting for a symbol's next trade.
 *
 * The manual driver sets them through the server; every generator timer reads
 * them on each tick. A jump is taken once, by whichever connection's trade
 * tick for that symbol comes first, so a symbol subscribed on two sockets
 * still jumps once.
 */

/** The channel a jump moves: the traded price. */
const JUMP_CHANNEL = 'trade';

/** What a generator tick reads. */
export interface MarketState {
  paused(): boolean;
  /** The percent to move `symbol` by on this tick of `channel`, once. */
  takeJump(channel: string, symbol: string): number | undefined;
}

export class Market implements MarketState {
  private isPaused = false;
  private readonly jumps = new Map<string, number>();

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  paused(): boolean {
    return this.isPaused;
  }

  /** A later jump for the same symbol replaces one not yet taken. */
  jump(symbol: string, percent: number): void {
    this.jumps.set(symbol, percent);
  }

  takeJump(channel: string, symbol: string): number | undefined {
    if (channel !== JUMP_CHANNEL) return undefined;
    const percent = this.jumps.get(symbol);
    this.jumps.delete(symbol);
    return percent;
  }
}

/** A market nobody controls: never paused, never jumps. */
export const STEADY_MARKET: MarketState = {
  paused: () => false,
  takeJump: () => undefined,
};
