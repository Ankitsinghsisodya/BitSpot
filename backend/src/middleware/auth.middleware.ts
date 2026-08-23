import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

export const authMiddlware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                errors: "No token provided"
            })
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
            return res.status(400).json({
                success: false,
                message: "The token is invalid"
            })
        }
        req.userId = decode.userId;
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            errors: error instanceof Error ? error.stack : error
        })
    }
}