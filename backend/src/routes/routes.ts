/* tslint:disable */
/* eslint-disable */
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import type { TsoaRoute } from '@tsoa/runtime';
import { fetchMiddlewares, KoaTemplateService } from '@tsoa/runtime';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { PingController } from './../controllers/ping.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { PathController } from './../controllers/path.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { GraphController } from './../controllers/graph.controller';
// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
import { UserController } from './../controllers/user.controller';
import { koaAuthentication } from './../sessions/main';
// @ts-ignore - no great way to install types from subpackage
import type { Context, Next, Middleware, Request as KRequest, Response as KResponse } from 'koa';
import type * as KoaRouter from '@koa/router';
const koaAuthenticationRecasted = koaAuthentication as (req: KRequest, securityName: string, scopes?: string[], res?: KResponse) => Promise<any>;


// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

const models: TsoaRoute.Models = {
    "PathResultItem": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "role": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["main"]},{"dataType":"enum","enums":["outer"]}],"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "PathAnalyzeDuration": {
        "dataType": "refObject",
        "properties": {
            "algo": {"dataType":"double","required":true},
            "network": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "PathResponseInterface": {
        "dataType": "refObject",
        "properties": {
            "points": {"dataType":"array","array":{"dataType":"refObject","ref":"PathResultItem"},"required":true},
            "length": {"dataType":"double","required":true},
            "duration": {"ref":"PathAnalyzeDuration","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ModelType": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["Dfs"]},{"dataType":"enum","enums":["Bfs"]},{"dataType":"enum","enums":["Annealing"]},{"dataType":"enum","enums":["ACO"]},{"dataType":"enum","enums":["A*"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "PathPostInterface": {
        "dataType": "refObject",
        "properties": {
            "model": {"ref":"ModelType","required":true},
            "prompt": {"dataType":"string","required":true},
            "startPoint": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "PathStatisticsInterface": {
        "dataType": "refObject",
        "properties": {
            "duration": {"ref":"PathAnalyzeDuration","required":true},
            "length": {"dataType":"double","required":true},
            "main_points": {"dataType":"array","array":{"dataType":"string"},"required":true},
            "points_count": {"dataType":"double","required":true},
            "points": {"dataType":"array","array":{"dataType":"refObject","ref":"PathResultItem"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Pair_PathStatisticsInterface_": {
        "dataType": "refAlias",
        "type": {"dataType":"nestedObjectLiteral","nestedProperties":{"second":{"ref":"PathStatisticsInterface","required":true},"first":{"ref":"PathStatisticsInterface","required":true}},"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "Pair_ModelType_": {
        "dataType": "refAlias",
        "type": {"dataType":"nestedObjectLiteral","nestedProperties":{"second":{"ref":"ModelType","required":true},"first":{"ref":"ModelType","required":true}},"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ComparePathPostInterface": {
        "dataType": "refObject",
        "properties": {
            "models": {"ref":"Pair_ModelType_","required":true},
            "prompt": {"dataType":"string","required":true},
            "startPoint": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "StreetInterface": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "from": {"dataType":"string","required":true},
            "to": {"dataType":"string","required":true},
            "length": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "HouseInterface": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "edges": {"dataType":"array","array":{"dataType":"refObject","ref":"StreetInterface"},"required":true},
            "category": {"dataType":"double","required":true},
            "time": {"dataType":"double","required":true},
            "price": {"dataType":"double","required":true},
            "weather": {"dataType":"boolean","required":true},
            "x": {"dataType":"double"},
            "y": {"dataType":"double"},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CityInterface": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "houses": {"dataType":"array","array":{"dataType":"refObject","ref":"HouseInterface"},"required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "UserResponse": {
        "dataType": "refObject",
        "properties": {
            "city": {"ref":"CityInterface","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "CityModelInterface": {
        "dataType": "refObject",
        "properties": {
            "count": {"dataType":"double","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "ActionInterface": {
        "dataType": "refAlias",
        "type": {"dataType":"union","subSchemas":[{"dataType":"enum","enums":["change"]},{"dataType":"enum","enums":["delete"]},{"dataType":"enum","enums":["add"]}],"validators":{}},
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "StreetChangeInterface": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "length": {"dataType":"double","required":true},
            "action": {"ref":"ActionInterface","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "HouseChangeInterface": {
        "dataType": "refObject",
        "properties": {
            "id": {"dataType":"string","required":true},
            "category": {"dataType":"double","required":true},
            "time": {"dataType":"double","required":true},
            "price": {"dataType":"double","required":true},
            "weather": {"dataType":"boolean","required":true},
            "action": {"ref":"ActionInterface","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
    "RegistrationResponse": {
        "dataType": "refObject",
        "properties": {
            "token": {"dataType":"string","required":true},
        },
        "additionalProperties": false,
    },
    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
};
const templateService = new KoaTemplateService(models, {"noImplicitAdditionalProperties":"throw-on-extras","bodyCoercion":true});

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa


export function RegisterRoutes(router: KoaRouter) {

    // ###########################################################################################################
    //  NOTE: If you do not see routes for all of your controllers in this file, then you might not have informed tsoa of where to look
    //      Please look into the "controllerPathGlobs" config option described in the readme: https://github.com/lukeautry/tsoa
    // ###########################################################################################################


        const argsPingController_ping: Record<string, TsoaRoute.ParameterSchema> = {
        };
        router.get('/ping',
            ...(fetchMiddlewares<Middleware>(PingController)),
            ...(fetchMiddlewares<Middleware>(PingController.prototype.ping)),

            async function PingController_ping(context: Context, next: Next) {

            let validatedArgs: any[] = [];
            try {
              validatedArgs = templateService.getValidatedArgs({ args: argsPingController_ping, context, next });
            } catch (err) {
              const error = err as any;
              error.message ||= JSON.stringify({ fields: error.fields });
              context.status = error.status;
              context.throw(context.status, error.message, error);
            }

            const controller = new PingController();

            return templateService.apiHandler({
              methodName: 'ping',
              controller,
              context,
              validatedArgs,
              successStatus: undefined,
            });
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsPathController_createPath: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
                dto: {"in":"body","name":"dto","required":true,"ref":"PathPostInterface"},
        };
        router.post('/path/createPath',
            authenticateMiddleware([{"auth":[]}]),
            ...(fetchMiddlewares<Middleware>(PathController)),
            ...(fetchMiddlewares<Middleware>(PathController.prototype.createPath)),

            async function PathController_createPath(context: Context, next: Next) {

            let validatedArgs: any[] = [];
            try {
              validatedArgs = templateService.getValidatedArgs({ args: argsPathController_createPath, context, next });
            } catch (err) {
              const error = err as any;
              error.message ||= JSON.stringify({ fields: error.fields });
              context.status = error.status;
              context.throw(context.status, error.message, error);
            }

            const controller = new PathController();

            return templateService.apiHandler({
              methodName: 'createPath',
              controller,
              context,
              validatedArgs,
              successStatus: undefined,
            });
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsPathController_comparePath: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
                dto: {"in":"body","name":"dto","required":true,"ref":"ComparePathPostInterface"},
        };
        router.post('/path/comparePath',
            authenticateMiddleware([{"auth":[]}]),
            ...(fetchMiddlewares<Middleware>(PathController)),
            ...(fetchMiddlewares<Middleware>(PathController.prototype.comparePath)),

            async function PathController_comparePath(context: Context, next: Next) {

            let validatedArgs: any[] = [];
            try {
              validatedArgs = templateService.getValidatedArgs({ args: argsPathController_comparePath, context, next });
            } catch (err) {
              const error = err as any;
              error.message ||= JSON.stringify({ fields: error.fields });
              context.status = error.status;
              context.throw(context.status, error.message, error);
            }

            const controller = new PathController();

            return templateService.apiHandler({
              methodName: 'comparePath',
              controller,
              context,
              validatedArgs,
              successStatus: undefined,
            });
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsGraphController_generateRandomCity: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        router.post('/city/generateRandomCity',
            authenticateMiddleware([{"auth":[]}]),
            ...(fetchMiddlewares<Middleware>(GraphController)),
            ...(fetchMiddlewares<Middleware>(GraphController.prototype.generateRandomCity)),

            async function GraphController_generateRandomCity(context: Context, next: Next) {

            let validatedArgs: any[] = [];
            try {
              validatedArgs = templateService.getValidatedArgs({ args: argsGraphController_generateRandomCity, context, next });
            } catch (err) {
              const error = err as any;
              error.message ||= JSON.stringify({ fields: error.fields });
              context.status = error.status;
              context.throw(context.status, error.message, error);
            }

            const controller = new GraphController();

            return templateService.apiHandler({
              methodName: 'generateRandomCity',
              controller,
              context,
              validatedArgs,
              successStatus: undefined,
            });
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsGraphController_createRandomGraphByModel: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
                dto: {"in":"body","name":"dto","required":true,"ref":"CityModelInterface"},
        };
        router.post('/city/createRandomGraphByModel',
            authenticateMiddleware([{"auth":[]}]),
            ...(fetchMiddlewares<Middleware>(GraphController)),
            ...(fetchMiddlewares<Middleware>(GraphController.prototype.createRandomGraphByModel)),

            async function GraphController_createRandomGraphByModel(context: Context, next: Next) {

            let validatedArgs: any[] = [];
            try {
              validatedArgs = templateService.getValidatedArgs({ args: argsGraphController_createRandomGraphByModel, context, next });
            } catch (err) {
              const error = err as any;
              error.message ||= JSON.stringify({ fields: error.fields });
              context.status = error.status;
              context.throw(context.status, error.message, error);
            }

            const controller = new GraphController();

            return templateService.apiHandler({
              methodName: 'createRandomGraphByModel',
              controller,
              context,
              validatedArgs,
              successStatus: undefined,
            });
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsGraphController_changeStreet: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
                dto: {"in":"body","name":"dto","required":true,"ref":"StreetChangeInterface"},
        };
        router.post('/city/changeStreet',
            authenticateMiddleware([{"auth":[]}]),
            ...(fetchMiddlewares<Middleware>(GraphController)),
            ...(fetchMiddlewares<Middleware>(GraphController.prototype.changeStreet)),

            async function GraphController_changeStreet(context: Context, next: Next) {

            let validatedArgs: any[] = [];
            try {
              validatedArgs = templateService.getValidatedArgs({ args: argsGraphController_changeStreet, context, next });
            } catch (err) {
              const error = err as any;
              error.message ||= JSON.stringify({ fields: error.fields });
              context.status = error.status;
              context.throw(context.status, error.message, error);
            }

            const controller = new GraphController();

            return templateService.apiHandler({
              methodName: 'changeStreet',
              controller,
              context,
              validatedArgs,
              successStatus: undefined,
            });
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsGraphController_changeHouse: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
                dto: {"in":"body","name":"dto","required":true,"ref":"HouseChangeInterface"},
        };
        router.post('/city/changeHouse',
            authenticateMiddleware([{"auth":[]}]),
            ...(fetchMiddlewares<Middleware>(GraphController)),
            ...(fetchMiddlewares<Middleware>(GraphController.prototype.changeHouse)),

            async function GraphController_changeHouse(context: Context, next: Next) {

            let validatedArgs: any[] = [];
            try {
              validatedArgs = templateService.getValidatedArgs({ args: argsGraphController_changeHouse, context, next });
            } catch (err) {
              const error = err as any;
              error.message ||= JSON.stringify({ fields: error.fields });
              context.status = error.status;
              context.throw(context.status, error.message, error);
            }

            const controller = new GraphController();

            return templateService.apiHandler({
              methodName: 'changeHouse',
              controller,
              context,
              validatedArgs,
              successStatus: undefined,
            });
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserController_register: Record<string, TsoaRoute.ParameterSchema> = {
        };
        router.post('/auth/register',
            ...(fetchMiddlewares<Middleware>(UserController)),
            ...(fetchMiddlewares<Middleware>(UserController.prototype.register)),

            async function UserController_register(context: Context, next: Next) {

            let validatedArgs: any[] = [];
            try {
              validatedArgs = templateService.getValidatedArgs({ args: argsUserController_register, context, next });
            } catch (err) {
              const error = err as any;
              error.message ||= JSON.stringify({ fields: error.fields });
              context.status = error.status;
              context.throw(context.status, error.message, error);
            }

            const controller = new UserController();

            return templateService.apiHandler({
              methodName: 'register',
              controller,
              context,
              validatedArgs,
              successStatus: undefined,
            });
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        const argsUserController_profile: Record<string, TsoaRoute.ParameterSchema> = {
                request: {"in":"request","name":"request","required":true,"dataType":"object"},
        };
        router.get('/auth/profile',
            authenticateMiddleware([{"auth":[]}]),
            ...(fetchMiddlewares<Middleware>(UserController)),
            ...(fetchMiddlewares<Middleware>(UserController.prototype.profile)),

            async function UserController_profile(context: Context, next: Next) {

            let validatedArgs: any[] = [];
            try {
              validatedArgs = templateService.getValidatedArgs({ args: argsUserController_profile, context, next });
            } catch (err) {
              const error = err as any;
              error.message ||= JSON.stringify({ fields: error.fields });
              context.status = error.status;
              context.throw(context.status, error.message, error);
            }

            const controller = new UserController();

            return templateService.apiHandler({
              methodName: 'profile',
              controller,
              context,
              validatedArgs,
              successStatus: undefined,
            });
        });
        // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa


    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

    function authenticateMiddleware(security: TsoaRoute.Security[] = []) {
        return async function runAuthenticationMiddleware(context: any, next: any) {

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            // keep track of failed auth attempts so we can hand back the most
            // recent one.  This behavior was previously existing so preserving it
            // here
            const failedAttempts: any[] = [];
            const pushAndRethrow = (error: any) => {
                failedAttempts.push(error);
                throw error;
            };

            const secMethodOrPromises: Promise<any>[] = [];
            for (const secMethod of security) {
                if (Object.keys(secMethod).length > 1) {
                    const secMethodAndPromises: Promise<any>[] = [];

                    for (const name in secMethod) {
                        secMethodAndPromises.push(
                            koaAuthenticationRecasted(context.request, name, secMethod[name], context.response)
                                .catch(pushAndRethrow)
                        );
                    }

                    secMethodOrPromises.push(Promise.all(secMethodAndPromises)
                        .then(users => { return users[0]; }));
                } else {
                    for (const name in secMethod) {
                        secMethodOrPromises.push(
                            koaAuthenticationRecasted(context.request, name, secMethod[name], context.response)
                                .catch(pushAndRethrow)
                        );
                    }
                }
            }

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa

            let success;
            try {
                const user = await Promise.any(secMethodOrPromises);
                success = true;
                context.request['user'] = user;
            }
            catch(err) {
                // Response was sent in middleware, abort
                if(context.response.body) {
                    return;
                }

                // Show most recent error as response
                const error = failedAttempts.pop();
                context.status = error.status || 401;
                context.throw(context.status, error.message, error);
            }

            // Response was sent in middleware, abort
            if(context.response.body) {
                return;
            }

            if (success) {
                await next();
            }

            // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
        }
    }

    // WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
}

// WARNING: This file was auto-generated with tsoa. Please do not modify it. Re-run tsoa to re-generate this file: https://github.com/lukeautry/tsoa
