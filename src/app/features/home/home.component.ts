import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortfolioDataService } from '../../core/services/portfolio-data.service';
import { HeroSectionComponent } from './components/hero-section/hero-section.component';
import { ExperienceComponent } from './components/experience/experience.component';
import { OpenSourceComponent } from './components/open-source/open-source.component';
import { StackComponent } from './components/stack/stack.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    HeroSectionComponent,
    ExperienceComponent,
    OpenSourceComponent,
    StackComponent
  ],
  template: `
    <main class="w-full">
      <app-hero-section [hero]="hero()"></app-hero-section>
      <app-experience [work]="work()"></app-experience>
      <app-open-source [oss]="openSource()"></app-open-source>
      <app-stack [stack]="stack()"></app-stack>
    </main>
  `
})
export class HomeComponent {
  private dataService = inject(PortfolioDataService);

  readonly hero = this.dataService.hero;
  readonly work = this.dataService.work;
  readonly openSource = this.dataService.openSource;
  readonly stack = this.dataService.stack;
}
