import cors from "@koa/cors";
import Router from "@koa/router";
import Koa from "koa";
import bodyParser from "koa-bodyparser";
import "reflect-metadata";

import { config } from "./config";
import { RedisConfiguration } from "./providers/connections";

import { RegisterRoutes } from "./routes/routes";

const redis = new RedisConfiguration();

const server = async function () {
    const app = new Koa();

    app.use(cors({
        credentials: true,
        allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        origin: (ctx: Koa.Context) => {
            return ctx.request.headers.origin ?? "";
        },
    }));

    app.use(bodyParser({}));

    app.use(async (ctx, next) => {
        await next();
        const rt = ctx.response.get("X-Response-Time");
        console.log(`${ ctx.method } ${ ctx.url } - ${ rt }`);
    });

    app.use(async (ctx, next) => {
        const start = Date.now();
        await next();
        const ms = Date.now() - start;
        ctx.set("X-Response-Time", `${ ms }ms`);
    });

    const router = new Router();
    RegisterRoutes(router);
    app.use(router.routes());

    app.listen(config.port);

    console.log(`server started on port: http://localhost:${ config.port }`);
};

if (config.nodeEnv !== "test")
    server().then();

export { redis };