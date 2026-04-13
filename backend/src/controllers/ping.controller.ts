import { Controller } from "@tsoa/runtime";
import { Get, OperationId, Route, Tags } from "tsoa";

@Route('ping')
export class PingController extends Controller {
    @Get('')
    @Tags("Default")
    @OperationId('ping')
    public async ping(): Promise<string> {
        return 'success';
    }
}