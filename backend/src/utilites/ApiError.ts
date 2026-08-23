class ApiError extends Error {
    statusCode:Number;
    data:any;
    success:boolean;
    errors:any
     constructor(statusCode:Number, message="Something went wrong", errors:any[]=[], stack="")
     {
         super(message);
         this.statusCode = statusCode;
         this.data = null;
         this.message = message;
         this.success = false;
         this.errors = errors;
 
         if(stack) {
             this.stack = stack;
         }
         else {
             Error.captureStackTrace(this, this.constructor);
         }
     }
 }
 
 export default ApiError;