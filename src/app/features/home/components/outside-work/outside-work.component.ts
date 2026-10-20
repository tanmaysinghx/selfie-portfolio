import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LifeConfig } from '../../../../core/models/portfolio.model';

@Component({
  selector: 'app-outside-work',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="outside-work" class="py-24 scroll-mt-24" aria-labelledby="home-life-title">
      <div class="container">
        <!-- Section Head -->
        <div class="flex flex-col sm:flex-row justify-between sm:items-end gap-6 mb-12">
          <div>
            <h2 id="home-life-title" class="m-0 text-[clamp(28px,3.5vw,44px)] font-medium tracking-[-0.02em] leading-[1.15]">
              {{ life?.heading }}
              <span class="heading-highlight">{{ life?.highlight }}</span>
              {{ life?.subheading }}
            </h2>
            <p class="text-muted text-[15px] mt-4 mb-0 leading-relaxed max-w-[590px]">
              {{ life?.intro }}
            </p>
          </div>
          <a
            [href]="life?.allLifeStories?.href || '#'"
            class="inline-link self-start sm:self-auto">
            <span>{{ life?.allLifeStories?.label || 'More life stories' }}</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>

        <!-- Life Feature Grid: Parallax Photo Collage & Quote -->
        <div class="grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] items-center gap-10 lg:gap-16">
          <!-- Photo Collage Figure -->
          <figure class="m-0">
            <div class="aspect-[4/3] relative overflow-hidden bg-bg-2 border border-hair group">
              <img
                [src]="life?.featuredStory?.image?.src || '/images/Life/Travel/europe/article-cover.png'"
                [alt]="life?.featuredStory?.image?.alt || 'Travel story'"
                class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy" />
            </div>
            <figcaption class="mt-3 text-xs text-muted font-mono">
              {{ life?.featuredStory?.caption }}
            </figcaption>
          </figure>

          <!-- Editorial Quote -->
          <div class="flex flex-col justify-center">
            <p class="font-serif text-[clamp(24px,2.5vw,34px)] text-fg leading-[1.4] m-0 mb-7 text-pretty italic">
              “{{ life?.featuredStory?.quote }}”
            </p>
            <a
              [href]="life?.featuredStory?.href || '#'"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-link self-start">
              <span>{{ life?.featuredStory?.actionLabel || 'Read the full story' }}</span>
              <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  `
})
export class OutsideWorkComponent {
  @Input() life: LifeConfig | null = null;
}
