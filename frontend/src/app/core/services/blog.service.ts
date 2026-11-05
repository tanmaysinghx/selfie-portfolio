import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, firstValueFrom, timeout } from 'rxjs';
import { BlogComment, BlogCommentPage, BlogPostMeta, BlogStats, PostedComment, ShareChannel } from '../models/portfolio.model';

const LIKED_KEY = 'blog:keystone-liked';
/** After the API looks down, skip calls for this long so pages don't wait on timeouts. */
const BACKOFF_MS = 30_000;

/** Thrown instead of calling the API while it is known to be down. */
export class ApiUnavailableError extends Error {
  constructor() { super('API temporarily unavailable'); }
}

@Injectable({
  providedIn: 'root'
})
export class BlogService {
  private http = inject(HttpClient);

  readonly posts = signal<BlogPostMeta[]>([]);
  readonly isLoaded = signal<boolean>(false);
  /** Epoch ms until which reaction/comment calls fail fast. 0 = API assumed healthy. */
  private apiDownUntil = 0;

  constructor() {
    this.loadIndex();
  }

  async loadIndex(): Promise<void> {
    try {
      this.posts.set(await firstValueFrom(this.http.get<BlogPostMeta[]>('/posts/index.json')));
    } catch (err) {
      console.warn('Error fetching blog index:', err);
    } finally {
      this.isLoaded.set(true);
    }
  }

  /** Raw markdown of a post with its frontmatter stripped. */
  async getBody(slug: string): Promise<string> {
    const source = await firstValueFrom(
      this.http.get(`/posts/${slug}/index.md`, { responseType: 'text' })
    );
    // Dev servers and SPA rewrites answer unknown paths with index.html instead of a 404.
    if (/^\s*<!doctype html/i.test(source)) {
      throw new Error(`No post named "${slug}"`);
    }
    return source.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  }

  getStats(slug: string): Promise<BlogStats> {
    return this.call(this.http.get<BlogStats>(`/api/stats?slug=${encodeURIComponent(slug)}`), 5000).then(this.requireStats);
  }

  recordView(slug: string): Promise<BlogStats> {
    return this.call(this.http.post<BlogStats>('/api/stats', { slug, action: 'view' }), 5000).then(this.requireStats);
  }

  async like(slug: string): Promise<BlogStats> {
    const stats = this.requireStats(await this.call(this.http.post<BlogStats>('/api/stats', { slug, action: 'like' }), 5000));
    this.rememberLiked(slug);
    return stats;
  }

  /** Counts a share. The share itself already happened, so callers treat failure as "count unknown". */
  async recordShare(slug: string, channel: ShareChannel): Promise<BlogStats> {
    return this.requireStats(await this.call(this.http.post<BlogStats>('/api/stats', { slug, action: 'share', channel }), 5000));
  }

  async getComments(slug: string): Promise<BlogComment[]> {
    const page = await this.call(this.http.get<BlogCommentPage>(`/api/comments?slug=${encodeURIComponent(slug)}`), 5000);
    if (!page || !Array.isArray(page.comments) || !page.comments.every(isComment)) throw new Error('Comments unavailable');
    return page.comments;
  }

  async postComment(slug: string, name: string, body: string, website: string): Promise<PostedComment> {
    // "website" is a honeypot: people never see the field, bots fill it in.
    const result = await this.call(this.http.post<PostedComment>('/api/comments', { slug, name, body, website }), 8000);
    if (!result || !isComment(result.comment) || (result.status !== 'published' && result.status !== 'pending')) throw new Error('Comments unavailable');
    return result;
  }

  /** Lets a "Retry" button try the API again even inside the backoff window. */
  resetBackoff(): void {
    this.apiDownUntil = 0;
  }

  /**
   * Runs an API call with a timeout. Outages (network errors, timeouts, 5xx, a SPA page
   * instead of JSON) open a short backoff window during which calls fail immediately,
   * so pages keep working without waiting on a backend that is down.
   */
  private async call<T>(request: Observable<T>, ms: number): Promise<T> {
    if (Date.now() < this.apiDownUntil) throw new ApiUnavailableError();
    try {
      const value = await firstValueFrom(request.pipe(timeout(ms)));
      this.apiDownUntil = 0;
      return value;
    } catch (err) {
      if (isOutage(err)) this.apiDownUntil = Date.now() + BACKOFF_MS;
      throw err;
    }
  }

  // Not-yet-deployed endpoints can answer with a 404, a 503 or (in dev) the SPA's index.html,
  // so every response is validated before the page trusts it.
  private requireStats(value: BlogStats): BlogStats {
    if (!value || value.configured !== true || !isCount(value.likes) || !isCount(value.views)) throw new Error('Reactions unavailable');
    return {
      views: value.views,
      likes: value.likes,
      configured: true,
      ...(isCount(value.shares) ? { shares: value.shares } : {}),
      ...(isCount(value.comments) ? { comments: value.comments } : {})
    };
  }

  hasLiked(slug: string): boolean {
    return this.likedSlugs().includes(slug);
  }

  private likedSlugs(): string[] {
    try {
      return JSON.parse(localStorage.getItem(LIKED_KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  private rememberLiked(slug: string): void {
    try {
      localStorage.setItem(LIKED_KEY, JSON.stringify([...new Set([...this.likedSlugs(), slug])]));
    } catch {
      // Storage blocked: the server still dedupes likes per visitor.
    }
  }
}

/** Client errors (400, 403, 429…) mean the API is up; only outages trigger the backoff. */
function isOutage(err: unknown): boolean {
  if (err instanceof HttpErrorResponse) return err.status === 0 || err.status >= 500 || err.status === 404;
  return true; // timeouts and unparseable responses
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isComment(value: unknown): value is BlogComment {
  const c = value as BlogComment;
  return !!c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.body === 'string' &&
    typeof c.createdAt === 'string' && !Number.isNaN(Date.parse(c.createdAt));
}
