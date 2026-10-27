import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EcosystemApp, OpenSourceConfig } from '../../../../core/models/portfolio.model';

/** Diagram positions (percent of the stage) for each satellite, in data order. */
const SATELLITE_POSITIONS = [
  { x: 24, y: 20 },
  { x: 76, y: 20 },
  { x: 50, y: 88 }
];
const HUB_POSITION = { x: 50, y: 47 };

@Component({
  selector: 'app-open-source',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section id="open-source" class="py-20 scroll-mt-20 bg-bg-2 border-y border-hair" aria-labelledby="home-oss-title">
      <div class="container">
        <!-- Section Head -->
        <div class="flex flex-col sm:flex-row justify-between sm:items-end gap-6 mb-10">
          <div>
            <h2 id="home-oss-title" class="m-0 font-medium text-[clamp(28px,3.5vw,44px)] tracking-[-0.02em] leading-[1.15]">
              {{ oss?.heading }}
              <span class="heading-highlight">{{ oss?.highlight }}</span>
            </h2>
            <p class="text-muted text-[15px] mt-4 mb-0 leading-relaxed max-w-[620px]">{{ oss?.intro }}</p>
          </div>
          <a [href]="oss?.githubLink?.href" target="_blank" rel="noopener noreferrer" class="inline-link self-start sm:self-auto shrink-0">
            <span>{{ oss?.githubLink?.label }}</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>

        <!-- Ecosystem: diagram + detail -->
        <div class="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5 mb-16">
          <!-- Diagram -->
          <div class="relative bg-bg border border-hair aspect-square sm:aspect-[5/4] overflow-hidden">
            <span class="absolute top-4 left-4 font-mono text-[10px] tracking-[0.08em] uppercase text-muted">The Portal ecosystem · click a node</span>
            <svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <line
                *ngFor="let p of satellitePositions; let i = index"
                [attr.x1]="hub.x" [attr.y1]="hub.y" [attr.x2]="p.x" [attr.y2]="p.y"
                vector-effect="non-scaling-stroke"
                class="flow"
                [class.is-active]="selectedId() === oss?.satellites?.[i]?.id"
                [style.animation-delay.ms]="i * 300" />
            </svg>
            <span
              class="absolute font-mono text-[10px] tracking-[0.06em] text-muted bg-bg px-1 -translate-x-1/2 -translate-y-1/2"
              style="left: 50%; top: 68%">OIDC + PKCE</span>

            <!-- Hub node -->
            <button
              type="button"
              (click)="select(oss?.hub)"
              [attr.aria-pressed]="selectedId() === oss?.hub?.id"
              class="node absolute -translate-x-1/2 -translate-y-1/2 px-4 py-3 border text-left cursor-pointer transition-colors"
              [style.left.%]="hub.x" [style.top.%]="hub.y"
              [ngClass]="selectedId() === oss?.hub?.id ? 'bg-fg text-bg border-fg' : 'bg-bg text-fg border-fg hover:bg-accent-wash'">
              <span class="block font-mono text-[10px] tracking-[0.08em] uppercase opacity-70">Identity hub</span>
              <span class="block text-[clamp(16px,1.6vw,20px)] font-medium tracking-[-0.01em] whitespace-nowrap">{{ oss?.hub?.name }}</span>
            </button>

            <!-- Satellite nodes -->
            <button
              *ngFor="let app of oss?.satellites; let i = index"
              type="button"
              (click)="select(app)"
              [attr.aria-pressed]="selectedId() === app.id"
              class="node absolute -translate-x-1/2 -translate-y-1/2 px-3 py-2 border text-[13px] sm:text-sm font-medium whitespace-nowrap cursor-pointer transition-colors"
              [style.left.%]="satellitePositions[i].x" [style.top.%]="satellitePositions[i].y"
              [ngClass]="selectedId() === app.id ? 'bg-accent text-white border-accent' : 'bg-bg text-fg border-hair-2 hover:border-accent hover:text-accent-ink'">
              {{ app.name }}
            </button>
          </div>

          <!-- Detail panel -->
          <article class="bg-bg border border-hair p-7 sm:p-8 flex flex-col gap-5" aria-live="polite">
            <span class="font-mono text-[11px] tracking-[0.08em] uppercase text-accent">
              {{ selected()?.id === oss?.hub?.id ? 'Flagship' : 'Signs in with Portal SSO' }}
            </span>
            <h3 class="m-0 text-[clamp(28px,3vw,40px)] font-medium tracking-[-0.025em] leading-[1.05]">{{ selected()?.name }}</h3>
            <p class="m-0 font-serif italic text-[clamp(20px,2vw,26px)] leading-[1.3] text-fg">{{ selected()?.tagline }}</p>
            <p class="m-0 text-muted text-[15px] leading-[1.7]">{{ selected()?.description }}</p>
            <div class="flex flex-wrap gap-1.5">
              <span
                *ngFor="let s of selected()?.stack"
                class="font-mono text-[10px] tracking-[0.06em] uppercase px-2 py-1 border border-hair-2 text-muted">{{ s }}</span>
            </div>
            <a [href]="selected()?.href" target="_blank" rel="noopener noreferrer" class="primary-cta self-start mt-auto text-[13px] px-4 py-2.5">
              View on GitHub ↗
            </a>
          </article>
        </div>

        <!-- Libraries -->
        <div class="flex items-baseline justify-between gap-4 mb-5">
          <h3 class="m-0 text-[clamp(22px,2.4vw,28px)] font-medium tracking-[-0.02em]">{{ oss?.librariesTitle }}</h3>
          <span class="font-mono text-[11px] tracking-[0.08em] uppercase text-muted hidden sm:inline">Java 25 · Spring Boot 4</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-hair border border-hair mb-16">
          <article *ngFor="let lib of oss?.libraries" class="bg-bg p-6 flex flex-col gap-3 group">
            <div class="flex items-baseline justify-between gap-3">
              <h4 class="m-0 text-lg font-medium group-hover:text-accent transition-colors">
                <a [href]="lib.href" target="_blank" rel="noopener noreferrer" class="text-inherit no-underline">{{ lib.name }}</a>
              </h4>
              <span class="font-mono text-[10px] tracking-[0.08em] uppercase text-muted whitespace-nowrap">{{ lib.kind }}</span>
            </div>
            <p class="m-0 text-sm text-muted leading-[1.65]">{{ lib.description }}</p>
            <button
              type="button"
              (click)="copy(lib.install)"
              class="mt-auto flex items-center justify-between gap-3 w-full text-left bg-bg-2 border border-hair hover:border-hair-2 px-3 py-2 cursor-pointer font-mono text-[11px] text-fg"
              [attr.aria-label]="'Copy: ' + lib.install">
              <span class="truncate">{{ lib.install }}</span>
              <span class="shrink-0 text-muted" [class.text-accent]="copied() === lib.install">
                {{ copied() === lib.install ? 'copied ✓' : 'copy' }}
              </span>
            </button>
          </article>
        </div>

        <!-- npm -->
        <div class="flex items-baseline justify-between gap-4 mb-5">
          <h3 class="m-0 text-[clamp(22px,2.4vw,28px)] font-medium tracking-[-0.02em]">{{ oss?.npmTitle }}</h3>
          <a [href]="oss?.npmProfile?.href" target="_blank" rel="noopener noreferrer" class="inline-link">
            <span>{{ oss?.npmProfile?.label }}</span><span aria-hidden="true">↗</span>
          </a>
        </div>
        <div class="flex flex-col divide-y divide-hair border border-hair bg-bg">
          <a
            *ngFor="let pkg of oss?.npm"
            [href]="pkg.href"
            target="_blank"
            rel="noopener noreferrer"
            class="grid grid-cols-1 md:grid-cols-[1.1fr_80px_1.6fr_24px] items-center gap-2 md:gap-6 p-5 md:px-6 no-underline text-fg group hover:bg-accent-wash transition-colors">
            <span class="font-mono text-[15px] group-hover:text-accent transition-colors">{{ pkg.name }}</span>
            <span class="font-mono text-[11px] text-muted">v{{ pkg.version }}</span>
            <span class="text-muted text-[13px] leading-snug">{{ pkg.description }}</span>
            <b class="hidden md:block text-[22px] font-normal leading-none group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" aria-hidden="true">↗</b>
          </a>
        </div>

        <!-- Maven Central -->
        <div class="flex items-baseline justify-between gap-4 mt-16 mb-5">
          <h3 class="m-0 text-[clamp(22px,2.4vw,28px)] font-medium tracking-[-0.02em]">{{ oss?.mavenTitle }}</h3>
          <a [href]="oss?.mavenProfile?.href" target="_blank" rel="noopener noreferrer" class="inline-link">
            <span>{{ oss?.mavenProfile?.label }}</span><span aria-hidden="true">↗</span>
          </a>
        </div>
        <div class="flex flex-col divide-y divide-hair border border-hair bg-bg">
          <a
            *ngFor="let pkg of oss?.maven"
            [href]="pkg.href"
            target="_blank"
            rel="noopener noreferrer"
            class="grid grid-cols-1 md:grid-cols-[1.1fr_80px_1.6fr_24px] items-center gap-2 md:gap-6 p-5 md:px-6 no-underline text-fg group hover:bg-accent-wash transition-colors">
            <span class="font-mono text-[15px] group-hover:text-accent transition-colors break-all">{{ pkg.name }}</span>
            <span class="font-mono text-[11px] text-muted">v{{ pkg.version }}</span>
            <span class="text-muted text-[13px] leading-snug">{{ pkg.description }}</span>
            <b class="hidden md:block text-[22px] font-normal leading-none group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" aria-hidden="true">↗</b>
          </a>
        </div>
      </div>
    </section>
  `,
  styles: `
    .flow {
      stroke: var(--hair-2);
      stroke-width: 1.25;
      stroke-dasharray: 4 5;
      animation: flow 1.6s linear infinite;
      transition: stroke 0.2s;
    }
    .flow.is-active {
      stroke: var(--accent);
      stroke-width: 2;
    }
    @keyframes flow {
      to { stroke-dashoffset: -18; }
    }
    @media (prefers-reduced-motion: reduce) {
      .flow { animation: none; }
    }
  `
})
export class OpenSourceComponent {
  @Input() oss: OpenSourceConfig | null = null;

  readonly hub = HUB_POSITION;
  readonly satellitePositions = SATELLITE_POSITIONS;

  private readonly selectedApp = signal<EcosystemApp | null>(null);
  readonly copied = signal<string | null>(null);

  selected(): EcosystemApp | null {
    return this.selectedApp() ?? this.oss?.hub ?? null;
  }

  selectedId(): string | undefined {
    return this.selected()?.id;
  }

  select(app: EcosystemApp | undefined): void {
    if (app) {
      this.selectedApp.set(app);
    }
  }

  copy(text: string): void {
    navigator.clipboard?.writeText(text).then(() => {
      this.copied.set(text);
      setTimeout(() => this.copied.set(null), 1600);
    });
  }
}
