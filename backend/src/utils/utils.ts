import * as koa from 'koa';

export const delay = function (ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function getRandomInt(min: number = 0, max: number = 1): number {
    return Math.floor(Math.random() * (max - min) + min);
}

export function randomChoice(array: any[]) {
    return array[getRandomInt(0, array.length)];
}

export function getToken(request: koa.Request): string {
    const Bearer: string = request.ctx.headers?.auth!.toString();
    return Bearer.split('Bearer: ')[1] || '';
}

export type ActionInterface = 'change' | 'delete' | 'add';