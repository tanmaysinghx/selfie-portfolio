import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LifeConfig } from '../../../../core/models/portfolio.model';

@Component({
  selector: 'app-off-the-clock',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="off-the-clock" class="py-20 scroll-mt-20 border-t border-hair" aria-labelledby="home-life-title">
      <div class="container">
        <div class="mb-10 max-w-[620px]">
          <h2 id="home-life-title" class="m-0 text-[clamp(28px,3.5vw,44px)] font-medium tracking-[-0.02em] leading-[1.15]">
            {{ life?.heading }}
            <span class="heading-highlight">{{ life?.highlight }}</span>
          </h2>
          <p class="text-muted text-[15px] mt-4 mb-0 leading-relaxed">{{ life?.intro }}</p>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] items-start gap-10 lg:gap-14">
          <!-- Sketch -->
          <figure class="m-0">
            <div class="relative bg-bg-2 border border-hair p-3 group overflow-hidden">
              <img
                [src]="life?.image?.src"
                [alt]="life?.image?.alt"
                width="1600"
                height="1195"
                loading="lazy"
                class="block w-full h-auto mix-blend-multiply transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]" />
            </div>
            <figcaption class="mt-3 text-xs text-muted font-mono">{{ life?.caption }}</figcaption>
          </figure>

          <!-- Quote + notes -->
          <div class="flex flex-col gap-10">
            <blockquote class="m-0">
              <p class="font-serif italic text-[clamp(26px,2.7vw,38px)] text-fg leading-[1.25] m-0 text-pretty">
                “{{ life?.quote }}”
              </p>
              <footer class="mt-3 font-mono text-[11px] tracking-[0.06em] uppercase text-muted">{{ life?.quoteAttribution }}</footer>
            </blockquote>

            <ul class="m-0 p-0 list-none flex flex-col divide-y divide-hair border-y border-hair">
              <li *ngFor="let note of life?.notes; let i = index" class="py-5 grid grid-cols-[32px_1fr] gap-3">
                <span class="font-mono text-[11px] text-accent pt-1">0{{ i + 1 }}</span>
                <div>
                  <h3 class="m-0 text-[17px] font-medium">{{ note.title }}</h3>
                  <p class="m-0 mt-1.5 text-sm text-muted leading-[1.65]">{{ note.body }}</p>
                  <a
                    *ngIf="note.link"
                    [href]="note.link.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-link mt-3">
                    <span>{{ note.link.label }}</span><span aria-hidden="true">↗</span>
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  `
})
export class OffTheClockComponent {
  @Input() life: LifeConfig | null = null;
}
