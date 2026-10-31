import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BlogService } from '../../core/services/blog.service';
import { BlogComment } from '../../core/models/portfolio.model';

const NAME_KEY = 'blog:comment-name';
const DRAFT_KEY = 'blog:comment-draft:';
const MAX_NAME = 60;
const MAX_BODY = 1000;

/**
 * Comments for one post. The comments API is optional: when it is missing or down, readers can
 * still write a draft (kept on this device) and the rest of the article is unaffected.
 */
@Component({
  selector: 'app-blog-comments',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="blog-comments" aria-labelledby="comments-heading">
      <div class="comments-head">
        <h2 id="comments-heading">Comments</h2>
        <span *ngIf="state() === 'ready'" class="comments-count">{{ comments().length }}</span>
      </div>

      <div *ngIf="state() === 'loading'" class="blog-loading">Loading comments…</div>

      <div *ngIf="state() === 'unavailable'" class="comments-notice" role="status">
        <p>Comments aren’t open yet. You can write one now and it’ll be kept on this device until they are.</p>
        <button type="button" class="inline-link bg-transparent border-x-0 border-t-0" [disabled]="retrying()" (click)="retry()">
          {{ retrying() ? 'Checking…' : 'Check again' }}
        </button>
      </div>

      <p *ngIf="state() === 'ready' && !comments().length" class="comments-empty">No comments yet. Start the conversation.</p>

      <ol *ngIf="comments().length" class="comments-list">
        <li *ngFor="let comment of comments(); trackBy: trackById" class="comment">
          <span class="comment-avatar" aria-hidden="true">{{ initial(comment.name) }}</span>
          <div class="min-w-0">
            <p class="comment-meta">
              <strong>{{ comment.name }}</strong>
              <time [attr.datetime]="comment.createdAt">{{ comment.createdAt | date: 'mediumDate' }}</time>
              <span *ngIf="pendingIds().has(comment.id)" class="comment-pending">Awaiting approval</span>
            </p>
            <p class="comment-body">{{ comment.body }}</p>
          </div>
        </li>
      </ol>

      <form class="comment-form" (submit)="submit($event)" novalidate>
        <label class="comment-field">
          <span>Name</span>
          <input type="text" autocomplete="name" [maxLength]="maxName" [value]="name()"
            (input)="setName($any($event.target).value)" required />
        </label>
        <label class="comment-field">
          <span>Comment</span>
          <textarea rows="4" [maxLength]="maxBody" [value]="body()"
            (input)="setBody($any($event.target).value)" required
            placeholder="Questions, corrections and war stories welcome."></textarea>
        </label>
        <!-- Honeypot: hidden from people and assistive tech, tempting to bots. -->
        <label class="comment-trap" aria-hidden="true">
          Website <input type="text" tabindex="-1" autocomplete="off" [value]="website()" (input)="website.set($any($event.target).value)" />
        </label>

        <div class="comment-actions">
          <span class="comment-limit" [class.text-accent-ink]="body().length > maxBody - 50">{{ body().length }} / {{ maxBody }}</span>
          <button type="submit" class="comment-submit" [disabled]="!canSubmit()">
            {{ submitting() ? 'Posting…' : state() === 'unavailable' ? 'Comments open soon' : 'Post comment' }}
          </button>
        </div>
        <p *ngIf="message()" class="comment-message" role="status">{{ message() }}</p>
      </form>
    </section>
  `,
  styles: `
    .blog-comments { max-width: 720px; margin-top: 64px; padding-top: 32px; border-top: 1px solid var(--hair); }
    .comments-head { display: flex; align-items: baseline; gap: 12px; margin-bottom: 20px; }
    .comments-head h2 { margin: 0; font-size: clamp(24px, 2.4vw, 28px); font-weight: 500; letter-spacing: -0.02em; }
    .comments-count { font: 500 12px/1 var(--mono); color: var(--muted); }
    .comments-notice { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; padding: 14px 16px; background: var(--bg-2); border: 1px dashed var(--hair-2); font-size: 14px; line-height: 1.6; color: var(--muted); }
    .comments-notice p { margin: 0; flex: 1 1 320px; }
    .comments-empty { margin: 0; color: var(--muted); font-size: 15px; }
    .comments-list { list-style: none; margin: 0; padding: 0; }
    .comment { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 14px; padding: 20px 0; border-bottom: 1px solid var(--hair); }
    .comment-avatar { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; background: var(--bg-2); border: 1px solid var(--hair-2); font: 500 14px/1 var(--serif); color: var(--accent-ink); text-transform: uppercase; }
    .comment-meta { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; margin: 0 0 6px; font-size: 13px; color: var(--muted); }
    .comment-meta strong { color: var(--fg); font-weight: 600; font-size: 14px; }
    .comment-pending { font: 500 10px/1.4 var(--mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent-ink); }
    .comment-body { margin: 0; font-size: 15px; line-height: 1.75; white-space: pre-line; overflow-wrap: anywhere; color: #2c2824; }
    .comment-form { margin-top: 28px; display: grid; gap: 16px; }
    .comment-field { display: grid; gap: 6px; }
    .comment-field span { font: 500 11px/1.4 var(--mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
    .comment-field input, .comment-field textarea { width: 100%; padding: 12px 14px; border: 1px solid var(--hair-2); border-radius: 4px; background: var(--bg); color: var(--fg); font: 15px/1.6 var(--sans); }
    .comment-field textarea { resize: vertical; min-height: 120px; }
    .comment-field input:focus-visible, .comment-field textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; border-color: transparent; }
    .comment-trap { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
    .comment-actions { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .comment-limit { font: 11px/1 var(--mono); color: var(--muted); }
    .comment-submit { min-height: 44px; padding: 10px 18px; border: 1px solid var(--fg); background: var(--fg); color: var(--bg); font: 500 14px/1 var(--sans); cursor: pointer; transition: opacity 0.15s; }
    .comment-submit:disabled { opacity: 0.4; cursor: default; }
    .comment-message { margin: 0; font-size: 14px; line-height: 1.6; color: var(--muted); }
  `
})
export class BlogCommentsComponent {
  private blog = inject(BlogService);

  readonly slug = input.required<string>();
  /** The number of visible comments, or null while unknown. */
  readonly countChange = output<number | null>();

  readonly maxName = MAX_NAME;
  readonly maxBody = MAX_BODY;
  readonly state = signal<'loading' | 'ready' | 'unavailable'>('loading');
  readonly comments = signal<BlogComment[]>([]);
  readonly pendingIds = signal(new Set<string>());
  readonly name = signal(read(NAME_KEY));
  readonly body = signal('');
  readonly website = signal('');
  readonly submitting = signal(false);
  readonly retrying = signal(false);
  readonly message = signal('');

  readonly canSubmit = computed(() =>
    this.state() === 'ready' && !this.submitting() &&
    this.name().trim().length > 0 && this.body().trim().length >= 2
  );

  constructor() {
    effect(() => {
      const slug = this.slug();
      untracked(() => {
        this.body.set(read(DRAFT_KEY + slug));
        this.message.set('');
        this.pendingIds.set(new Set());
        void this.load(slug);
      });
    });
  }

  private async load(slug: string): Promise<void> {
    this.state.set('loading');
    this.comments.set([]);
    this.countChange.emit(null);
    try {
      const comments = await this.blog.getComments(slug);
      if (this.slug() !== slug) return;
      this.comments.set(comments);
      this.state.set('ready');
      this.countChange.emit(comments.length);
    } catch {
      if (this.slug() === slug) this.state.set('unavailable');
    }
  }

  async retry(): Promise<void> {
    this.retrying.set(true);
    try { await this.load(this.slug()); } finally { this.retrying.set(false); }
  }

  setName(value: string): void {
    this.name.set(value);
    write(NAME_KEY, value.trim());
  }

  setBody(value: string): void {
    this.body.set(value);
    write(DRAFT_KEY + this.slug(), value);
  }

  async submit(event: Event): Promise<void> {
    event.preventDefault();
    if (!this.canSubmit()) return;
    const slug = this.slug();
    this.submitting.set(true);
    this.message.set('');
    try {
      const { comment, status } = await this.blog.postComment(
        slug, this.name().trim().slice(0, MAX_NAME), this.body().trim().slice(0, MAX_BODY), this.website());
      if (this.slug() !== slug) return;
      this.comments.update(list => [...list, comment]);
      if (status === 'pending') this.pendingIds.update(ids => new Set(ids).add(comment.id));
      this.body.set('');
      write(DRAFT_KEY + slug, '');
      this.message.set(status === 'pending'
        ? 'Thanks! Your comment will appear for everyone once it’s approved.'
        : 'Thanks for commenting!');
      if (status === 'published') this.countChange.emit(this.comments().length - this.pendingIds().size);
    } catch {
      if (this.slug() === slug) this.message.set('We couldn’t post your comment. Your text is saved on this device. Please try again shortly.');
    } finally {
      if (this.slug() === slug) this.submitting.set(false);
    }
  }

  initial(name: string): string {
    return name.trim().charAt(0) || '?';
  }

  trackById(_: number, comment: BlogComment): string {
    return comment.id;
  }
}

// Drafts are a convenience; blocked storage just means they aren't remembered.
function read(key: string): string {
  try { return localStorage.getItem(key) ?? ''; } catch { return ''; }
}

function write(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value); else localStorage.removeItem(key);
  } catch { /* Optional browser storage. */ }
}
