import { Routes } from '@angular/router';
import { Home } from "./pages/home/home";
import { CreatePath } from "./pages/create-path/create-path";

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
        title: 'Главная',
    },
    {
        path: '**',
        redirectTo: '',
    },
];
