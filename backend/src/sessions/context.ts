import 'koa';
import { UserResponse } from "../interfaces/user.interface";
import { CityInterface } from "../interfaces/city.interface";

declare module 'koa' {
    interface ExtendableContext {
        myContext: UserResponse;
    }
}