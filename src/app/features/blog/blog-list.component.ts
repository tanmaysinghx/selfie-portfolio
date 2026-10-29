import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BlogService } from '../../core/services/blog.service';

@Component({
  selector: 'app-blog-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <main class="w-full">
      <section class="blog-list-heading pt-12 pb-10" aria-labelledby="blog-title">
        <div class="container">
          <p class="font-mono text-[10px] tracking-[0.08em] uppercase text-muted m-0 mb-5">
            Blog · {{ posts().length }} {{ posts().length === 1 ? 'post' : 'posts' }}
          </p>
          <h1 id="blog-title" class="m-0 text-[clamp(38px,4.5vw,64px)] font-medium tracking-[-0.045em] leading-[0.98]">
            Notes from the
            <span class="font-serif italic font-normal tracking-[-0.02em] heading-highlight">workbench.</span>
          </h1>
          <p class="text-muted text-[clamp(16px,1.7vw,19px)] mt-6 mb-0 max-w-[620px] leading-relaxed">
            Notes on Java, building software, and what I learn along the way.
          </p>

          <div *ngIf="blog.posts().length > 3 && tags().length" class="flex flex-wrap gap-2 mt-10" role="group" aria-label="Filter by topic">
            <button
              type="button"
              (click)="activeTag.set(null)"
              [attr.aria-pressed]="activeTag() === null"
              class="tag-chip">
              All
            </button>
            <button
              *ngFor="let tag of tags()"
              type="button"
              (click)="activeTag.set(activeTag() === tag ? null : tag)"
              [attr.aria-pressed]="activeTag() === tag"
              class="tag-chip">
              {{ tag }}
            </button>
          </div>
        </div>
      </section>

      <section class="pt-4 pb-16">
        <div class="container">
          <p *ngIf="blog.isLoaded() && !posts().length" class="text-muted text-[15px]">
            Nothing published yet. The first post is on its way.
          </p>

          <!-- Featured / latest post -->
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

          <!-- Rest of the posts -->
          <ol class="m-0 p-0 list-none border-t border-hair">
            <li *ngFor="let post of rest()" class="border-b border-hair">
              <a
                [routerLink]="['/blog', post.slug]"
                class="group grid grid-cols-1 md:grid-cols-[140px_1fr_180px] gap-3 md:gap-8 py-8 text-fg no-underline items-start">
                <time [attr.datetime]="post.date" class="font-mono text-[11px] uppercase tracking-[0.08em] text-muted pt-2">
                  {{ post.date | date: 'mediumDate' }}
                </time>
                <div>
                  <h3 class="m-0 text-[clamp(22px,2.2vw,30px)] font-medium tracking-[-0.02em] leading-[1.2] group-hover:text-accent-ink transition-colors">
                    {{ post.title }}
                  </h3>
                  <p class="m-0 mt-2 text-muted text-[15px] leading-[1.65] max-w-[640px]">{{ post.description }}</p>
                  <div class="flex flex-wrap gap-1.5 mt-3">
                    <span *ngFor="let tag of post.tags" class="font-mono text-[10px] uppercase tracking-[0.06em] px-1.5 py-0.5 bg-hair/50 text-muted">{{ tag }}</span>
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
  `
})
export class BlogListComponent {
  readonly blog = inject(BlogService);
  readonly activeTag = signal<string | null>(null);

  readonly tags = computed(() => [...new Set(this.blog.posts().flatMap(p => p.tags))].sort());

  readonly posts = computed(() => {
    const tag = this.activeTag();
    return this.blog.posts().filter(p => !tag || p.tags.includes(tag));
  });

  readonly lead = computed(() => this.posts().find(p => p.featured) ?? this.posts()[0]);
  readonly rest = computed(() => this.posts().filter(p => p !== this.lead()));
}
