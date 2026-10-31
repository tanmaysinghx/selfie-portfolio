import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { BlogComment, BlogCommentPage, BlogPostMeta, BlogStats, PostedComment, ShareChannel } from '../models/portfolio.model';

const LIKED_KEY = 'blog:keystone-liked';

@Injectable({
  providedIn: 'root'
})
export class BlogService {
  private http = inject(HttpClient);

  readonly posts = signal<BlogPostMeta[]>([]);
  readonly isLoaded = signal<boolean>(false);

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
    return firstValueFrom(this.http.get<BlogStats>(`/api/stats?slug=${encodeURIComponent(slug)}`).pipe(timeout(5000))).then(this.requireStats);
  }

  recordView(slug: string): Promise<BlogStats> {
    return firstValueFrom(this.http.post<BlogStats>('/api/stats', { slug, action: 'view' }).pipe(timeout(5000))).then(this.requireStats);
  }

  async like(slug: string): Promise<BlogStats> {
    const stats = this.requireStats(await firstValueFrom(this.http.post<BlogStats>('/api/stats', { slug, action: 'like' }).pipe(timeout(5000))));
    this.rememberLiked(slug);
    return stats;
  }

  /** Counts a share. The share itself already happened, so callers treat failure as "count unknown". */
  async recordShare(slug: string, channel: ShareChannel): Promise<BlogStats> {
    return this.requireStats(await firstValueFrom(this.http.post<BlogStats>('/api/stats', { slug, action: 'share', channel }).pipe(timeout(5000))));
  }

  async getComments(slug: string): Promise<BlogComment[]> {
    const page = await firstValueFrom(this.http.get<BlogCommentPage>(`/api/comments?slug=${encodeURIComponent(slug)}`).pipe(timeout(5000)));
    if (!page || !Array.isArray(page.comments) || !page.comments.every(isComment)) throw new Error('Comments unavailable');
    return page.comments;
  }

  async postComment(slug: string, name: string, body: string, website: string): Promise<PostedComment> {
    // "website" is a honeypot: people never see the field, bots fill it in.
    const result = await firstValueFrom(this.http.post<PostedComment>('/api/comments', { slug, name, body, website }).pipe(timeout(8000)));
    if (!result || !isComment(result.comment) || (result.status !== 'published' && result.status !== 'pending')) throw new Error('Comments unavailable');
    return result;
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

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isComment(value: unknown): value is BlogComment {
  const c = value as BlogComment;
  return !!c && typeof c.id === 'string' && typeof c.name === 'string' && typeof c.body === 'string' &&
    typeof c.createdAt === 'string' && !Number.isNaN(Date.parse(c.createdAt));
}
