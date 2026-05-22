import * as koa from 'koa';
import { Controller } from "@tsoa/runtime";
import { Body, OperationId, Post, Request, Response, Route, Security, Tags } from "tsoa";
import { redis } from "../server";

import { CityModelInterface } from "../interfaces/city.interface";
import { StreetChangeInterface } from "../interfaces/street.interface";
import { HouseChangeInterface } from "../interfaces/house.interface";
import { UserResponse } from "../interfaces/user.interface";
import { getToken } from "../utils/utils";

import * as CityService from "../services/city.service";
import * as StreetService from "../services/street.service";
import * as HouseService from "../services/house.service";


@Route('city')
export class GraphController extends Controller {
    @Post("generateRandomCity")
    @Tags("Default")
    @Response<UserResponse>(200, "succeed")
    @OperationId("generateRandomCity")
    @Security('auth')
    public async generateRandomCity(
        @Request() request: koa.Request,
    ): Promise<UserResponse> {
        const token = getToken(request);
        const new_city_apsp = await CityService.createRandomCity();

        const redisCity = CityService.createRedisInterface(new_city_apsp);
        await redis.set(token, redisCity);

        return { city: CityService.createCityInterface(new_city_apsp) };
    }

    @Post("createRandomGraphByModel")
    @Tags("Default")
    @Response<UserResponse>(200, "succeed")
    @OperationId("generateRandomCityByModel")
    @Security('auth')
    public async createRandomGraphByModel(
        @Request() request: koa.Request,
        @Body() dto: CityModelInterface,
    ): Promise<UserResponse> {
        const token = getToken(request);
        const new_city_apsp = await CityService.createRandomCity(dto.count);

        const redisCity = CityService.createRedisInterface(new_city_apsp);
        await redis.set(token, redisCity);

        return { city: CityService.createCityInterface(new_city_apsp) };
    }

    @Post("changeStreet")
    @Tags("Default")
    @Response<UserResponse>(200, "succeed")
    @OperationId("changeStreet")
    @Security('auth')
    public async changeStreet(
        @Request() request: koa.Request,
        @Body() dto: StreetChangeInterface,
    ): Promise<UserResponse> {
        const token = getToken(request);
        const old_city = request.ctx.myContext;
        const apsp = await CityService.mapCity(old_city);

        await StreetService.changeStreet(apsp, dto);

        const redisCity = CityService.createRedisInterface(apsp);
        await redis.set(token, redisCity);

        return { city: CityService.createCityInterface(apsp) };
    }

    @Post("changeHouse")
    @Tags("Default")
    @Response<UserResponse>(200, "succeed")
    @OperationId("changeHouse")
    @Security('auth')
    public async changeHouse(
        @Request() request: koa.Request,
        @Body() dto: HouseChangeInterface,
    ): Promise<UserResponse> {
        const token = getToken(request);
        const old_city = request.ctx.myContext;
        const apsp = await CityService.mapCity(old_city);

        await HouseService.changeHouse(apsp, dto);

        const redisCity = CityService.createRedisInterface(apsp);
        await redis.set(token, redisCity);

        return { city: CityService.createCityInterface(apsp) };
    }
}