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
import { Meta, Title } from '@angular/platform-browser';
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
        <header class="container article-shell post-header">
          <div class="post-heading">
            <a routerLink="/blog" class="post-back-link"><span aria-hidden="true">←</span><span>All posts</span></a>
            <h1 class="post-title">
              {{ meta()?.title }}
            </h1>
            <p *ngIf="meta()?.description" class="post-description">
              {{ meta()?.description }}
            </p>
            <div class="post-metadata">
              <time *ngIf="meta()?.date" [attr.datetime]="meta()?.date">{{ meta()?.date | date: 'longDate' }}</time>
              <span *ngIf="meta()?.updated">Updated {{ meta()?.updated | date: 'mediumDate' }}</span>
              <span *ngIf="meta()">{{ meta()?.readingMinutes }} min read</span>
              <span *ngIf="stats()?.configured">{{ stats()?.views | number }} {{ stats()?.views === 1 ? 'view' : 'views' }}</span>
            </div>
          </div>
        </header>

        <div *ngIf="toc().length > 1" class="container article-shell mb-10 lg:hidden">
          <details class="border-y border-hair py-4">
            <summary class="cursor-pointer text-sm font-medium py-2">On this page</summary>
            <nav aria-label="Article contents" class="pt-3 max-h-[60dvh] overflow-y-auto">
              <a *ngFor="let entry of sectionToc()"
                [href]="'#' + entry.id"
                (click)="scrollToHeading($event, entry.id)"
                class="block py-2 text-sm text-muted hover:text-accent no-underline"
                [class.pl-4]="entry.depth === 3">{{ entry.text }}</a>
            </nav>
          </details>
        </div>

        <!-- Body + table of contents -->
        <div class="container article-shell article-layout">
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

          <aside *ngIf="toc().length > 1" class="post-contents hidden lg:block" aria-label="On this page">
            <nav class="sticky top-24 max-h-[calc(100dvh-120px)] overflow-y-auto pr-2">
              <p class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted m-0 mb-4">On this page</p>
              <ol class="m-0 p-0 list-none border-l border-hair">
                <li *ngFor="let entry of sectionToc()">
                  <a
                    [href]="'#' + entry.id"
                    (click)="scrollToHeading($event, entry.id)"
                    class="toc-section-link block py-2 text-[12px] leading-relaxed no-underline border-l -ml-px pl-4 transition-colors"
                    [ngClass]="activeId() === entry.id ? 'text-accent border-accent' : 'text-muted border-transparent hover:text-fg'">
                    {{ entry.text }}
                  </a>
                </li>
              </ol>
            </nav>
          </aside>
        </div>

        <!-- Previous / next -->
        <nav *ngIf="newer() || older()" class="container article-shell mt-20" aria-label="More posts">
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
    <dialog #imageDialog class="image-viewer" aria-label="Image viewer"
      (cancel)="closeZoom()" (close)="closeZoom()" (click)="onViewerBackdrop($event)">
      <ng-container *ngIf="zoomed() as image">
        <div class="viewer-toolbar">
          <button type="button" (click)="changeZoom(-0.5)" [disabled]="zoomScale() <= 1" aria-label="Zoom out">−</button>
          <output aria-live="polite">{{ zoomScale() * 100 | number: '1.0-0' }}%</output>
          <button type="button" (click)="changeZoom(0.5)" [disabled]="zoomScale() >= 4" aria-label="Zoom in">+</button>
          <button type="button" (click)="zoomScale.set(1)">Fit</button>
          <a [href]="image.src" target="_blank" rel="noopener noreferrer">Open original ↗</a>
          <button type="button" (click)="closeZoom()" autofocus aria-label="Close image viewer">Close ✕</button>
        </div>
        <div class="viewer-viewport" tabindex="0" aria-label="Image; scroll to explore when zoomed">
          <img [src]="image.src" [alt]="image.alt" [style.width.px]="image.width * zoomScale()" />
        </div>
        <p class="viewer-caption">{{ image.alt }} <span>Use + to zoom, then scroll to explore. Escape to close.</span></p>
      </ng-container>
    </dialog>
  `,
  styles: `
    .image-viewer { width: 96vw; max-width: 1600px; max-height: 94dvh; padding: 0; border: 1px solid var(--hair); border-radius: 12px; background: var(--bg); color: var(--fg); overflow: hidden; }
    .image-viewer::backdrop { background: rgb(0 0 0 / 80%); backdrop-filter: blur(5px); }
    .viewer-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-bottom: 1px solid var(--hair); }
    .viewer-toolbar button, .viewer-toolbar a { min-height: 44px; padding: 8px 12px; border: 1px solid var(--hair); border-radius: 6px; background: var(--bg); color: var(--fg); font: inherit; font-size: 14px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
    .viewer-toolbar button:disabled { opacity: .4; cursor: default; }
    .viewer-toolbar output { min-width: 48px; text-align: center; font-size: 14px; }
    .viewer-viewport { height: 65dvh; overflow: auto; overscroll-behavior: contain; background: var(--bg-2); }
    .viewer-viewport img { display: block; max-width: none; height: auto; margin: 0 auto; }
    .viewer-caption { margin: 0; padding: 10px 16px; font-size: 13px; max-height: 12dvh; overflow: auto; }
    .viewer-caption span { display: block; color: var(--muted); margin-top: 4px; }
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
  private title = inject(Title);
  private metaTags = inject(Meta);
  private destroyRef = inject(DestroyRef);

  @ViewChild('content', { static: false }) content?: ElementRef<HTMLElement>;
  @ViewChild('imageDialog', { static: true }) imageDialog?: ElementRef<HTMLDialogElement>;

  readonly slug = signal<string>('');
  readonly loading = signal<boolean>(true);
  readonly notFound = signal<boolean>(false);
  readonly toc = signal<TocEntry[]>([]);
  readonly sectionToc = computed(() => this.toc().filter(entry => entry.depth === 2));
  readonly activeId = signal<string>('');
  readonly progress = signal<number>(0);
  readonly stats = signal<BlogStats | null>(null);
  readonly liked = signal<boolean>(false);
  readonly copied = signal<boolean>(false);
  readonly zoomed = signal<{ src: string; alt: string; width: number } | null>(null);
  readonly zoomScale = signal(1);
  private zoomObjectUrl?: string;
  private previousOverflow?: string;

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

    // The index may arrive after the body, so keep the tab title and description in sync with it.
    effect(() => {
      const post = this.meta();
      if (!post) return;
      this.title.setTitle(`${post.title} · Tanmay Singh`);
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
    this.closeZoom();
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
    const headings = root.querySelectorAll<HTMLElement>('h2[id]');
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
    this.imageDialog?.nativeElement.close();
    this.zoomed.set(null);
    if (this.zoomObjectUrl) URL.revokeObjectURL(this.zoomObjectUrl);
    this.zoomObjectUrl = undefined;
    if (this.previousOverflow !== undefined) document.body.style.overflow = this.previousOverflow;
    this.previousOverflow = undefined;
  }

  changeZoom(delta: number): void {
    this.zoomScale.update(value => Math.min(4, Math.max(1, value + delta)));
  }

  onViewerBackdrop(event: MouseEvent): void {
    const dialog = this.imageDialog?.nativeElement;
    if (!dialog || event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.closeZoom();
  }

  private openImage(src: string, alt: string, width: number, height: number): void {
    const fittedWidth = Math.min(width || 1200, window.innerWidth * .94, 1560,
      window.innerHeight * .65 * ((width || 1200) / (height || 630)));
    this.zoomed.set({ src, alt, width: fittedWidth });
    this.zoomScale.set(1);
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.imageDialog?.nativeElement.showModal();
  }

  scrollToHeading(event: Event, id: string): void {
    event.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET, behavior: 'smooth' });
    history.replaceState(null, '', `#${id}`);
    const details = (event.currentTarget as HTMLElement | null)?.closest('details');
    if (details) details.open = false;
  }

  /** Delegated clicks for everything inside the rendered markdown. */
  async onContentClick(event: MouseEvent): Promise<void> {
    const target = event.target as HTMLElement;

    const copy = target.closest<HTMLButtonElement>('[data-copy]');
    if (copy) {
      const panel = copy.closest<HTMLElement>('.blog-code');
      const code = panel?.dataset['code'] !== undefined
        ? decodeURIComponent(panel.dataset['code'])
        : panel?.querySelector('code')?.textContent ?? '';
      const label = copy.querySelector('[data-copy-label]') ?? copy;
      try {
        await navigator.clipboard.writeText(code);
        label.textContent = 'Copied';
        copy.dataset['copied'] = 'true';
      } catch {
        label.textContent = 'Select code';
        const source = panel?.querySelector('code');
        if (source) {
          const range = document.createRange();
          range.selectNodeContents(source);
          window.getSelection()?.removeAllRanges();
          window.getSelection()?.addRange(range);
        }
      }
      setTimeout(() => {
        label.textContent = 'Copy';
        delete copy.dataset['copied'];
      }, 2000);
      return;
    }

    const video = target.closest<HTMLElement>('[data-youtube]');
    if (video) {
      const id = video.dataset['youtube'];
      video.outerHTML = `<div class="blog-video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" title="YouTube video" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
      return;
    }

    const imageButton = target.closest<HTMLElement>('[data-zoom]');
    const image = imageButton?.querySelector('img');
    if (image) {
      this.openImage(image.currentSrc || image.src, image.alt, image.naturalWidth, image.naturalHeight);
      return;
    }

    const diagramButton = target.closest<HTMLElement>('[data-zoom-diagram]');
    const diagram = diagramButton?.closest('figure')?.querySelector('svg');
    if (diagram) {
      const copy = diagram.cloneNode(true) as SVGSVGElement;
      const box = diagram.viewBox.baseVal;
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      copy.setAttribute('width', String(box.width || 1200));
      copy.setAttribute('height', String(box.height || 630));
      copy.style.maxWidth = 'none';
      this.zoomObjectUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' }));
      this.openImage(this.zoomObjectUrl, 'Article architecture diagram', box.width, box.height);
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
