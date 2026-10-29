import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StackConfig } from '../../../../core/models/portfolio.model';

@Component({
  selector: 'app-stack',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="stack" class="py-20 scroll-mt-20" aria-labelledby="home-stack-title">
      <div class="container">
        <p class="eyebrow section-eyebrow">03 / TOOLS OF THE TRADE</p>
        <div class="mb-10 max-w-[640px]">
          <h2 id="home-stack-title" class="m-0 font-medium text-[clamp(28px,3.5vw,44px)] tracking-[-0.02em] leading-[1.15]">
            {{ stack?.heading }}
            <span class="heading-highlight">{{ stack?.highlight }}</span>
          </h2>
          <p class="text-muted text-[15px] mt-4 mb-0 leading-relaxed">{{ stack?.intro }}</p>
        </div>

          <!-- Skill groups -->
          <dl class="m-0 grid grid-cols-1 lg:grid-cols-2 gap-x-10 border-t border-hair">
            <div *ngFor="let g of stack?.groups" class="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2 sm:gap-4 py-4 border-b border-hair">
              <dt class="font-mono text-[11px] tracking-[0.08em] uppercase text-muted pt-1">{{ g.label }}</dt>
              <dd class="m-0 flex flex-wrap gap-x-3 gap-y-1">
                <span *ngFor="let item of g.items; let last = last" class="text-[15px] text-fg">
                  {{ item }}<span *ngIf="!last" class="text-hair-2 pl-3" aria-hidden="true">/</span>
                </span>
              </dd>
            </div>
          </dl>

        <!-- Certifications -->
        <div id="certifications" class="mt-16 scroll-mt-24">
          <h3 class="m-0 mb-5 text-[clamp(22px,2.4vw,28px)] font-medium tracking-[-0.02em]">{{ stack?.certificationsTitle }}</h3>
          <ul class="m-0 p-0 list-none grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <li
              *ngFor="let cert of stack?.certifications; let i = index"
              class="cert min-w-0 relative bg-bg-2 border border-hair p-5 pt-6 flex flex-col gap-2 transition-transform duration-300"
              [style.--tilt]="(i % 2 === 0 ? -1 : 1) * 0.8 + 'deg'">
              <span
                class="absolute -top-3 right-4 w-12 h-12 rounded-full border-[1.5px] border-accent text-accent flex items-center justify-center font-mono text-[9px] tracking-[0.06em] uppercase rotate-[-12deg] bg-bg"
                aria-hidden="true">{{ cert.issuer === 'AWS' ? 'AWS' : 'MSFT' }}</span>
              <span class="font-mono text-[10px] tracking-[0.08em] uppercase text-muted">{{ cert.issuer }} Certified</span>
              <span class="text-[17px] font-medium leading-snug pr-10">{{ cert.name }}</span>
              <span class="text-[12px] text-muted mt-auto">{{ cert.valid }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  `,
  styles: `
    .cert { transform: rotate(var(--tilt)); }
    .cert:hover { transform: rotate(0deg) translateY(-2px); }
  `
})
export class StackComponent {
  @Input() stack: StackConfig | null = null;
}
