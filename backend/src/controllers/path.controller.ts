import * as koa from 'koa';
import { Controller } from "@tsoa/runtime";
import { OperationId, Post, Response, Route, Security, Tags, Request, Body } from "tsoa";

import {
    ComparePathCreateInterface,
    ComparePathPostInterface,
    PathCreateInterface,
    PathPostInterface,
    PathResponseInterface, PathStatisticsInterface
} from "../interfaces/path.interface";
import { InternalServerError } from "../utils/errors";

import * as CityService from '../services/city.service';
import * as PathService from '../services/path.service';
import { Pair } from "../utils/utils";

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
        const apsp = await CityService.mapCity(request.ctx.myContext);
        const start = apsp.city.houseIndex.get(dto.startPoint);
        if (!start) throw new InternalServerError(`house with id ${dto.startPoint} not found`);

        const prompt: PathCreateInterface = {
            prompt: dto.prompt,
            model: dto.model,
            startPoint: start
        }

        const path = await PathService.createPath(apsp, prompt);

        return path;
    }

    @Post("comparePath")
    @Tags("Default")
    @Response<PathResponseInterface>(200, "succeed")
    @OperationId("comparePath")
    @Security('auth')
    public async comparePath(
        @Request() request: koa.Request,
        @Body() dto: ComparePathPostInterface,
    ): Promise<Pair<PathStatisticsInterface>> {
        const apsp = await CityService.mapCity(request.ctx.myContext);
        const start = apsp.city.houseIndex.get(dto.startPoint);
        if (!start) throw new InternalServerError(`house with id ${dto.startPoint} not found`);

        const prompt: ComparePathCreateInterface = {
            prompt: dto.prompt,
            models: dto.models,
            startPoint: start
        }

        const path = await PathService.comparePaths(apsp, prompt);

        return path;
    }
}
