import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/global-overview/global-overview.component')
        .then(m => m.GlobalOverviewComponent)
  },
  {
    path: 'player/:id',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component')
        .then(m => m.DashboardComponent)
  },
  {
    path: 'compare/:id1/:id2',
    loadComponent: () =>
      import('./features/compare/compare.component')
        .then(m => m.CompareComponent)
  },
  // Entry point — opens with empty slots, user picks both players
  {
    path: 'compare',
    loadComponent: () =>
      import('./features/compare/compare.component')
        .then(m => m.CompareComponent)
  },
  {
    path: 'methodology',
    loadComponent: () =>
      import('./features/methodology/methodology.component')
        .then(m => m.MethodologyComponent)
  },
  { path: '**', redirectTo: '' }
];