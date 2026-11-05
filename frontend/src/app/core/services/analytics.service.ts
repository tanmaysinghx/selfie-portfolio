import { DestroyRef, Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

/** Seconds without input after which reading time stops counting. */
const IDLE_AFTER_MS = 30_000;
/** Heartbeat interval: active seconds are sent at most this often. */
const FLUSH_EVERY_S = 30;
/** After the API fails, stay quiet for this long instead of retrying every event. */
const BACKOFF_MS = 60_000;
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'wheel', 'touchstart'] as const;

/**
 * Privacy-friendly analytics: one page view per route, plus *active* time (tab visible and
 * the reader did something in the last 30 s). No third parties, no IPs, no fingerprinting;
 * Do Not Track and Global Privacy Control turn it off. Every failure is silent: analytics
 * must never affect the page.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private path = '';
  private pendingSeconds = 0;
  private lastActivity = Date.now();
  private quietUntil = 0;
  private started = false;

  /** Call once from the root component. */
  start(): void {
    if (this.started || typeof window === 'undefined' || !this.allowed()) return;
    this.started = true;

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => this.onNavigate(e.urlAfterRedirects));
    if (this.router.navigated) this.onNavigate(this.router.url);

    const markActive = () => (this.lastActivity = Date.now());
    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, markActive, { passive: true });
    const timer = window.setInterval(() => this.tick(), 1000);

    // Leaving or hiding the tab: send what we have. sendBeacon survives page unload.
    const onHide = () => { if (document.visibilityState === 'hidden') this.flush(true); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', () => this.flush(true));

    this.destroyRef.onDestroy(() => {
      window.clearInterval(timer);
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, markActive);
      document.removeEventListener('visibilitychange', onHide);
    });
  }

  private allowed(): boolean {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    return nav.doNotTrack !== '1' && nav.globalPrivacyControl !== true;
  }

  private onNavigate(url: string): void {
    const path = url.split(/[?#]/)[0] || '/';
    if (path === this.path) return; // fragment or query change on the same page
    this.flush(false);
    this.path = path;
    this.lastActivity = Date.now(); // arriving on a page counts as activity
    this.send({ type: 'pageview', path }, false);
  }

  private tick(): void {
    if (!this.path || document.visibilityState !== 'visible') return;
    if (Date.now() - this.lastActivity > IDLE_AFTER_MS) return;
    this.pendingSeconds++;
    if (this.pendingSeconds >= FLUSH_EVERY_S) this.flush(false);
  }

  private flush(beacon: boolean): void {
    const seconds = Math.min(this.pendingSeconds, 120);
    this.pendingSeconds = 0;
    if (seconds >= 1 && this.path) this.send({ type: 'engagement', path: this.path, seconds }, beacon);
  }

  private send(event: Record<string, unknown>, beacon: boolean): void {
    if (Date.now() < this.quietUntil) return;
    const body = JSON.stringify(event);
    try {
      if (beacon && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
        return;
      }
      fetch('/api/track', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true, credentials: 'same-origin' })
        .then(res => { if (res.status >= 500 || res.status === 404) this.quietUntil = Date.now() + BACKOFF_MS; })
        .catch(() => { this.quietUntil = Date.now() + BACKOFF_MS; });
    } catch {
      this.quietUntil = Date.now() + BACKOFF_MS;
    }
  }
}
