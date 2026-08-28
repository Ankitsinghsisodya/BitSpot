export class APiError extends Error {
    statusCode: number;
    success: boolean;
    errors: any;
    constructor(statusCode: number, message = "something went wrong", errors = [], stack = "") {
        super(message);
        this.statusCode = statusCode;
        this.success = false;
        this.errors = errors;
        this.message = message;

        if (stack) {
            this.stack = stack
        }
        else {
            Error.captureStackTrace(this, this.constructor);
        }
    }

}
