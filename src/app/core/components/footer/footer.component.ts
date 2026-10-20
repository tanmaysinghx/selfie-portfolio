import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortfolioDataService } from '../../services/portfolio-data.service';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [CommonModule],
  template: `
    <footer id="contact" class="border-t border-hair bg-bg-2 py-24 md:pb-12">
      <div class="container">
        <!-- Main CTA Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] items-start gap-12 lg:gap-16 mb-20">
          <h2 class="m-0 font-medium text-[clamp(44px,6vw,88px)] tracking-[-0.035em] leading-[0.98]">
            {{ footer()?.heading || 'Bring me the' }}
            <span class="text-accent">{{ footer()?.highlight || 'hard problem.' }}</span>
          </h2>
          <div>
            <p class="m-0 text-muted text-base leading-[1.65]">
              {{ footer()?.intro }}
            </p>
            <a
              [href]="footer()?.cta?.href || 'mailto:hello@aanandmadhav.com'"
              class="primary-cta mt-6 text-[13px] px-4 py-3">
              {{ footer()?.cta?.label || 'Get in touch →' }}
            </a>
            <div class="mt-5 flex gap-4 flex-wrap">
              <a
                *ngFor="let social of footer()?.socials"
                [href]="social.url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-link text-[13px]">
                <span>{{ social.name }}</span>
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Links Multi-Column Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-8 pt-8 border-t border-hair">
          <div>
            <span class="font-mono text-[11px] tracking-[0.08em] uppercase text-muted block">
              {{ footer()?.copyright || '© 2026 Aanand Madhav' }}
            </span>
            <div class="mt-[6px] text-[13px] text-muted">
              {{ footer()?.tagline || 'Built in New Delhi. Product, design, and code.' }}
            </div>
          </div>

          <div *ngFor="let col of footer()?.columns">
            <span class="font-mono text-[11px] tracking-[0.08em] uppercase text-muted block">
              {{ col.title }}
            </span>
            <div class="mt-[10px] flex flex-col gap-[7px]">
              <a
                *ngFor="let item of col.links"
                [href]="item.href"
                class="text-sm text-fg hover:text-accent transition-colors no-underline">
                {{ item.label }}
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  `
})
export class FooterComponent {
  private dataService = inject(PortfolioDataService);
  readonly footer = this.dataService.footer;
}
