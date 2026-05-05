import { UserResponse } from "../interfaces/user.interface";

import * as CityService from './city.service'

export const createNewUser = async function (): Promise<UserResponse> {
    const randomCity = await CityService.createRandomCity();

    return {
        city: randomCity
    };
}