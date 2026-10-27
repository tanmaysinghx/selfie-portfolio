import { Component, Input, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeroConfig } from '../../../../core/models/portfolio.model';
import { HairlineArtDirective } from '../../../../shared/directives/hairline-art.directive';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [CommonModule, HairlineArtDirective],
  template: `
    <section class="min-h-[calc(100svh-64px)] py-10 lg:py-16 flex items-center" aria-labelledby="home-title">
      <h1 id="home-title" class="sr-only">Tanmay Singh, Java full-stack engineer</h1>
      <div class="container grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] items-center gap-10 lg:gap-16">

        <!-- Left Column: Copy & Identity Stage -->
        <div class="flex flex-col justify-center">

          <!-- Live status -->
          <p class="inline-flex items-center gap-2 self-start font-mono text-[11px] tracking-[0.08em] uppercase text-muted border border-hair px-2.5 py-1.5 mb-6">
            <span class="relative flex w-2 h-2">
              <span class="absolute inline-flex w-full h-full rounded-full bg-accent opacity-60 animate-ping"></span>
              <span class="relative inline-flex w-2 h-2 rounded-full bg-accent"></span>
            </span>
            {{ hero?.status }}
          </p>

          <!-- Identity Stage: Engineer, Builder, Wanderer -->
          <div class="flex flex-col gap-1 sm:gap-2 mb-6" (mouseenter)="stopAutoplay()" (focusin)="stopAutoplay()">
            <div
              *ngFor="let item of hero?.identities; let idx = index"
              class="relative flex items-center h-[64px] sm:h-[84px] lg:h-[96px]">

              <!-- Line art (appears on the left when active) -->
              <div
                class="absolute left-0 w-[52px] sm:w-[68px] lg:w-[78px] h-full flex items-center justify-center transition-all duration-300 pointer-events-none"
                [class.opacity-100]="activeIndex() === idx"
                [class.opacity-0]="activeIndex() !== idx"
                [class.scale-100]="activeIndex() === idx"
                [class.scale-90]="activeIndex() !== idx">
                <svg
                  *ngIf="item.figure === 'stack'; else hairline"
                  viewBox="0 0 80 64"
                  class="w-full text-fg server-stack"
                  [class.is-active]="activeIndex() === idx"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.25"
                  stroke-linejoin="round"
                  aria-hidden="true">
                  <path d="M10 10 L18 3 H76 L68 10" />
                  <path d="M68 10 L76 3 V51 L68 58" />
                  <rect *ngFor="let y of [10, 26, 42]" x="10" [attr.y]="y" width="58" height="16" rx="1.5" fill="var(--bg)" />
                  <g *ngFor="let y of [18, 34, 50]; let i = index">
                    <circle cx="17" [attr.cy]="y" r="1.8" class="led" [style.animation-delay.ms]="i * 380" />
                    <circle cx="23" [attr.cy]="y" r="1.8" class="led" [style.animation-delay.ms]="i * 380 + 650" />
                    <path [attr.d]="'M38 ' + (y - 3) + ' V' + (y + 3) + ' M43 ' + (y - 3) + ' V' + (y + 3) + ' M48 ' + (y - 3) + ' V' + (y + 3) + ' M53 ' + (y - 3) + ' V' + (y + 3) + ' M58 ' + (y - 3) + ' V' + (y + 3)" stroke="var(--muted)" />
                  </g>
                </svg>
                <ng-template #hairline>
                  <div
                    class="w-full h-full flex items-center justify-center identity-drawing"
                    [appHairlineArt]="item.figure"
                    [isActive]="activeIndex() === idx">
                  </div>
                </ng-template>
              </div>

              <!-- Identity Title Button -->
              <button
                type="button"
                (mouseenter)="setActiveIndex(idx)"
                (focus)="setActiveIndex(idx)"
                (click)="setActiveIndex(idx)"
                [attr.aria-pressed]="activeIndex() === idx"
                class="bg-transparent border-0 p-0 text-left cursor-pointer font-medium tracking-[-0.045em] leading-none text-[clamp(46px,7vw,96px)] select-none">
                <span
                  class="inline-block transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  [ngClass]="activeIndex() === idx ?
                    'text-accent translate-x-[60px] sm:translate-x-[76px] lg:translate-x-[88px]' :
                    'text-fg translate-x-0 hover:text-accent-ink'">
                  {{ item.label }}
                </span>
              </button>
            </div>
          </div>

          <!-- Hero Intro Paragraph -->
          <p class="max-w-[500px] text-[clamp(16px,1.7vw,19px)] text-muted mb-7 leading-[1.65]">
            {{ hero?.introduction }}
          </p>

          <!-- CTAs -->
          <div class="flex flex-wrap items-center gap-5">
            <a [href]="hero?.cta?.href" class="primary-cta text-[13px] px-4 py-3">
              {{ hero?.cta?.label }}
            </a>
            <a [href]="hero?.secondaryCta?.href" class="inline-link" download>
              <span>{{ hero?.secondaryCta?.label }}</span>
              <span aria-hidden="true">↓</span>
            </a>
          </div>

          <!-- Key Hero Stats -->
          <div class="grid grid-cols-3 gap-4 pt-6 mt-10 border-t border-hair max-w-lg">
            <a
              *ngFor="let stat of hero?.stats"
              [href]="stat.href"
              class="flex flex-col gap-1 text-fg no-underline group">
              <strong class="font-medium text-[clamp(20px,2.2vw,30px)] tracking-[-0.02em] leading-tight group-hover:text-accent transition-colors">
                {{ stat.value }}
              </strong>
              <span class="text-[12px] text-muted leading-snug">
                {{ stat.label }}
              </span>
            </a>
          </div>
        </div>

        <!-- Right Column: Sketched portrait -->
        <figure class="m-0 w-full max-w-[520px] mx-auto">
          <img
            *ngIf="hero?.portrait as portrait"
            [src]="portrait.src"
            [alt]="portrait.alt"
            width="1100"
            height="1035"
            fetchpriority="high"
            class="block w-full aspect-square object-contain" />
        </figure>

      </div>
    </section>
  `,
  styles: `
    .server-stack .led {
      fill: var(--hair-2);
      stroke: none;
    }
    .server-stack.is-active .led {
      animation: blink 1.3s steps(1, end) infinite;
    }
    @keyframes blink {
      0%, 55% { fill: var(--accent); }
      56%, 100% { fill: var(--hair-2); }
    }
    @media (prefers-reduced-motion: reduce) {
      .server-stack.is-active .led { animation: none; fill: var(--accent); }
    }
  `
})
export class HeroSectionComponent implements OnInit, OnDestroy {
  @Input() hero: HeroConfig | null = null;

  readonly activeIndex = signal<number>(0);
  private autoplayTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduceMotion) {
      this.autoplayTimer = setInterval(() => {
        const count = this.hero?.identities?.length ?? 0;
        if (count) {
          this.activeIndex.update(i => (i + 1) % count);
        }
      }, 4200);
    }
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
  }

  stopAutoplay(): void {
    if (this.autoplayTimer) {
      clearInterval(this.autoplayTimer);
      this.autoplayTimer = null;
    }
  }

  setActiveIndex(idx: number): void {
    this.stopAutoplay();
    this.activeIndex.set(idx);
  }
}
