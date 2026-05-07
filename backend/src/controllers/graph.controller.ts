import * as koa from 'koa';
import { Controller } from "@tsoa/runtime";
import { Body, OperationId, Post, Request, Response, Route, Security, Tags } from "tsoa";
import { redis } from "../server";

import { CityInterface, CityModelInterface } from "../interfaces/city.interface";
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
        const myContext = request.ctx.myContext;
        const user: UserResponse = myContext;
        const new_city_model = await CityService.createRandomCity();

        user.city = {
            id: new_city_model.id,
            houses: new_city_model.houses,
        };

        await redis.set(token, JSON.stringify(user));

        return myContext;
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
        const myContext = request.ctx.myContext;
        const user = myContext;
        const new_city_model = await CityService.createRandomCity(dto.count);

        user.city = {
            id: new_city_model.id,
            houses: new_city_model.houses,
        };

        await redis.set(token, JSON.stringify(user));

        return user;
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
        const user = request.ctx.myContext;
        const city = await CityService.mapCity(user.city);
        await StreetService.changeStreet(city, dto);

        await redis.set(token, JSON.stringify(user));

        return user;
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
        const user = request.ctx.myContext;
        const city = await CityService.mapCity(user.city);
        await HouseService.changeHouse(city, dto);

        await redis.set(token, JSON.stringify(user));

        return user;
    }
}