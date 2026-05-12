import * as koa from 'koa';
import { Controller } from "@tsoa/runtime";
import { OperationId, Post, Response, Route, Security, Tags, Request, Body } from "tsoa";

import { PathCreateInterface, PathPostInterface, PathResponseInterface } from "../interfaces/path.interface";

import * as CityService from '../services/city.service';
import * as PathService from '../services/path.service';
import { HouseInterface } from "../interfaces/house.interface";
import { InternalServerError } from "../utils/errors";

@Route('path')
export class PathController extends Controller {
    @Post("createPath")
    @Tags("Default")
    @Response<PathResponseInterface>(200, "succeed")
    @OperationId("createPath")
    @Security('auth')
    public async createPath(
        @Request() request: koa.Request,
        @Body() dto: PathPostInterface,
    ): Promise<PathResponseInterface> {
        const user = request.ctx.myContext;
        const city = await CityService.mapCity(user.city);
        const start = city.houseIndex.get(dto.startPoint);

        if (!start) throw new InternalServerError(`house with id ${dto.startPoint} not found`);
        const prompt: PathCreateInterface = {
            prompt: dto.prompt,
            model: dto.model,
            startPoint: start
        }

        const path = await PathService.createPath(city, prompt);

        return path;
    }
}
