import { Component, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SearchService } from '../../services/search.service';
import { SearchItem } from '../../models/portfolio.model';

@Component({
  selector: 'app-search-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="searchService.isOpen()"
      class="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-fg/40 backdrop-blur-sm transition-opacity"
      (click)="onBackdropClick($event)">
      
      <div
        class="bg-bg border border-hair-2 w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150"
        (click)="$event.stopPropagation()">
        
        <!-- Search Input Bar -->
        <div class="flex items-center px-4 py-3.5 border-b border-hair gap-3 bg-bg-2">
          <span class="text-muted text-base">⌕</span>
          <input
            #searchInput
            type="text"
            [ngModel]="searchService.query()"
            (ngModelChange)="searchService.setQuery($event)"
            placeholder="Type a command or search (projects, notes, stories)..."
            class="flex-1 bg-transparent border-0 outline-none text-fg text-sm placeholder:text-muted"
            autofocus />
          <kbd class="font-mono text-[10px] uppercase bg-bg border border-hair-2 px-1.5 py-0.5 rounded text-muted">
            ESC
          </kbd>
        </div>

        <!-- Search Results List -->
        <div class="overflow-y-auto p-2 divide-y divide-hair/40">
          <div *ngIf="searchService.filteredResults().length === 0" class="py-8 text-center text-muted text-sm">
            No matching results found for "{{ searchService.query() }}"
          </div>

          <a
            *ngFor="let item of searchService.filteredResults()"
            [href]="item.href"
            (click)="selectItem(item)"
            class="flex flex-col gap-1 p-3 hover:bg-surface-alt transition-colors group cursor-pointer text-fg no-underline">
            <div class="flex items-center justify-between">
              <span class="font-medium text-sm group-hover:text-accent transition-colors">
                {{ item.title }}
              </span>
              <span class="font-mono text-[10px] uppercase px-1.5 py-0.5 bg-hair/50 text-muted">
                {{ item.category }}
              </span>
            </div>
            <p class="text-xs text-muted m-0 line-clamp-1">
              {{ item.description }}
            </p>
          </a>
        </div>

        <!-- Footer / Keyboard hint -->
        <div class="px-4 py-2 bg-bg-2 border-t border-hair flex items-center justify-between text-[11px] text-muted">
          <span>Navigate with mouse or links</span>
          <span>Press ESC to close</span>
        </div>
      </div>
    </div>
  `
})
export class SearchModalComponent {
  readonly searchService = inject(SearchService);

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      this.searchService.toggle();
    } else if (event.key === 'Escape' && this.searchService.isOpen()) {
      this.searchService.close();
    }
  }

  onBackdropClick(event: MouseEvent): void {
    this.searchService.close();
  }

  selectItem(item: SearchItem): void {
    this.searchService.close();
  }
}
