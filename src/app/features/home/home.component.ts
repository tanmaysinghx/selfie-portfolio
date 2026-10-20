import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PortfolioDataService } from '../../core/services/portfolio-data.service';
import { HeroSectionComponent } from './components/hero-section/hero-section.component';
import { SelectedWorkComponent } from './components/selected-work/selected-work.component';
import { InRotationComponent } from './components/in-rotation/in-rotation.component';
import { ExperimentsComponent } from './components/experiments/experiments.component';
import { RecentWritingComponent } from './components/recent-writing/recent-writing.component';
import { OutsideWorkComponent } from './components/outside-work/outside-work.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    CommonModule,
    HeroSectionComponent,
    SelectedWorkComponent,
    InRotationComponent,
    ExperimentsComponent,
    RecentWritingComponent,
    OutsideWorkComponent
  ],
  template: `
    <main class="w-full">
      <app-hero-section [hero]="hero()"></app-hero-section>
      <app-selected-work [work]="work()"></app-selected-work>
      <app-in-rotation [inRotation]="inRotation()"></app-in-rotation>
      <app-experiments [experiments]="experiments()"></app-experiments>
      <app-recent-writing [writing]="writing()"></app-recent-writing>
      <app-outside-work [life]="life()"></app-outside-work>
    </main>
  `
})
export class HomeComponent {
  private dataService = inject(PortfolioDataService);

  readonly hero = this.dataService.hero;
  readonly work = this.dataService.work;
  readonly inRotation = this.dataService.inRotation;
  readonly experiments = this.dataService.experiments;
  readonly writing = this.dataService.writing;
  readonly life = this.dataService.life;
}
