import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeroConfig } from '../../../../core/models/portfolio.model';
import { HairlineArtDirective } from '../../../../shared/directives/hairline-art.directive';

@Component({
  selector: 'app-hero-section',
  standalone: true,
  imports: [CommonModule, HairlineArtDirective],
  template: `
    <section class="min-h-[calc(100svh-64px)] py-8 lg:py-16 flex items-center" aria-labelledby="home-title">
      <div class="container grid grid-cols-1 lg:grid-cols-2 items-center gap-10 lg:gap-16">
        
        <!-- Left Column: Copy & Identity Stage -->
        <div class="flex flex-col justify-center">
          
          <!-- Identity Stage: Builder, Brewer, Wanderer -->
          <div class="flex flex-col gap-1 sm:gap-2 mb-6">
            <div
              *ngFor="let item of hero?.identities; let idx = index"
              class="relative flex items-center h-[68px] sm:h-[84px] lg:h-[98px]">
              
              <!-- Hairline Line Art Drawing (Appears on the left when active) -->
              <div
                class="absolute left-0 w-[54px] sm:w-[68px] lg:w-[78px] h-full flex items-center justify-center transition-all duration-300 pointer-events-none"
                [class.opacity-100]="activeIndex() === idx"
                [class.opacity-0]="activeIndex() !== idx"
                [class.scale-100]="activeIndex() === idx"
                [class.scale-90]="activeIndex() !== idx">
                <div
                  class="w-full h-full flex items-center justify-center identity-drawing"
                  [appHairlineArt]="item.figure"
                  [isActive]="activeIndex() === idx">
                </div>
              </div>

              <!-- Identity Title Button -->
              <button
                type="button"
                (mouseenter)="setActiveIndex(idx)"
                (click)="setActiveIndex(idx)"
                class="bg-transparent border-0 p-0 text-left cursor-pointer font-medium tracking-[-0.045em] leading-none text-[clamp(48px,7vw,96px)] select-none">
                <span
                  class="inline-block transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]"
                  [ngClass]="activeIndex() === idx ?
                    'text-accent translate-x-[62px] sm:translate-x-[76px] lg:translate-x-[88px]' :
                    'text-fg translate-x-0 hover:text-accent-ink'">
                  {{ item.label }}
                </span>
              </button>
            </div>
          </div>

          <!-- Hero Intro Paragraph -->
          <p class="max-w-[440px] text-[clamp(16px,1.7vw,19px)] text-muted mb-6 leading-[1.65]">
            {{ hero?.introduction }}
          </p>

          <!-- Primary CTA -->
          <div class="flex items-center gap-4">
            <a
              [href]="hero?.cta?.href || '#contact'"
              class="primary-cta text-[13px] px-4 py-3">
              {{ hero?.cta?.label || 'Let’s build something →' }}
            </a>
          </div>

          <!-- Availability Tag -->
          <p class="text-muted text-xs mt-3.5 mb-8">
            {{ hero?.availability }}
          </p>

          <!-- Key Hero Stats -->
          <div class="grid grid-cols-3 gap-4 pt-6 border-t border-hair max-w-lg">
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

        <!-- Right Column: Mascot Portrait Drawing -->
        <div class="w-full max-w-[500px] aspect-square mx-auto flex items-center justify-center">
          <img
            [src]="hero?.portrait?.src || '/images/hero-aanand.webp'"
            [alt]="hero?.portrait?.alt || 'Mascot'"
            width="1920"
            height="1920"
            class="w-full h-full object-contain drop-shadow-xs transition-transform duration-500 hover:scale-[1.02]" />
        </div>

      </div>
    </section>
  `
})
export class HeroSectionComponent {
  @Input() hero: HeroConfig | null = null;

  readonly activeIndex = signal<number>(0);

  setActiveIndex(idx: number): void {
    this.activeIndex.set(idx);
  }
}
