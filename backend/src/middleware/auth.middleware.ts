import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import ApiError from "../utilites/ApiError";
import asyncHandler from "../utilites/asynchandler";

export const authMiddlware = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new ApiError(401, "No token provided")
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
        return res.status(401).json({
            success: false,
            message: "The user is not logged in"
        })
    }
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not available");
    }
    const decode = jwt.verify(token, process.env.JWT_SECRET);
    if (typeof decode === 'string') {
        throw new ApiError(400, "The token is invalid");
    }
    req.userId = decode.userId;
    next();

})