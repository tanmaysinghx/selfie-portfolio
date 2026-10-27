import { Component, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InRotationConfig, CoffeeDay } from '../../../../core/models/portfolio.model';
import { KombuchaJarComponent } from '../../../../shared/components/kombucha-jar/kombucha-jar.component';

@Component({
  selector: 'app-in-rotation',
  standalone: true,
  imports: [CommonModule, KombuchaJarComponent],
  template: `
    <section id="in-rotation" class="py-24 scroll-mt-24" aria-labelledby="home-now-title">
      <div class="container">
        <!-- Section Head -->
        <div class="flex flex-col sm:flex-row justify-between sm:items-end gap-6 mb-12">
          <div>
            <h2 id="home-now-title" class="m-0 text-[clamp(28px,3.5vw,44px)] font-medium tracking-[-0.02em] leading-[1.15]">
              {{ inRotation?.heading }}
              <span class="heading-highlight">{{ inRotation?.highlight }}</span>
            </h2>
            <p class="text-muted text-[15px] mt-4 mb-0 leading-relaxed max-w-[590px]">
              {{ inRotation?.intro }}
            </p>
          </div>
          <a
            *ngIf="inRotation?.socialLink"
            [href]="inRotation?.socialLink?.href"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-link self-start sm:self-auto">
            <span>{{ inRotation?.socialLink?.label }}</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>

        <!-- 3 Widget Cards Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          <!-- Card 1: Coffee Rotation -->
          <article class="bg-bg-2 p-7 flex flex-col justify-between min-h-[460px]">
            <div>
              <p class="text-xs text-muted m-0 leading-normal">{{ inRotation?.coffeeWidget?.context }}</p>
              <h3 class="text-[23px] font-medium tracking-[-0.02em] mt-1 mb-2 text-fg">
                {{ inRotation?.coffeeWidget?.title }}
              </h3>
              <p class="text-sm text-muted m-0 leading-relaxed">
                {{ inRotation?.coffeeWidget?.body }}
              </p>

              <!-- Interactive Coffee Calendar -->
              <div class="min-h-[220px] my-6 flex flex-col items-center justify-center gap-5">
                <!-- Days Row -->
                <div class="grid grid-cols-7 gap-1.5 w-full max-w-[280px]" role="group" aria-label="Coffee day selector">
                  <button
                    *ngFor="let day of inRotation?.coffeeWidget?.schedule; let idx = index"
                    type="button"
                    (click)="selectCoffeeDay(idx)"
                    [attr.data-active]="activeCoffeeIndex() === idx"
                    class="flex flex-col items-center gap-2 cursor-pointer bg-transparent border-0 p-0 group">
                    <span
                      class="font-mono text-[9px] uppercase tracking-[0.06em] transition-colors"
                      [ngClass]="activeCoffeeIndex() === idx ? 'text-accent-ink font-semibold' : 'text-muted-2 group-hover:text-fg'">
                      {{ day.dayLetter }}
                    </span>
                    <span
                      class="w-full h-[30px] border transition-colors block"
                      [ngClass]="activeCoffeeIndex() === idx ? 'border-accent bg-accent/15' : 'border-hair-2 bg-bg hover:border-hair'">
                    </span>
                  </button>
                </div>

                <!-- Coffee Detail Preview -->
                <div class="text-center min-h-[50px] flex flex-col justify-center gap-1 transition-all">
                  <div class="text-[17px] font-medium text-fg">
                    {{ currentCoffee().blend }}
                  </div>
                  <div class="text-[13px] text-muted">
                    {{ currentCoffee().roaster }}
                  </div>
                  <div class="text-[12px] text-muted-2 font-mono mt-1">
                    {{ currentCoffee().brews }}
                  </div>
                </div>
              </div>
            </div>

            <div class="pt-4 border-t border-hair/50 flex justify-between items-center text-xs">
              <a
                [href]="inRotation?.coffeeWidget?.link?.href || '#outside-work'"
                class="inline-link text-xs">
                <span>{{ inRotation?.coffeeWidget?.link?.label }}</span>
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>

          <!-- Card 2: Kombucha Fermentation -->
          <article class="bg-bg-2 p-7 flex flex-col justify-between min-h-[460px]">
            <div>
              <p class="text-xs text-muted m-0 leading-normal">{{ inRotation?.kombuchaWidget?.context }}</p>
              <h3 class="text-[23px] font-medium tracking-[-0.02em] mt-1 mb-2 text-fg">
                {{ inRotation?.kombuchaWidget?.title }}
              </h3>
              <p class="text-sm text-muted m-0 leading-relaxed">
                {{ inRotation?.kombuchaWidget?.body }}
              </p>

              <!-- Interactive Jar Component -->
              <div class="my-4">
                <app-kombucha-jar
                  [stages]="inRotation?.kombuchaWidget?.stages || []"
                  [caption]="inRotation?.kombuchaWidget?.caption || 'Fermentation preview'">
                </app-kombucha-jar>
              </div>
            </div>

            <div class="pt-4 border-t border-hair/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
              <span class="text-muted text-[11px]">
                {{ inRotation?.kombuchaWidget?.footerNote }}
              </span>
              <a
                [href]="inRotation?.kombuchaWidget?.link?.href || '#outside-work'"
                class="inline-link text-xs whitespace-nowrap">
                <span>{{ inRotation?.kombuchaWidget?.link?.label }}</span>
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>

          <!-- Card 3: Books Shelf -->
          <article class="bg-bg-2 p-7 flex flex-col justify-between min-h-[460px]">
            <div>
              <p class="text-xs text-muted m-0 leading-normal">{{ inRotation?.bookWidget?.context }}</p>
              <h3 class="text-[23px] font-medium tracking-[-0.02em] mt-1 mb-1 text-fg">
                {{ inRotation?.bookWidget?.title }}
              </h3>
              <p class="text-sm text-muted m-0 mb-6 font-mono text-[12px]">
                {{ inRotation?.bookWidget?.author }}
              </p>

              <!-- Reading Note in Editorial Style -->
              <blockquote class="m-0 text-fg text-base sm:text-lg leading-[1.75] font-normal text-pretty italic border-l-2 border-accent pl-4 my-6">
                “{{ inRotation?.bookWidget?.readingNote }}”
              </blockquote>
            </div>

            <div class="pt-4 border-t border-hair/50 flex justify-between items-center text-xs">
              <a
                [href]="inRotation?.bookWidget?.link?.href || '#outside-work'"
                class="inline-link text-xs">
                <span>{{ inRotation?.bookWidget?.link?.label }}</span>
                <span aria-hidden="true">↗</span>
              </a>
            </div>
          </article>

        </div>

        <!-- Last Updated Notice -->
        <p class="text-xs text-muted mt-7 mb-0">
          {{ inRotation?.updated }}
        </p>
      </div>
    </section>
  `
})
export class InRotationComponent {
  @Input() inRotation: InRotationConfig | null = null;

  readonly activeCoffeeIndex = signal<number>(0);

  readonly currentCoffee = computed<CoffeeDay>(() => {
    const list = this.inRotation?.coffeeWidget?.schedule || [];
    return list[this.activeCoffeeIndex()] || {
      dayLetter: 'M',
      dayName: 'Monday',
      blend: 'Bhumadivi',
      roaster: 'Marks Coffee · Pondicherry',
      brews: 'Cappuccino · Cold brew'
    };
  });

  selectCoffeeDay(idx: number): void {
    this.activeCoffeeIndex.set(idx);
  }
}
