import { Pipe, PipeTransform } from '@angular/core';
import { PathResultItem } from '../../generated';

@Pipe({
    name: 'mainPoints',
    standalone: true,
})
export class MainPointsPipe implements PipeTransform {
    transform(points: PathResultItem[]): string[] {
        return points.filter(p => p.role === 'main').map(p => p.id);
    }
}