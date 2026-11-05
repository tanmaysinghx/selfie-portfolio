import { Component, Input, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeroConfig } from '../../../../core/models/portfolio.model';
import { HairlineArtDirective } from '../../../../shared/directives/hairline-art.directive';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [CommonModule, HairlineArtDirective],
  template: `
    <section class="portfolio-hero" aria-labelledby="home-title">
      <h1 id="home-title" class="sr-only">Tanmay Singh, Java full-stack engineer</h1>
      <div class="container hero-grid">

        <!-- Left Column: Copy & Identity Stage -->
        <div class="hero-copy">

          <p class="eyebrow hero-eyebrow"><span class="status-dot"></span> Java full-stack engineer · Gurgaon, India</p>
          <p class="hero-greeting">Hello, I’m Tanmay <span aria-hidden="true">↗</span></p>

          <!-- Identity Stage: Engineer, Builder, Explorer -->
          <div class="identity-list" (mouseenter)="stopAutoplay()" (focusin)="stopAutoplay()">
            <div
              *ngFor="let item of hero?.identities; let idx = index"
              class="identity-row relative flex items-center">

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
                class="identity-button">
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
          <p class="hero-introduction">
            {{ hero?.introduction }}
          </p>

          <!-- CTAs -->
          <div class="hero-actions flex flex-wrap items-center gap-6">
            <a [href]="hero?.cta?.href" class="primary-cta text-[13px] px-4 py-3">
              {{ hero?.cta?.label }}
            </a>
            <a [href]="hero?.secondaryCta?.href" class="inline-link" download>
              <span>{{ hero?.secondaryCta?.label }}</span>
              <span aria-hidden="true">↓</span>
            </a>
          </div>

        </div>

        <!-- Right Column: Sketched portrait -->
        <figure class="hero-portrait">
          <div class="portrait-art">
            <span class="portrait-note" aria-hidden="true">Always building.<br>Always curious.</span>
          <img
            *ngIf="hero?.portrait as portrait"
            [src]="portrait.src"
            [alt]="portrait.alt"
            width="1100"
            height="1035"
            fetchpriority="high"
            class="portrait-image" />
          </div>
          <figcaption class="portrait-caption">
            <span class="status-dot"></span>
            <span>{{ hero?.status }}</span>
            <span class="portrait-caption-arrow" aria-hidden="true">↗</span>
          </figcaption>
        </figure>

        <div class="hero-bottom">
          <div class="hero-stats">
            <a *ngFor="let stat of hero?.stats" [href]="stat.href" class="hero-stat">
              <strong>{{ stat.value }}</strong>
              <span>{{ stat.label }}</span>
            </a>
          </div>
          <a href="#work" class="hero-scroll"><span>A little further down</span><span aria-hidden="true">↓</span></a>
        </div>
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
