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
          <h2 class="m-0 font-medium text-[clamp(40px,5.4vw,80px)] tracking-[-0.035em] leading-[0.98]">
            {{ footer()?.heading }}
            <span class="text-accent">{{ footer()?.highlight }}</span>
          </h2>
          <div>
            <p class="m-0 text-muted text-base leading-[1.65]">
              {{ footer()?.intro }}
            </p>
            <div class="mt-6 flex flex-wrap items-center gap-5">
              <a [href]="footer()?.cta?.href" class="primary-cta text-[13px] px-4 py-3">
                {{ footer()?.cta?.label }}
              </a>
              <a [href]="footer()?.secondaryCta?.href" class="inline-link" download>
                <span>{{ footer()?.secondaryCta?.label }}</span>
                <span aria-hidden="true">↓</span>
              </a>
            </div>
            <div class="mt-6 flex gap-4 flex-wrap">
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
              {{ footer()?.copyright }}
            </span>
            <div class="mt-[6px] text-[13px] text-muted">
              {{ footer()?.tagline }}
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
                [attr.target]="item.href.startsWith('http') ? '_blank' : null"
                [attr.rel]="item.href.startsWith('http') ? 'noopener noreferrer' : null"
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
