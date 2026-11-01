import { Component, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Params, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BlogService } from '../../core/services/blog.service';
import { ReadingProgressService } from '../../core/services/reading-progress.service';
import { BlogPostMeta } from '../../core/models/portfolio.model';

const PAGE_SIZE = 5;

@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="w-full">
      <section class="blog-list-heading pt-12 pb-10" aria-labelledby="blog-title">
        <div class="container">
          <p class="font-mono text-[10px] tracking-[0.08em] uppercase text-muted m-0 mb-5">
            Blog · {{ blog.posts().length }} {{ blog.posts().length === 1 ? 'post' : 'posts' }}
          </p>
          <h1 id="blog-title" class="m-0 text-[clamp(38px,4.5vw,64px)] font-medium tracking-[-0.045em] leading-[0.98]">
            Notes from the
            <span class="font-serif italic font-normal tracking-[-0.02em] heading-highlight">workbench.</span>
          </h1>
          <p class="text-muted text-[clamp(16px,1.7vw,19px)] mt-6 mb-0 max-w-[620px] leading-relaxed">
            Notes on Java, building software, and what I learn along the way.
          </p>

          <a *ngIf="continueReading() as item" [routerLink]="['/blog', item.post.slug]" class="continue-card group">
            <span class="continue-ring" [style.--p]="percent(item.state.progress)" aria-hidden="true"></span>
            <span class="min-w-0">
              <span class="block font-mono text-[10px] uppercase tracking-[0.08em] text-muted">Continue reading · {{ percent(item.state.progress) }}%</span>
              <span class="block mt-1 font-medium truncate group-hover:text-accent-ink transition-colors">{{ item.post.title }}</span>
              <span *ngIf="item.state.headingText" class="block text-[13px] text-muted truncate">{{ item.state.headingText }}</span>
            </span>
            <span class="ml-auto text-muted" aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      <section class="pt-4 pb-16">
        <div class="container">
          <p *ngIf="blog.isLoaded() && !blog.posts().length" class="text-muted text-[15px]">
            Nothing published yet. The first post is on its way.
          </p>

          <!-- Featured (or latest) post, only on the unfiltered first page -->
          <a
            *ngIf="lead() as post"
            [routerLink]="['/blog', post.slug]"
            class="group grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-7 lg:gap-12 items-center text-fg no-underline mb-16">
            <div class="aspect-[16/9] overflow-hidden bg-bg-2 border border-hair rounded-md">
              <img
                *ngIf="post.cover; else coverFallback"
                [src]="post.cover"
                [alt]="post.coverAlt"
                class="w-full h-full object-contain transition-transform duration-700 group-hover:scale-[1.03]" />
              <ng-template #coverFallback>
                <div class="w-full h-full grid place-items-center font-serif italic text-[clamp(32px,4vw,56px)] text-hair-2 p-8 text-center">
                  {{ post.title }}
                </div>
              </ng-template>
            </div>
            <div>
              <p class="font-mono text-[11px] tracking-[0.08em] uppercase text-accent m-0 mb-4">
                {{ post.featured ? 'Featured post' : 'Latest post' }} · {{ post.date | date: 'mediumDate' }}
              </p>
              <h2 class="font-serif font-normal text-[clamp(30px,3.2vw,44px)] leading-[1.08] m-0 group-hover:text-accent-ink transition-colors text-pretty">
                {{ post.title }}
              </h2>
              <p class="text-muted text-[15px] leading-[1.8] mt-5 mb-0 line-clamp-3">{{ post.description }}</p>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mt-6">
                <span class="inline-link"><span>Read the post</span><span aria-hidden="true">→</span></span>
                <span class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">{{ post.readingMinutes }} min read</span>
              </div>
            </div>
          </a>

          <div *ngIf="blog.posts().length" #listTop class="list-top">
            <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-6">
              <h2 class="m-0 text-[clamp(22px,2.2vw,28px)] font-medium tracking-[-0.02em]">
                {{ filtering() ? 'Results' : 'More articles' }}
              </h2>
              <div class="search" role="search">
                <svg aria-hidden="true" viewBox="0 0 20 20" class="search-icon"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4.5 4.5" /></svg>
                <label for="blog-search" class="sr-only">Search posts</label>
                <input
                  #searchInput
                  id="blog-search"
                  type="search"
                  autocomplete="off"
                  placeholder="Search posts"
                  [value]="query()"
                  (input)="setQuery(searchInput.value)"
                  (keydown.escape)="setQuery(''); searchInput.blur()" />
                <kbd *ngIf="!query()" aria-hidden="true">/</kbd>
              </div>
            </div>

            <div *ngIf="blog.posts().length > 3 && tags().length" class="flex flex-wrap gap-2 mb-8" role="group" aria-label="Filter by topic">
              <button
                type="button"
                (click)="setTag(null)"
                [attr.aria-pressed]="activeTag() === null"
                class="tag-chip">
                All
              </button>
              <button
                *ngFor="let tag of tags()"
                type="button"
                (click)="setTag(activeTag() === tag ? null : tag)"
                [attr.aria-pressed]="activeTag() === tag"
                class="tag-chip">
                {{ tag }}
              </button>
            </div>

            <p class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted m-0 mb-3 min-h-[1em]" aria-live="polite">
              <ng-container *ngIf="filtering(); else pageInfo">
                {{ matches().length }} {{ matches().length === 1 ? 'post' : 'posts' }}<ng-container *ngIf="query().trim()"> for “{{ query().trim() }}”</ng-container><ng-container *ngIf="activeTag()"> in {{ activeTag() }}</ng-container>
              </ng-container>
              <ng-template #pageInfo>
                <ng-container *ngIf="pageCount() > 1">Page {{ page() }} of {{ pageCount() }}</ng-container>
              </ng-template>
            </p>

            <div *ngIf="filtering() && !matches().length" class="border-t border-hair py-10">
              <p class="m-0 text-[15px]">No posts match that.</p>
              <button type="button" class="clear-btn inline-link mt-4" (click)="clearFilters()">Clear search and filters</button>
            </div>

            <ol *ngIf="pageItems().length" class="m-0 p-0 list-none border-t border-hair">
              <li *ngFor="let post of pageItems()" class="border-b border-hair">
                <a
                  [routerLink]="['/blog', post.slug]"
                  class="group grid grid-cols-1 md:grid-cols-[140px_1fr_180px] gap-3 md:gap-8 py-8 text-fg no-underline items-start">
                  <div class="flex md:flex-col gap-2 pt-2">
                    <time [attr.datetime]="post.date" class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
                      {{ post.date | date: 'mediumDate' }}
                    </time>
                    <span *ngIf="post.featured" class="font-mono text-[10px] uppercase tracking-[0.08em] text-accent">Featured</span>
                    <ng-container *ngIf="readState(post.slug) as state">
                      <span *ngIf="state.finished; else partlyRead" class="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">✓ Read</span>
                      <ng-template #partlyRead>
                        <span class="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">{{ percent(state.progress) }}% read</span>
                      </ng-template>
                    </ng-container>
                  </div>
                  <div>
                    <h3 class="m-0 text-[clamp(22px,2.2vw,30px)] font-medium tracking-[-0.02em] leading-[1.2] group-hover:text-accent-ink transition-colors">
                      {{ post.title }}
                    </h3>
                    <p class="m-0 mt-2 text-muted text-[15px] leading-[1.65] max-w-[640px]">{{ post.description }}</p>
                    <div class="flex flex-wrap items-center gap-1.5 mt-3">
                      <span *ngFor="let tag of post.tags" class="font-mono text-[10px] uppercase tracking-[0.06em] px-1.5 py-0.5 bg-hair/50 text-muted">{{ tag }}</span>
                      <span class="font-mono text-[10px] uppercase tracking-[0.06em] text-muted ml-1">{{ post.readingMinutes }} min read</span>
                    </div>
                  </div>
                  <div class="hidden md:block aspect-[4/3] overflow-hidden bg-bg-2 border border-hair">
                    <img
                      *ngIf="post.cover"
                      [src]="post.cover"
                      [alt]="post.coverAlt"
                      loading="lazy"
                      class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  </div>
                </a>
              </li>
            </ol>

            <nav *ngIf="pageCount() > 1" class="pager" aria-label="Blog pages">
              <button type="button" class="pager-btn" [disabled]="page() === 1" (click)="goTo(page() - 1)">
                <span aria-hidden="true">←</span> Newer
              </button>
              <ol class="pager-pages">
                <li *ngFor="let p of pageLinks()">
                  <span *ngIf="p === null; else pageBtn" class="pager-gap" aria-hidden="true">…</span>
                  <ng-template #pageBtn>
                    <button
                      type="button"
                      class="pager-num"
                      [attr.aria-current]="p === page() ? 'page' : null"
                      [attr.aria-label]="'Page ' + p"
                      (click)="goTo(p!)">{{ p }}</button>
                  </ng-template>
                </li>
              </ol>
              <button type="button" class="pager-btn" [disabled]="page() === pageCount()" (click)="goTo(page() + 1)">
                Older <span aria-hidden="true">→</span>
              </button>
            </nav>
          </div>
        </div>
      </section>
    </main>
  `,
  styles: `
    .tag-chip {
      font: 500 11px/1 var(--mono);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 8px 12px;
      border: 1px solid var(--hair-2);
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      transition: background-color 0.15s, color 0.15s, border-color 0.15s;
    }
    .tag-chip:hover { color: var(--fg); border-color: var(--fg); }
    .tag-chip[aria-pressed='true'] { background: var(--fg); border-color: var(--fg); color: var(--bg); }

    .list-top { scroll-margin-top: 96px; }

    .continue-card {
      display: flex;
      align-items: center;
      gap: 14px;
      max-width: 520px;
      margin-top: 28px;
      padding: 12px 16px;
      border: 1px solid var(--hair-2);
      color: var(--fg);
      text-decoration: none;
      transition: border-color 0.15s;
    }
    .continue-card:hover { border-color: var(--fg); }
    .continue-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    /* Progress ring: --p is the percent read. */
    .continue-ring {
      flex: none;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: conic-gradient(var(--accent) calc(var(--p) * 1%), var(--hair) 0);
      mask: radial-gradient(circle, transparent 10px, #000 11px);
    }

    .search { position: relative; width: 100%; max-width: 340px; }
    .search input {
      width: 100%;
      font-family: inherit;
      font-size: 15px;
      line-height: 1.2;
      padding: 11px 36px 11px 38px;
      border: 1px solid var(--hair-2);
      background: transparent;
      color: var(--fg);
      border-radius: 0;
      transition: border-color 0.15s;
    }
    .search input::placeholder { color: var(--muted); }
    .search input:focus { outline: none; border-color: var(--fg); }
    .search input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .search-icon {
      position: absolute; left: 12px; top: 50%; width: 16px; height: 16px; transform: translateY(-50%);
      fill: none; stroke: var(--muted); stroke-width: 1.8; stroke-linecap: round; pointer-events: none;
    }
    .search kbd {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      font: 500 11px/1 var(--mono); color: var(--muted);
      border: 1px solid var(--hair-2); padding: 3px 6px; pointer-events: none;
    }

    .clear-btn { background: transparent; border-width: 0 0 1px; }

    .pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 32px; }
    .pager-pages { display: flex; gap: 4px; list-style: none; margin: 0; padding: 0; }
    .pager-btn, .pager-num {
      font: 500 12px/1 var(--mono);
      letter-spacing: 0.06em;
      text-transform: uppercase;
      border: 1px solid var(--hair-2);
      background: transparent;
      color: var(--fg);
      cursor: pointer;
      min-height: 40px;
      transition: background-color 0.15s, color 0.15s, border-color 0.15s;
    }
    .pager-btn { padding: 0 14px; display: inline-flex; align-items: center; gap: 6px; }
    .pager-num { min-width: 40px; }
    .pager-btn:hover:not(:disabled), .pager-num:hover { border-color: var(--fg); }
    .pager-btn:disabled { color: var(--muted); opacity: 0.5; cursor: default; }
    .pager-num[aria-current='page'] { background: var(--fg); border-color: var(--fg); color: var(--bg); }
    .pager-gap { display: inline-grid; place-items: center; min-width: 24px; min-height: 40px; color: var(--muted); }
    @media (max-width: 520px) { .pager-pages { display: none; } }
  `
})
export class BlogListComponent {
  readonly blog = inject(BlogService);
  private reading = inject(ReadingProgressService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private listTop = viewChild<ElementRef<HTMLElement>>('listTop');
  private searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly activeTag = signal<string | null>(null);
  readonly query = signal('');
  private readonly requestedPage = signal(1);

  constructor() {
    // Tag, search and page live in the URL (?tag=java&q=cookies&page=2) so any view can be linked to.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      this.activeTag.set(params.get('tag'));
      this.query.set(params.get('q') ?? '');
      this.requestedPage.set(Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1));
    });
  }

  /** "/" focuses search, like most docs sites. Ignored while typing in a field. */
  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    this.searchInput()?.nativeElement.focus();
  }

  setTag(tag: string | null): void {
    this.updateUrl({ tag, page: null });
  }

  setQuery(value: string): void {
    this.query.set(value);
    this.updateUrl({ q: value.trim() ? value : null, page: null });
  }

  clearFilters(): void {
    this.query.set('');
    this.updateUrl({ q: null, tag: null, page: null });
  }

  goTo(page: number): void {
    this.updateUrl({ page: page > 1 ? page : null });
    this.listTop()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  private updateUrl(queryParams: Params): void {
    this.router.navigate([], { queryParams, queryParamsHandling: 'merge', replaceUrl: true });
  }

  readonly tags = computed(() => [...new Set(this.blog.posts().flatMap(p => p.tags))].sort());

  /** The post most recently left part-way through, if any. */
  readonly continueReading = computed(() => {
    const states = this.reading.states();
    return this.blog.posts()
      .map(post => ({ post, state: states[post.slug] }))
      .filter(item => item.state && item.state.progress >= 0.05 && item.state.progress < 0.95)
      .sort((a, b) => b.state.updatedAt - a.state.updatedAt)[0];
  });

  /** Finished, or at least 5% read: anything less is just a peek. */
  readState(slug: string) {
    const state = this.reading.states()[slug];
    return state && (state.finished || state.progress >= 0.05) ? state : undefined;
  }

  percent(value: number): number {
    return Math.round(value * 100);
  }

  /** Newest first. The index is already sorted, but the list shouldn't depend on that. */
  private readonly newest = computed(() => [...this.blog.posts()].sort((a, b) => b.date.localeCompare(a.date)));

  readonly filtering = computed(() => !!this.query().trim() || !!this.activeTag());

  /** Every word must appear somewhere in the title, description or tags. */
  readonly matches = computed(() => {
    const tag = this.activeTag();
    const words = this.query().toLowerCase().split(/\s+/).filter(Boolean);
    return this.newest().filter(p => {
      if (tag && !p.tags.includes(tag)) return false;
      const haystack = `${p.title} ${p.description} ${p.tags.join(' ')}`.toLowerCase();
      return words.every(w => haystack.includes(w));
    });
  });

  /** Featured posts pinned on top (newest first), then everything else newest first. */
  private readonly pinned = computed(() => [
    ...this.newest().filter(p => p.featured),
    ...this.newest().filter(p => !p.featured)
  ]);

  /** The top pinned post gets the big card, but only on the plain first page. */
  readonly lead = computed<BlogPostMeta | undefined>(() =>
    !this.filtering() && this.page() === 1 ? this.pinned()[0] : undefined
  );

  // Unfiltered pages leave out the lead post, since it already has the big card.
  // Search and tag results are plain newest-first.
  private readonly listed = computed(() =>
    this.filtering() ? this.matches() : this.pinned().slice(1)
  );

  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.listed().length / PAGE_SIZE)));
  readonly page = computed(() => Math.min(this.requestedPage(), this.pageCount()));
  readonly pageItems = computed(() => this.listed().slice((this.page() - 1) * PAGE_SIZE, this.page() * PAGE_SIZE));

  /** 1 … 4 5 6 … 12: first, last, and the current page's neighbours. */
  readonly pageLinks = computed<(number | null)[]>(() => {
    const total = this.pageCount();
    const current = this.page();
    const links: (number | null)[] = [];
    for (let p = 1; p <= total; p++) {
      if (p === 1 || p === total || Math.abs(p - current) <= 1) links.push(p);
      else if (links[links.length - 1] !== null) links.push(null);
    }
    return links;
  });
}
