import * as koa from 'koa';

export type Pair<T> = {
    first: T;
    second: T;
}

export const delay = function (ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function getRandomInt(min: number = 0, max: number = 1): number {
    return Math.floor(Math.random() * (max - min) + min);
}

export function randomChoice<T>(array: T[]): T {
    return array[getRandomInt(0, array.length)];
}

export function getToken(request: koa.Request): string {
    const Bearer: string = request.ctx.headers?.authorization!.toString();
    return Bearer.split('Bearer ')[1] || '';
}

export type ActionInterface = 'change' | 'delete' | 'add';

export class Queue<T> {
    private items: T[] = [];

    add(item: T): void {
        this.items.push(item);
    }

    get(): T | undefined {
        return this.items.shift();
    }

    isEmpty(): boolean {
        return this.items.length === 0;
    }
}

export class RandomQueue<T> {
    private items: T[] = [];

    add(item: T): void {
        this.items.push(item);
    }

    get(): T | undefined {
        const index = getRandomInt(0, this.items.length);
        const item = this.items[index];
        this.items[index] = this.items[this.items.length - 1];
        this.items.pop();
        return item;
    }

    size() {
        return this.items.length;
    }

    isEmpty(): boolean {
        return this.items.length === 0;
    }
}