import * as koa from 'koa';
import { Controller } from "@tsoa/runtime";
import { Get, OperationId, Post, Response, Route, Security, Tags, Request } from "tsoa";

import { RegistrationResponse, UserResponse } from "../interfaces/user.interface";
import { redis } from "../server";

import * as crypto from "../utils/crypto";
import * as UserService from "../services/user.service";

@Route('auth')
export class UserController extends Controller {
    @Post("register")
    @Tags("Default")
    @Response<RegistrationResponse>(200, "succeed")
    @OperationId("register")
    public async register(): Promise<RegistrationResponse> {
        const user = await UserService.createNewUser();
        const token = crypto.generateBearerToken();
        await redis.set(token, JSON.stringify(user));
        return { token: 'Bearer: ' + token };
    }

    @Get("profile")
    @Tags("Default")
    @Response<UserResponse>(200, "succeed")
    @OperationId("profile")
    @Security('auth')
    public async profile(
        @Request() request: koa.Request
    ): Promise<UserResponse> {
        const myContext = request.ctx.myContext;
        return myContext;
    }
}