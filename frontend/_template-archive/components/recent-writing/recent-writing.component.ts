import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WritingConfig } from '../../../../core/models/portfolio.model';

@Component({
  selector: 'app-recent-writing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="home-writing" class="py-16 scroll-mt-22" aria-labelledby="home-explore-title">
      <div class="container">
        <!-- Section Head -->
        <div class="flex justify-between items-baseline gap-6 mb-8">
          <h2 id="home-explore-title" class="m-0 text-[clamp(28px,3.5vw,44px)] font-medium tracking-[-0.02em] leading-[1.15]">
            {{ writing?.heading }}
            <span class="heading-highlight">{{ writing?.highlight }}</span>
          </h2>
          <a
            [href]="writing?.allWriting?.href || '#'"
            class="inline-link">
            <span>{{ writing?.allWriting?.label || 'All writing' }}</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>

        <!-- 2 Article Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          <a
            *ngFor="let article of writing?.articles"
            [href]="article.href"
            target="_blank"
            rel="noopener noreferrer"
            class="flex flex-col gap-4 text-fg no-underline group cursor-pointer">
            
            <!-- Article Image -->
            <div class="aspect-[5/3] relative w-full overflow-hidden bg-bg-2 border border-hair">
              <img
                [src]="article.image"
                [alt]="article.imageAlt || article.title"
                class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy" />
            </div>

            <!-- Meta: Read Time & Date -->
            <div class="flex justify-between items-center text-xs text-muted leading-relaxed">
              <span>{{ article.readTime }}</span>
              <time>{{ article.date }}</time>
            </div>

            <!-- Article Title (Instrument Serif) -->
            <h3 class="font-serif text-[clamp(24px,2.5vw,36px)] font-normal leading-[1.15] m-0 group-hover:text-accent transition-colors">
              {{ article.title }}
            </h3>

            <!-- Description -->
            <p class="text-sm text-muted m-0 leading-[1.8]">
              {{ article.description }}
            </p>

            <!-- Action Link -->
            <span class="inline-link self-start mt-2">
              <span>{{ article.actionLabel || 'Read the piece' }}</span>
              <span aria-hidden="true">↗</span>
            </span>
          </a>
        </div>
      </div>
    </section>
  `
})
export class RecentWritingComponent {
  @Input() writing: WritingConfig | null = null;
}
