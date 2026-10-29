import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { BlogPostMeta, BlogStats } from '../models/portfolio.model';

const LIKED_KEY = 'blog:liked';

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
    return firstValueFrom(this.http.get<BlogStats>(`/api/stats?slug=${encodeURIComponent(slug)}`));
  }

  recordView(slug: string): Promise<BlogStats> {
    return firstValueFrom(this.http.post<BlogStats>('/api/stats', { slug, action: 'view' }));
  }

  like(slug: string): Promise<BlogStats> {
    this.rememberLiked(slug);
    return firstValueFrom(this.http.post<BlogStats>('/api/stats', { slug, action: 'like' }));
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
