import { Routes } from '@angular/router';
import { HomeComponent } from './features/home/home.component';

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'blog',
    loadComponent: () =>
      import('./features/blog/blog-list.component').then(m => m.BlogListComponent)
  },
  {
    path: 'blog/:slug',
    loadComponent: () =>
      import('./features/blog/blog-post.component').then(m => m.BlogPostComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
