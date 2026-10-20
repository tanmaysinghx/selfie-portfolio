import { Component, Input, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FermentationStage } from '../../../core/models/portfolio.model';

@Component({
  selector: 'app-kombucha-jar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="text-center flex flex-col items-center gap-3 w-full">
      <p class="text-[12px] text-muted m-0 leading-relaxed">{{ caption }}</p>
      
      <svg width="120" height="160" viewBox="0 0 120 160" fill="none" aria-hidden="true" class="my-1">
        <!-- Jar lid / rim -->
        <rect x="35" y="8" width="50" height="12" rx="3" fill="var(--fg)" opacity="0.15"></rect>
        <rect x="40" y="4" width="40" height="8" rx="2" fill="var(--fg)" opacity="0.1"></rect>
        
        <!-- Jar glass outline -->
        <path d="M25 22 Q20 26 20 32 L20 138 Q20 148 30 148 L90 148 Q100 148 100 138 L100 32 Q100 26 95 22 Z"
              fill="var(--bg)" stroke="var(--fg)" stroke-width="1.5" stroke-opacity="0.2"></path>
        
        <defs>
          <clipPath id="jar-tea-clip">
            <path d="M22 40 L22 138 Q22 146 30 146 L90 146 Q98 146 98 138 L98 40 Z"></path>
          </clipPath>
        </defs>
        
        <!-- Fermenting liquid with transition -->
        <rect x="20" y="35" width="80" height="115"
              [attr.fill]="currentStage().teaColor"
              clip-path="url(#jar-tea-clip)"
              class="transition-colors duration-500"
              opacity="0.85"></rect>
        
        <!-- SCOBY layer at top of liquid -->
        <ellipse cx="60" cy="42" rx="35" ry="5" fill="#D4A875"
                 [attr.opacity]="currentStage().scobyOpacity"
                 class="transition-opacity duration-500"></ellipse>
        
        <!-- Glass highlight reflection -->
        <path d="M30 30 Q28 80 30 130" stroke="white" stroke-width="2" stroke-opacity="0.15" stroke-linecap="round"></path>
      </svg>

      <!-- Stage Description -->
      <div class="min-h-[46px] flex flex-col justify-center items-center">
        <strong class="text-[13px] font-medium leading-relaxed text-fg">{{ currentStage().title }}</strong>
        <span class="text-[12px] text-muted leading-relaxed">{{ currentStage().description }}</span>
      </div>

      <!-- Day selector buttons -->
      <div class="grid grid-cols-5 gap-1 w-full max-w-[240px]" role="group" aria-label="Fermentation days">
        <button
          *ngFor="let stage of stages"
          type="button"
          (click)="selectDay(stage.day)"
          [attr.aria-pressed]="selectedDay() === stage.day"
          class="h-9 font-mono text-[12px] border transition-all cursor-pointer flex items-center justify-center rounded-none"
          [ngClass]="selectedDay() === stage.day ?
            'bg-bg text-fg font-semibold border-hair-2 shadow-sm' :
            'bg-transparent text-muted hover:text-fg hover:bg-bg border-transparent'">
          {{ stage.day }}
        </button>
      </div>
    </div>
  `
})
export class KombuchaJarComponent {
  @Input() stages: FermentationStage[] = [];
  @Input() caption: string = 'Fermentation preview';

  readonly selectedDay = signal<number>(3);

  readonly currentStage = computed(() => {
    const day = this.selectedDay();
    const found = this.stages.find(s => s.day === day);
    return found || this.stages[1] || {
      day: 3,
      title: 'Day 3 · Fermenting',
      description: 'SCOBY getting to work',
      teaColor: '#7A4020',
      scobyOpacity: 0.6,
      bubbleCount: 5
    };
  });

  selectDay(day: number): void {
    this.selectedDay.set(day);
  }
}
