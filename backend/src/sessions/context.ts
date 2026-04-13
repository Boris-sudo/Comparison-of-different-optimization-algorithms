import 'koa';
import { UserResponse } from "../interfaces/user.interface";
import { CityInterface } from "../interfaces/city.interface";


export class ServerSideSessionContext {
    user: UserResponse;
    city: CityInterface;
}

declare module 'koa' {
    interface ExtendableContext {
        myContext: ServerSideSessionContext;
    }
}