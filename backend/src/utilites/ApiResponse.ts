class ApiResponse {
    message: string;
    statusCode: Number;
    data: any;
    success: boolean;

    constructor(statusCode: Number, data: any, message: string = "Success") {
        this.statusCode = statusCode;
        this.data = data;
        this.message = message;
        this.success = Number(statusCode) < Number(400);
    }
}

export default ApiResponse;