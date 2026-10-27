import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExperimentsConfig } from '../../../../core/models/portfolio.model';
import { PhosphorMatrixComponent } from '../../../../shared/components/phosphor-matrix/phosphor-matrix.component';

@Component({
  selector: 'app-experiments',
  standalone: true,
  imports: [CommonModule, PhosphorMatrixComponent],
  template: `
    <section id="experiments" class="py-20 scroll-mt-22" aria-labelledby="home-lab-title">
      <div class="container">
        <!-- Section Heading -->
        <h2 id="home-lab-title" class="m-0 mb-10 font-medium text-[clamp(28px,3.5vw,44px)] tracking-[-0.02em] leading-[1.15]">
          <span class="heading-highlight">{{ experiments?.highlight }}</span>,
          {{ experiments?.headingFull }}
        </h2>

        <!-- Main Lab Grid -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-18">
          
          <!-- Featured Experiment Card (Webby Winner) -->
          <article class="bg-bg-2 p-6 sm:p-10 flex flex-col justify-between">
            <div>
              <!-- Interactive Voice Dot Matrix Simulation -->
              <div class="mb-4 bg-bg/50 border border-hair-2 p-4">
                <app-phosphor-matrix></app-phosphor-matrix>
              </div>

              <p class="text-accent text-[13px] font-medium leading-snug m-0 mb-2">
                {{ experiments?.featured?.award }}
              </p>
              
              <h3 class="text-[32px] font-medium tracking-[-0.025em] m-0 mb-4 text-fg">
                {{ experiments?.featured?.title }}
              </h3>
              
              <p class="text-muted text-[15px] leading-[1.7] mb-6">
                {{ experiments?.featured?.description }}
              </p>
            </div>

            <a
              [href]="experiments?.featured?.href || '#'"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-link self-start">
              <span>{{ experiments?.featured?.linkLabel }}</span>
              <span aria-hidden="true">↗</span>
            </a>
          </article>

          <!-- Lab Items List -->
          <div class="flex flex-col justify-between gap-10 py-4">
            <article
              *ngFor="let item of experiments?.items"
              class="flex flex-col gap-2 pb-6 border-b border-hair last:border-b-0">
              
              <p *ngIf="item.status" class="text-muted text-xs m-0">
                {{ item.status }}
              </p>
              
              <h3 class="text-[22px] font-medium tracking-[-0.02em] m-0 text-fg leading-[1.3] hover:text-accent transition-colors">
                {{ item.title }}
              </h3>
              
              <p class="text-muted text-[15px] leading-[1.7] m-0 my-1">
                {{ item.description }}
              </p>
              
              <a
                [href]="item.href"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-link self-start mt-2">
                <span>{{ item.linkLabel }}</span>
                <span aria-hidden="true">↗</span>
              </a>
            </article>
          </div>

        </div>

        <!-- Footer Note -->
        <p class="text-muted max-w-[620px] mt-10 mb-0 text-sm leading-[1.6]">
          {{ experiments?.footerNote }}
        </p>
      </div>
    </section>
  `
})
export class ExperimentsComponent {
  @Input() experiments: ExperimentsConfig | null = null;
}
