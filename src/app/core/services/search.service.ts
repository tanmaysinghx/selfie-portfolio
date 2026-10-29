import { Injectable, signal, computed, inject } from '@angular/core';
import { PortfolioDataService } from './portfolio-data.service';
import { BlogService } from './blog.service';
import { SearchItem } from '../models/portfolio.model';

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private dataService = inject(PortfolioDataService);
  private blogService = inject(BlogService);

  readonly isOpen = signal<boolean>(false);
  readonly query = signal<string>('');

  readonly filteredResults = computed(() => {
    const q = this.query().trim().toLowerCase();
    const posts: SearchItem[] = this.blogService.posts().map(post => ({
      category: 'Blog',
      title: post.title,
      description: post.description,
      href: `/blog/${post.slug}`,
      keywords: `blog post article writing ${post.tags.join(' ')}`
    }));
    const items = [...this.dataService.searchIndex(), ...posts];

    if (!q) {
      return items.slice(0, 8);
    }

    return items.filter(item =>
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.keywords.toLowerCase().includes(q)
    );
  });

  open(): void {
    this.isOpen.set(true);
    this.query.set('');
  }

  close(): void {
    this.isOpen.set(false);
    this.query.set('');
  }

  toggle(): void {
    if (this.isOpen()) {
      this.close();
    } else {
      this.open();
    }
  }

  setQuery(query: string): void {
    this.query.set(query);
  }
}
