import { isMobile } from '@/config/environment';

/**
 * Postpones transcript page changes while the user is scrolling on a phone (#747).
 *
 * When the transcript window adds a page above the user or drops one, the scroll position is corrected by the height
 * that was added or removed (by `useScrollAnchor` or by the browser's own scroll anchoring), so the content being read
 * stays in place. On iOS that correction does not always stick: while a finger is on the screen, while the page is
 * still coasting after a flick, and for a short moment afterwards, iOS may restore its own scroll position, and the
 * content jumps by the height of the page (often thousands of pixels). Measured on iOS 27: `scrollTop` jumped back by
 * the whole correction 15 to 420 ms after it was made, with nothing else on the page changing. See WebKit bug 310358.
 *
 * So on a phone, page changes (requesting a page, dropping one, and adding one that has arrived) wait until scrolling
 * has stopped: no finger on the chat and no scroll event for QUIET_MS. Waiting callbacks run in the order they were
 * queued, so a page and the end of its loading are applied together. On other devices nothing waits.
 */
const QUIET_MS = 150;

let touching = false;
let lastScrollAt = 0;
let waiting: Array<() => void> = [];
let timer: ReturnType<typeof setTimeout> | null = null;

/** True while the user is scrolling on a phone: a finger is on the chat, or it scrolled less than QUIET_MS ago. */
export function scrollGateBusy(): boolean {
  return isMobile() && (touching || Date.now() - lastScrollAt < QUIET_MS);
}

function flushWhenQuiet(): void {
  if (timer !== null) return;
  const wait = touching ? QUIET_MS : Math.max(0, QUIET_MS - (Date.now() - lastScrollAt)) + 10;
  timer = setTimeout(() => {
    timer = null;
    if (scrollGateBusy()) {
      flushWhenQuiet();
      return;
    }
    const run = waiting;
    waiting = [];
    for (const fn of run) fn();
  }, wait);
}

/**
 * Runs `fn` right away if scrolling has stopped and nothing else is waiting. Otherwise it is queued and runs, after
 * everything queued before it, once scrolling has stopped.
 */
export function whenScrollQuiet(fn: () => void): void {
  if (waiting.length === 0 && !scrollGateBusy()) {
    fn();
    return;
  }
  waiting.push(fn);
  flushWhenQuiet();
}

/** Call on every scroll event of the chat. */
export function noteScroll(): void {
  lastScrollAt = Date.now();
}

/**
 * Call when a finger touches the chat (`true`) and when the last finger is lifted (`false`). Lifting counts as a
 * scroll, so the coasting that may follow is waited out too.
 */
export function noteTouch(down: boolean): void {
  touching = down;
  if (!down) lastScrollAt = Date.now();
}
