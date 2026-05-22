import 'koa';
import { RedisCityInterface } from "../interfaces/city.interface";

declare module 'koa' {
    interface ExtendableContext {
        myContext: RedisCityInterface;
    }
}