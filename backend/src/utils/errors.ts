export class BadRequest extends Error {
    status = 400
    name = 'BadRequest'
    expose = false
}

export class Unauthorized extends Error {
    status = 401
    name = 'Unauthorized'
    expose = false
}

export class InternalServerError extends Error {
    status = 500
    name = 'InternalServerError'
    expose = false
}

export class Conflict extends Error {
    status = 409
    name = 'Conflict'
    expose = false
}

export class UserAlreadyExists extends Conflict {
    name = 'UserAlreadyExists'

    constructor() {
        super('User already exists')
    }
}

export class NotFound extends Error {
    status = 404
    name = 'NotFound'
    expose = false

    constructor(obj: string) {
        super(`${ obj } not found`);
    }
}

export class UserNotFound extends Error {
    status = 404
    name = 'UserNotFound'

    constructor() {
        super('User not found');
    }
}

export class InvalidUserPassword extends Error {
    status = 401
    name = 'InvalidUserPassword'

    constructor(mes: string) {
        super(`Invalid User Password: ${ mes }`);
    }
}

export class ValidationError extends Conflict {
    name = 'ValidationError';

    constructor(errors: Record<string, any>) {
        super(JSON.stringify(errors));
    }
}