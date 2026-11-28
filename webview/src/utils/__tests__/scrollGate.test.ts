import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({ mobile: true }));
vi.mock('@/config/environment', () => ({ isMobile: () => env.mobile }));

type Gate = typeof import('../scrollGate');

/** A fresh copy of the module: its state (finger, last scroll, queue) is module-wide. */
async function loadGate(): Promise<Gate> {
  vi.resetModules();
  return import('../scrollGate');
}

describe('scrollGate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    env.mobile = true;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs at once on a phone that is not being scrolled', async () => {
    const gate = await loadGate();
    const fn = vi.fn();

    gate.whenScrollQuiet(fn);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('waits until 150ms after the last scroll, and a scroll meanwhile pushes it further', async () => {
    const gate = await loadGate();
    const fn = vi.fn();

    gate.noteScroll();
    gate.whenScrollQuiet(fn);
    vi.advanceTimersByTime(100);
    gate.noteScroll();
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('waits while a finger is on the chat, and for the quiet time after it lifts', async () => {
    const gate = await loadGate();
    const fn = vi.fn();

    gate.noteTouch(true);
    gate.whenScrollQuiet(fn);
    vi.advanceTimersByTime(1000);
    expect(gate.scrollGateBusy()).toBe(true);
    expect(fn).not.toHaveBeenCalled();

    gate.noteTouch(false);
    vi.advanceTimersByTime(100);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('runs what waits in the order it was queued, and queues behind it even once quiet', async () => {
    const gate = await loadGate();
    const order: string[] = [];

    gate.noteScroll();
    gate.whenScrollQuiet(() => order.push('page'));
    gate.whenScrollQuiet(() => order.push('loading done'));
    vi.advanceTimersByTime(150);
    // Quiet by now, but the queue has not been run yet: what comes now goes behind it.
    gate.whenScrollQuiet(() => order.push('next'));
    vi.advanceTimersByTime(100);

    expect(order).toEqual(['page', 'loading done', 'next']);
  });

  it('never waits on a desktop', async () => {
    env.mobile = false;
    const gate = await loadGate();
    const fn = vi.fn();

    gate.noteTouch(true);
    gate.noteScroll();
    gate.whenScrollQuiet(fn);

    expect(gate.scrollGateBusy()).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
