import { Routes } from '@angular/router';
import { Home } from "./pages/home/home";
import { CreatePath } from "./pages/create-path/create-path";
import { Compare } from "./pages/compare/compare";

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'editor',
        pathMatch: 'full',
    },
    {
        path: 'editor',
        component: Home,
        title: 'Главная',
    },
    {
        path: 'route',
        component: CreatePath,
        title: 'Построение',
    },
    {
        path: 'compare',
        component: Compare,
        title: 'Сравнение',
    },
    {
        path: '**',
        redirectTo: '',
    },
];
