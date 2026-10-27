import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WorkConfig } from '../../../../core/models/portfolio.model';

@Component({
  selector: 'app-experience',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="work" class="py-20 scroll-mt-20" aria-labelledby="home-work-title">
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

        <!-- Role Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <article
            *ngFor="let role of work?.roles; let idx = index"
            class="bg-bg-2 p-7 sm:p-8 flex flex-col gap-5 transition-transform hover:-translate-y-0.5 duration-200">
            <header class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 class="m-0 text-[21px] font-medium text-fg">{{ role.company }}</h3>
              <span class="font-mono text-[11px] tracking-[0.08em] uppercase text-muted">{{ role.period }}</span>
              <p class="m-0 w-full text-sm text-muted">
                {{ role.title }} · <span class="text-fg">Client: {{ role.client }}</span>
              </p>
            </header>

            <div class="flex items-center gap-6">
              <strong class="text-accent text-[clamp(38px,4.4vw,58px)] font-normal leading-tight tracking-[-0.025em] whitespace-nowrap">
                {{ role.metric }}
              </strong>
              <span class="text-muted text-sm leading-[1.6] max-w-[200px]">{{ role.metricLabel }}</span>
            </div>

            <p class="text-fg/85 text-[15px] m-0 leading-[1.7]">{{ role.summary }}</p>

            <ul
              class="m-0 pl-0 list-none flex flex-col gap-2.5 overflow-hidden transition-[max-height] duration-500 ease-out"
              [style.max-height]="isOpen(idx) ? '640px' : '0px'"
              [attr.aria-hidden]="!isOpen(idx)"
              [id]="'role-highlights-' + idx">
              <li *ngFor="let h of role.highlights" class="relative pl-5 text-sm text-muted leading-[1.65]">
                <span class="absolute left-0 top-[0.1em] text-accent" aria-hidden="true">→</span>{{ h }}
              </li>
            </ul>

            <div class="flex flex-wrap gap-1.5">
              <span
                *ngFor="let tag of role.tags"
                class="font-mono text-[10px] tracking-[0.06em] uppercase px-2 py-1 border border-hair-2 text-muted">
                {{ tag }}
              </span>
            </div>

            <button
              type="button"
              (click)="toggle(idx)"
              [attr.aria-expanded]="isOpen(idx)"
              [attr.aria-controls]="'role-highlights-' + idx"
              class="inline-link self-start mt-auto bg-transparent border-x-0 border-t-0 p-0">
              <span>{{ isOpen(idx) ? 'Show less' : 'What I actually did' }}</span>
              <span aria-hidden="true" class="inline-block transition-transform" [class.rotate-180]="isOpen(idx)">↓</span>
            </button>
          </article>
        </div>

        <!-- Migration ledger -->
        <div class="border border-hair bg-bg">
          <div class="flex flex-wrap items-baseline justify-between gap-2 px-5 md:px-6 py-4 border-b border-hair">
            <h3 class="m-0 text-lg font-medium">{{ work?.migrationsTitle }}</h3>
            <span class="font-mono text-[11px] tracking-[0.08em] uppercase text-muted">
              {{ work?.education?.degree }} · {{ work?.education?.school }} · {{ work?.education?.period }}
            </span>
          </div>
          <ol class="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 divide-hair">
            <li
              *ngFor="let m of work?.migrations; let i = index"
              class="group px-5 md:px-6 py-5 flex flex-col gap-2 lg:border-l first:border-l-0 border-hair hover:bg-accent-wash transition-colors">
              <span class="font-mono text-[10px] tracking-[0.08em] uppercase text-muted">0{{ i + 1 }} · {{ m.note }}</span>
              <span class="text-muted line-through decoration-hair-2 text-[15px]">{{ m.from }}</span>
              <span class="text-fg text-[clamp(20px,1.9vw,24px)] font-medium tracking-[-0.02em] leading-tight">
                <span class="text-accent inline-block transition-transform group-hover:translate-x-1" aria-hidden="true">→</span>
                {{ m.to }}
              </span>
            </li>
          </ol>
        </div>
      </div>
    </section>
  `
})
export class ExperienceComponent {
  @Input() work: WorkConfig | null = null;

  private readonly openRoles = signal<Set<number>>(new Set());

  isOpen(idx: number): boolean {
    return this.openRoles().has(idx);
  }

  toggle(idx: number): void {
    this.openRoles.update(set => {
      const next = new Set(set);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }
}
