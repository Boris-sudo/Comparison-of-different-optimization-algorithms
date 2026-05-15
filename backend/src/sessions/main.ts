import * as koa from "koa";
import * as errors from "../utils/errors"
import { redis } from "../server";
import { getToken } from "../utils/utils";


export async function koaAuthentication(request: koa.Request, securityName: string, scopes?: string[]): Promise<any> {
    const ctx = request.ctx;

    if (securityName === 'auth') {
        const token = getToken(request);
        const session = await redis.get(token);

        if (session) {
            // ctx.header.auth = '';
            ctx.myContext = session;
            return;
        }
    }

    throw (new errors.Unauthorized());
}