import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'blog:reading';
const MAX_ENTRIES = 50;

export interface ReadingState {
  /** Share of the article read, 0–1. */
  progress: number;
  /** The last section heading the reader scrolled past, so they can resume there. */
  headingId?: string;
  headingText?: string;
  /** Sticky: once a post is finished it stays finished, even if it's re-read from the top. */
  finished: boolean;
  updatedAt: number;
}

/**
 * Remembers how far the reader got in each post. Lives only in this browser's localStorage,
 * so it's a convenience: every read and write tolerates storage being blocked or empty.
 */
@Injectable({
  providedIn: 'root'
})
export class ReadingProgressService {
  readonly states = signal<Record<string, ReadingState>>(this.load());

  get(slug: string): ReadingState | undefined {
    return this.states()[slug];
  }

  save(slug: string, update: Omit<ReadingState, 'finished' | 'updatedAt'> & { finished?: boolean }): void {
    const previous = this.states()[slug];
    const next: ReadingState = {
      ...update,
      finished: update.finished || previous?.finished === true,
      updatedAt: Date.now()
    };
    // Keep only the most recent posts so the entry never grows without bound.
    const entries = Object.entries({ ...this.states(), [slug]: next })
      .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_ENTRIES);
    this.states.set(Object.fromEntries(entries));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.states())); } catch { /* Optional browser storage. */ }
  }

  private load(): Record<string, ReadingState> {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
}
