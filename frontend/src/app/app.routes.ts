import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'pessoas' },
  { path: 'pessoas', loadComponent: () => import('./pages/pessoas/pessoas').then(m => m.Pessoas) },
  { path: 'modelos', loadComponent: () => import('./pages/modelos/modelos').then(m => m.Modelos) },
  { path: 'gerador', loadComponent: () => import('./pages/gerador/gerador').then(m => m.Gerador) },
  { path: 'documentos-gerados', loadComponent: () => import('./pages/documentos-gerados/documentos-gerados').then(m => m.DocumentosGerados) },
];
