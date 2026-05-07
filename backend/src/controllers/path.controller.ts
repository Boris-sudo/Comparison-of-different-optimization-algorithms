import * as koa from 'koa';
import { Controller } from "@tsoa/runtime";
import { OperationId, Post, Response, Route, Security, Tags, Request, Body } from "tsoa";

import { PathPostInterface, PathResponseInterface } from "../interfaces/path.interface";

import * as CityService from '../services/city.service';
import * as PathService from '../services/path.service';

@Route('path')
export class PathController extends Controller {
    @Post("createPath")
    @Tags("Default")
    @Response<PathResponseInterface>(200, "succeed")
    @OperationId("createPath")
    @Security('auth')
    public async createPath(
        @Request() request: koa.Request,
        @Body() dto: PathPostInterface
    ): Promise<PathResponseInterface> {
        const user = request.ctx.myContext;
        const city = await CityService.mapCity(user.city);

        const path = await PathService.createPath(city, dto);

        return path;
    }
}
