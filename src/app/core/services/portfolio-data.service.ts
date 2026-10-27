import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  ProfileConfig,
  NavigationConfig,
  HeroConfig,
  WorkConfig,
  OpenSourceConfig,
  StackConfig,
  LifeConfig,
  FooterConfig,
  SearchItem
} from '../models/portfolio.model';

@Injectable({
  providedIn: 'root'
})
export class PortfolioDataService {
  private http = inject(HttpClient);

  // Reactive state signals for all sections
  readonly profile = signal<ProfileConfig | null>(null);
  readonly navigation = signal<NavigationConfig | null>(null);
  readonly hero = signal<HeroConfig | null>(null);
  readonly work = signal<WorkConfig | null>(null);
  readonly openSource = signal<OpenSourceConfig | null>(null);
  readonly stack = signal<StackConfig | null>(null);
  readonly life = signal<LifeConfig | null>(null);
  readonly footer = signal<FooterConfig | null>(null);
  readonly searchIndex = signal<SearchItem[]>([]);
  readonly isLoaded = signal<boolean>(false);

  constructor() {
    this.loadAllData();
  }

  async loadAllData(): Promise<void> {
    try {
      const [profile, navigation, hero, work, openSource, stack, life, footer, searchIndex] =
        await Promise.all([
          firstValueFrom(this.http.get<ProfileConfig>('/data/profile.json')),
          firstValueFrom(this.http.get<NavigationConfig>('/data/navigation.json')),
          firstValueFrom(this.http.get<HeroConfig>('/data/hero.json')),
          firstValueFrom(this.http.get<WorkConfig>('/data/work.json')),
          firstValueFrom(this.http.get<OpenSourceConfig>('/data/open-source.json')),
          firstValueFrom(this.http.get<StackConfig>('/data/stack.json')),
          firstValueFrom(this.http.get<LifeConfig>('/data/life.json')),
          firstValueFrom(this.http.get<FooterConfig>('/data/footer.json')),
          firstValueFrom(this.http.get<SearchItem[]>('/data/search.json'))
        ]);

      this.profile.set(profile);
      this.navigation.set(navigation);
      this.hero.set(hero);
      this.work.set(work);
      this.openSource.set(openSource);
      this.stack.set(stack);
      this.life.set(life);
      this.footer.set(footer);
      this.searchIndex.set(searchIndex);
      this.isLoaded.set(true);
    } catch (err) {
      console.warn('Error fetching portfolio JSON files:', err);
    }
  }
}
