import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  ViewChild,
  computed,
  effect,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta } from '@angular/platform-browser';
import { BlogService } from '../../core/services/blog.service';
import { BlogStats } from '../../core/models/portfolio.model';
import { TocEntry, renderMarkdown } from './markdown';
import { highlightCode, renderCharts, renderDiagrams } from './enhance';

const VIEWED_KEY = 'blog:viewed';
const HEADER_OFFSET = 88;

@Component({
  selector: 'app-blog-post',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="fixed top-0 left-0 right-0 h-[3px] z-50 pointer-events-none" aria-hidden="true">
      <div class="h-full bg-accent origin-left" [style.transform]="'scaleX(' + progress() + ')'"></div>
    </div>

    <main class="w-full">
      <!-- Not found -->
      <section *ngIf="notFound()" class="container py-24">
        <p class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted m-0">404</p>
        <h1 class="text-[clamp(32px,4vw,56px)] font-medium tracking-[-0.02em] mt-3 mb-6">That post doesn't exist (yet).</h1>
        <a routerLink="/blog" class="inline-link"><span aria-hidden="true">←</span><span>All posts</span></a>
      </section>

      <article *ngIf="!notFound()" class="pb-20">
        <!-- Post header -->
        <header class="container pt-12 pb-10">
          <div class="max-w-[860px]">
            <a routerLink="/blog" class="inline-link mb-10"><span aria-hidden="true">←</span><span>All posts</span></a>
            <div class="flex flex-wrap gap-1.5 mb-5">
              <span *ngFor="let tag of meta()?.tags" class="font-mono text-[10px] uppercase tracking-[0.06em] px-1.5 py-0.5 bg-hair/50 text-muted">{{ tag }}</span>
            </div>
            <h1 class="font-serif font-normal text-[clamp(40px,5.4vw,76px)] leading-[1.04] tracking-[-0.015em] m-0 text-balance">
              {{ meta()?.title }}
            </h1>
            <p *ngIf="meta()?.description" class="text-muted text-[clamp(17px,1.8vw,21px)] leading-[1.55] mt-6 mb-0 max-w-[680px]">
              {{ meta()?.description }}
            </p>
            <div class="flex flex-wrap items-center gap-x-5 gap-y-2 mt-8 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
              <time *ngIf="meta()?.date" [attr.datetime]="meta()?.date">{{ meta()?.date | date: 'longDate' }}</time>
              <span *ngIf="meta()?.updated">Updated {{ meta()?.updated | date: 'mediumDate' }}</span>
              <span *ngIf="meta()">{{ meta()?.readingMinutes }} min read</span>
              <span *ngIf="stats()?.configured">{{ stats()?.views | number }} {{ stats()?.views === 1 ? 'view' : 'views' }}</span>
            </div>
          </div>
        </header>

        <figure *ngIf="meta()?.cover" class="container m-0 mb-14">
          <div class="bg-bg-2 border border-hair overflow-hidden">
            <img [src]="meta()?.cover" [alt]="meta()?.coverAlt" class="block w-full max-h-[620px] object-cover" />
          </div>
        </figure>

        <!-- Body + table of contents -->
        <div class="container grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_220px] gap-14">
          <div class="min-w-0">
            <div *ngIf="loading()" class="blog-loading">Loading post…</div>
            <div #content class="blog-prose" (click)="onContentClick($event)"></div>

            <!-- Reactions & share -->
            <div *ngIf="!loading()" class="mt-16 pt-8 border-t border-hair flex flex-wrap items-center justify-between gap-6 max-w-[720px]">
              <button
                type="button"
                (click)="like()"
                [disabled]="liked()"
                class="like-button"
                [attr.aria-pressed]="liked()">
                <span class="text-lg leading-none" aria-hidden="true">{{ liked() ? '♥' : '♡' }}</span>
                <span>{{ liked() ? 'Thanks!' : 'Enjoyed this?' }}</span>
                <span *ngIf="stats()?.configured" class="font-mono text-[11px] text-muted">{{ stats()?.likes | number }}</span>
              </button>

              <div class="flex items-center gap-4 text-[13px]">
                <span class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Share</span>
                <button type="button" (click)="copyLink()" class="inline-link bg-transparent border-x-0 border-t-0">
                  {{ copied() ? 'Copied ✓' : 'Copy link' }}
                </button>
                <a [href]="shareLinkedIn()" target="_blank" rel="noopener noreferrer" class="inline-link">LinkedIn</a>
                <a [href]="shareX()" target="_blank" rel="noopener noreferrer" class="inline-link">X</a>
              </div>
            </div>
          </div>

          <aside *ngIf="toc().length > 1" class="hidden lg:block" aria-label="On this page">
            <nav class="sticky top-24">
              <p class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted m-0 mb-4">On this page</p>
              <ol class="m-0 p-0 list-none border-l border-hair">
                <li *ngFor="let entry of toc()">
                  <a
                    [href]="'#' + entry.id"
                    (click)="scrollToHeading($event, entry.id)"
                    class="block py-1.5 text-[13px] leading-snug no-underline border-l -ml-px transition-colors"
                    [class.pl-4]="entry.depth === 2"
                    [class.pl-7]="entry.depth === 3"
                    [ngClass]="activeId() === entry.id ? 'text-accent border-accent' : 'text-muted border-transparent hover:text-fg'">
                    {{ entry.text }}
                  </a>
                </li>
              </ol>
            </nav>
          </aside>
        </div>

        <!-- Previous / next -->
        <nav *ngIf="newer() || older()" class="container mt-20" aria-label="More posts">
          <div class="grid grid-cols-1 md:grid-cols-2 border-t border-hair">
            <a *ngIf="older() as post" [routerLink]="['/blog', post.slug]" class="group py-8 md:pr-8 text-fg no-underline">
              <span class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">← Older</span>
              <span class="block mt-2 text-[20px] font-medium tracking-[-0.02em] group-hover:text-accent-ink transition-colors">{{ post.title }}</span>
            </a>
            <a *ngIf="newer() as post" [routerLink]="['/blog', post.slug]" class="group py-8 md:pl-8 text-fg no-underline md:text-right md:col-start-2 md:border-l md:border-hair">
              <span class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">Newer →</span>
              <span class="block mt-2 text-[20px] font-medium tracking-[-0.02em] group-hover:text-accent-ink transition-colors">{{ post.title }}</span>
            </a>
          </div>
        </nav>
      </article>
    </main>

    <!-- Image lightbox -->
    <div
      *ngIf="zoomed() as image"
      class="fixed inset-0 z-50 bg-fg/85 backdrop-blur-sm grid place-items-center p-6 cursor-zoom-out"
      (click)="zoomed.set(null)">
      <figure class="m-0 max-w-[min(1400px,100%)]">
        <img [src]="image.src" [alt]="image.alt" class="block max-w-full max-h-[85vh] mx-auto" />
        <figcaption *ngIf="image.alt" class="text-bg/80 text-sm text-center mt-3">{{ image.alt }}</figcaption>
      </figure>
    </div>
  `,
  styles: `
    .like-button {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 12px 18px;
      border: 1px solid var(--hair-2);
      background: transparent;
      color: var(--fg);
      font: 500 14px/1 var(--sans);
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s, transform 0.15s;
    }
    .like-button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent-ink); }
    .like-button:active:not(:disabled) { transform: scale(0.97); }
    .like-button[aria-pressed='true'] { color: var(--accent-ink); border-color: var(--accent); cursor: default; }
  `
})
export class BlogPostComponent {
  private route = inject(ActivatedRoute);
  private blog = inject(BlogService);
  private metaTags = inject(Meta);
  private destroyRef = inject(DestroyRef);

  @ViewChild('content', { static: false }) content?: ElementRef<HTMLElement>;

  readonly slug = signal<string>('');
  readonly loading = signal<boolean>(true);
  readonly notFound = signal<boolean>(false);
  readonly toc = signal<TocEntry[]>([]);
  readonly activeId = signal<string>('');
  readonly progress = signal<number>(0);
  readonly stats = signal<BlogStats | null>(null);
  readonly liked = signal<boolean>(false);
  readonly copied = signal<boolean>(false);
  readonly zoomed = signal<{ src: string; alt: string } | null>(null);

  readonly meta = computed(() => this.blog.posts().find(p => p.slug === this.slug()));
  private readonly index = computed(() => this.blog.posts().findIndex(p => p.slug === this.slug()));
  readonly newer = computed(() => (this.index() > 0 ? this.blog.posts()[this.index() - 1] : undefined));
  readonly older = computed(() => (this.index() >= 0 ? this.blog.posts()[this.index() + 1] : undefined));

  readonly shareLinkedIn = computed(
    () => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(this.url())}`
  );
  readonly shareX = computed(
    () =>
      `https://x.com/intent/post?url=${encodeURIComponent(this.url())}&text=${encodeURIComponent(this.meta()?.title ?? '')}`
  );

  private charts: { destroy(): void }[] = [];
  private observer?: IntersectionObserver;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.load(params.get('slug') ?? '');
    });
    this.destroyRef.onDestroy(() => this.teardown());

    // The index may arrive after the body, so keep the meta description in sync with it.
    effect(() => {
      const post = this.meta();
      if (!post) return;
      this.metaTags.updateTag({ name: 'description', content: post.description });
    });
  }

  private url(): string {
    return `${location.origin}/blog/${this.slug()}`;
  }

  private async load(slug: string): Promise<void> {
    this.teardown();
    this.slug.set(slug);
    this.loading.set(true);
    this.notFound.set(false);
    this.toc.set([]);
    this.stats.set(null);
    this.liked.set(this.blog.hasLiked(slug));
    window.scrollTo({ top: 0 });

    let markdown: string;
    try {
      markdown = await this.blog.getBody(slug);
    } catch {
      this.notFound.set(true);
      this.loading.set(false);
      return;
    }
    if (this.slug() !== slug) return;

    const { html, toc } = renderMarkdown(markdown, slug);
    this.toc.set(toc);
    this.loading.set(false);

    // Change detection has run while the body was fetched, so the article container exists.
    const root = this.content?.nativeElement;
    if (!root) return;
    root.innerHTML = html;

    this.observeHeadings(root);
    this.loadStats(slug);
    void highlightCode(root);
    void renderDiagrams(root);
    this.charts = await renderCharts(root);
  }

  private teardown(): void {
    this.charts.forEach(chart => chart.destroy());
    this.charts = [];
    this.observer?.disconnect();
  }

  private async loadStats(slug: string): Promise<void> {
    try {
      const viewed = this.viewedThisSession();
      const stats = viewed.includes(slug)
        ? await this.blog.getStats(slug)
        : await this.blog.recordView(slug);
      if (!viewed.includes(slug)) {
        sessionStorage.setItem(VIEWED_KEY, JSON.stringify([...viewed, slug]));
      }
      if (this.slug() === slug) this.stats.set(stats);
    } catch {
      // No /api locally (plain `ng serve`) or Redis not set up: counters just stay hidden.
    }
  }

  private viewedThisSession(): string[] {
    try {
      return JSON.parse(sessionStorage.getItem(VIEWED_KEY) ?? '[]');
    } catch {
      return [];
    }
  }

  private observeHeadings(root: HTMLElement): void {
    const headings = root.querySelectorAll<HTMLElement>('h2[id], h3[id]');
    this.observer = new IntersectionObserver(
      entries => {
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length) this.activeId.set(visible[0].target.id);
      },
      { rootMargin: `-${HEADER_OFFSET}px 0px -65% 0px` }
    );
    headings.forEach(h => this.observer!.observe(h));
  }

  @HostListener('window:scroll')
  onScroll(): void {
    const root = this.content?.nativeElement;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const total = rect.height - window.innerHeight + HEADER_OFFSET;
    const read = HEADER_OFFSET - rect.top;
    this.progress.set(total > 0 ? Math.min(1, Math.max(0, read / total)) : 0);
  }

  @HostListener('window:keydown.escape')
  closeZoom(): void {
    this.zoomed.set(null);
  }

  scrollToHeading(event: Event, id: string): void {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET, behavior: 'smooth' });
    history.replaceState(null, '', `#${id}`);
  }

  /** Delegated clicks for everything inside the rendered markdown. */
  async onContentClick(event: MouseEvent): Promise<void> {
    const target = event.target as HTMLElement;

    const copy = target.closest<HTMLButtonElement>('[data-copy]');
    if (copy) {
      const code = copy.closest('.blog-code')?.querySelector('code')?.textContent ?? '';
      await navigator.clipboard.writeText(code);
      copy.textContent = 'Copied ✓';
      setTimeout(() => (copy.textContent = 'Copy'), 1600);
      return;
    }

    const video = target.closest<HTMLElement>('[data-youtube]');
    if (video) {
      const id = video.dataset['youtube'];
      video.outerHTML = `<div class="blog-video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
      return;
    }

    if (target instanceof HTMLImageElement && target.hasAttribute('data-zoom')) {
      this.zoomed.set({ src: target.currentSrc || target.src, alt: target.alt });
      return;
    }

    // Base href is "/", so in-page "#id" links would otherwise jump to the home page.
    const anchor = target.closest<HTMLAnchorElement>('a[href^="#"]');
    if (anchor) {
      this.scrollToHeading(event, decodeURIComponent(anchor.getAttribute('href')!.slice(1)));
    }
  }

  async like(): Promise<void> {
    if (this.liked()) return;
    this.liked.set(true);
    const current = this.stats();
    if (current) this.stats.set({ ...current, likes: current.likes + 1 });
    try {
      this.stats.set(await this.blog.like(this.slug()));
    } catch {
      // Keep the optimistic state; the like is remembered locally either way.
    }
  }

  async copyLink(): Promise<void> {
    await navigator.clipboard.writeText(this.url());
    this.copied.set(true);
    setTimeout(() => this.copied.set(false), 1800);
  }
}
