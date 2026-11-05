import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkConfig } from '../../../../core/models/portfolio.model';

@Component({
  selector: 'app-selected-work',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="selected-work" class="py-18 scroll-mt-22" aria-labelledby="home-work-title">
      <div class="container">
        <!-- Section Head -->
        <div class="flex flex-col sm:flex-row justify-between sm:items-baseline gap-4 mb-8">
          <h2 id="home-work-title" class="m-0 font-medium text-[clamp(28px,3.5vw,44px)] tracking-[-0.02em] leading-[1.15]">
            {{ work?.heading }}
            <span class="heading-highlight">{{ work?.highlight }}</span>
          </h2>
          <p class="m-0 text-muted text-sm">
            <strong class="text-fg font-medium">{{ work?.yearsExperience }}</strong>
            {{ work?.experienceDomain }}
          </p>
        </div>

        <!-- Featured Companies Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <article
            *ngFor="let company of work?.companies"
            class="bg-bg-2 p-8 flex flex-col justify-between gap-5 transition-transform hover:-translate-y-0.5 duration-200">
            <div>
              <h3 class="m-0 text-[21px] font-medium text-fg">
                {{ company.name }}
              </h3>
              
              <div class="flex items-center gap-6 my-5">
                <strong class="text-accent text-[clamp(40px,4.7vw,62px)] font-normal leading-tight tracking-[-0.025em] whitespace-nowrap">
                  {{ company.metric }}
                </strong>
                <span class="text-muted text-sm leading-[1.6] max-w-[180px]">
                  {{ company.metricLabel }}
                </span>
              </div>

              <p class="text-muted text-sm m-0 leading-[1.7]">
                {{ company.description }}
              </p>
            </div>

            <a
              [href]="company.href"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-link self-start mt-2">
              <span>{{ company.linkLabel }}</span>
              <span aria-hidden="true">↗</span>
            </a>
          </article>
        </div>

        <!-- Case Studies Row -->
        <div class="flex flex-col divide-y divide-hair border border-hair bg-bg">
          <a
            *ngFor="let cs of work?.caseStudies; let idx = index"
            [href]="cs.href"
            class="grid grid-cols-1 md:grid-cols-[1.3fr_1fr_1.2fr_24px] items-center gap-4 md:gap-6 p-5 md:px-6 transition-colors no-underline text-fg group cursor-pointer"
            [ngClass]="idx % 2 === 1 ? 'bg-bg-2/50' : 'bg-transparent'"
            [class.hover:bg-hair/50]="true">
            <h3 class="m-0 text-lg font-medium leading-[1.4] group-hover:text-accent transition-colors">
              {{ cs.title }}
            </h3>
            <p class="m-0 text-[clamp(24px,2.7vw,32px)] font-normal leading-tight whitespace-nowrap">
              {{ cs.metric }}
            </p>
            <span class="text-muted text-[13px] leading-snug">
              {{ cs.metricLabel }}
            </span>
            <b class="text-[22px] font-normal leading-none group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" aria-hidden="true">
              ↗
            </b>
          </a>
        </div>
      </div>
    </section>
  `
})
export class SelectedWorkComponent {
  @Input() work: WorkConfig | null = null;
}
