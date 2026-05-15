import 'koa';
import { UserResponse } from "../interfaces/user.interface";
import { RedisCityInterface } from "../interfaces/city.interface";

declare module 'koa' {
    interface ExtendableContext {
        myContext: RedisCityInterface;
    }
}