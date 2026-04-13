import 'koa';
import { UserResponse } from "../interfaces/user.interface";


export class ServerSideSessionContext {
    user: UserResponse;
}

declare module 'koa' {
    interface ExtendableContext {
        myContext: ServerSideSessionContext;
    }
}