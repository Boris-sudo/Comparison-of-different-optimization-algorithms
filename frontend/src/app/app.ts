import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet],
    styles: `
        
    `,
    template: `
        
    `
})
export class App {
    protected readonly title = signal('frontend');
}
