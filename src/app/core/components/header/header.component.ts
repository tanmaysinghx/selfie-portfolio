import { Component, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortfolioDataService } from '../../services/portfolio-data.service';
import { SearchService } from '../../services/search.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header
      class="sticky top-0 z-40 w-full transition-all duration-200"
      [ngClass]="isScrolled() ? 'bg-bg/95 backdrop-blur-sm border-b border-hair' : 'bg-bg border-b border-transparent'">
      <div class="container h-16 flex items-center justify-between">
        
        <!-- Brand -->
        <a class="flex items-center text-fg no-underline shrink-0" href="/">
          <span class="flex flex-col justify-center gap-0.5">
            <span class="text-sm font-medium leading-none tracking-[-0.005em]">
              {{ navigation()?.brand?.name }}
            </span>
            <span class="font-mono text-[11px] tracking-[0.08em] uppercase text-muted leading-none">
              {{ navigation()?.brand?.role }}
            </span>
          </span>
        </a>

        <!-- Desktop Navigation Links -->
        <nav class="hidden lg:flex items-center gap-1" aria-label="Main Navigation">
          <a
            *ngFor="let link of navigation()?.navLinks"
            [href]="link.href"
            class="relative text-sm tracking-[-0.005em] px-3 py-1.5 text-muted hover:text-accent font-normal transition-colors no-underline whitespace-nowrap"
            >
            {{ link.label }}
          </a>
        </nav>

        <!-- Right Side: Search & Primary CTA -->
        <div class="hidden lg:flex items-center gap-3">
          <!-- Cmd+K Search Trigger -->
          <button
            type="button"
            (click)="searchService.open()"
            aria-label="Search (Cmd+K)"
            class="bg-transparent border border-hair hover:border-hair-2 cursor-pointer flex items-center gap-1.5 text-muted hover:text-fg px-2.5 py-1.5 transition-colors text-xs">
            <span class="text-[13px] leading-none">⌕</span>
            <span class="font-mono text-[11px] tracking-[0.08em] uppercase text-muted leading-none">
              {{ navigation()?.searchShortcut || '⌘K' }}
            </span>
          </button>

          <!-- Primary CTA Button -->
          <a
            [href]="navigation()?.primaryCta?.href"
            class="primary-cta px-4 py-2 text-[13px] whitespace-nowrap min-h-0">
            {{ navigation()?.primaryCta?.label }}
          </a>
        </div>

        <!-- Mobile Hamburger Button -->
        <button
          type="button"
          (click)="toggleMobileMenu()"
          class="flex lg:hidden flex-col justify-center gap-[5px] cursor-pointer p-2 bg-transparent border-0"
          aria-label="Toggle navigation menu">
          <span class="block bg-fg w-[22px] h-[1.5px] transition-transform duration-200"
                [class.rotate-45]="isMobileOpen()"
                [class.translate-y-[6.5px]]="isMobileOpen()"></span>
          <span class="block bg-fg w-[22px] h-[1.5px] transition-opacity duration-200"
                [class.opacity-0]="isMobileOpen()"></span>
          <span class="block bg-fg w-[22px] h-[1.5px] transition-transform duration-200"
                [class.-rotate-45]="isMobileOpen()"
                [class.-translate-y-[6.5px]]="isMobileOpen()"></span>
        </button>
      </div>

      <!-- Mobile Dropdown Menu -->
      <div
        *ngIf="isMobileOpen()"
        class="lg:hidden fixed inset-x-0 top-16 bottom-0 bg-bg z-30 border-t border-hair flex flex-col p-6 overflow-y-auto">
        <a
          *ngFor="let link of navigation()?.navLinks"
          [href]="link.href"
          (click)="closeMobileMenu()"
          class="border-b border-hair py-4 text-[22px] font-medium tracking-[-0.02em] text-fg hover:text-accent no-underline">
          {{ link.label }}
        </a>
        
        <button
          type="button"
          (click)="openSearchFromMobile()"
          class="border-b border-hair py-4 text-[22px] font-medium tracking-[-0.02em] text-muted flex items-center justify-between text-left bg-transparent">
          <span>Search</span>
          <span class="font-mono text-sm uppercase">⌘K</span>
        </button>

        <a
          [href]="navigation()?.primaryCta?.href"
          (click)="closeMobileMenu()"
          class="primary-cta mt-6 w-full text-center text-sm py-3.5">
          {{ navigation()?.primaryCta?.label }}
        </a>
      </div>
    </header>
  `
})
export class HeaderComponent {
  private dataService = inject(PortfolioDataService);
  readonly searchService = inject(SearchService);

  readonly navigation = this.dataService.navigation;
  readonly isScrolled = signal<boolean>(false);
  readonly isMobileOpen = signal<boolean>(false);

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.isScrolled.set(window.scrollY > 20);
  }

  toggleMobileMenu(): void {
    this.isMobileOpen.update(v => !v);
  }

  closeMobileMenu(): void {
    this.isMobileOpen.set(false);
  }

  openSearchFromMobile(): void {
    this.closeMobileMenu();
    this.searchService.open();
  }
}
