import type { Request, Response } from "express";
import ApiError from "../utilites/ApiError";
import ApiResponse from "../utilites/ApiResponse";
import asyncHandler from "../utilites/asynchandler";
import { prisma } from "../utilites/db";
import jwt from "jsonwebtoken"

export const signup = asyncHandler(async (req: Request, res: Response) => {
    const parsedRequest = authRequest.safeParse(req.body);
    if (!parsedRequest.success) {
        throw new ApiError(400, "", parsedRequest.error)
    }
    const isExistingUser = await prisma.users.findFirst({
        where: {
            username: parsedRequest.data.username
        }
    })
    if (isExistingUser) {
        throw new ApiError(400, "The username should be unique")
    }
    const hashedPassword = await Bun.password.hash(parsedRequest.data.password);
    const newUser = await prisma.users.create({
        data: {
            username: parsedRequest.data.username,
            password: hashedPassword
        }
    });
    return new ApiResponse(201, [], "The user creation is successfull")
})

export const login = asyncHandler(async (req: Request, res: Response) => {
    const parsedRequest = authRequest.safeParse(req.body);
    if (!parsedRequest.success) {
        throw new ApiError(400, "", parsedRequest.error);
    }
    const user = await prisma.users.findFirst({
        where: {
            username: parsedRequest.data.username
        }
    })
    if (!user) {
        throw new ApiError(400, "The user doesn't exists");
    }
    const isPasswordCorrect = await Bun.password.verify(parsedRequest.data.password, user.password);
    if (!isPasswordCorrect) {
        throw new ApiError(400, "The password is incorrect");
    }
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT Secret not found");
    }
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
        expiresIn: "1h"
    });
    return new ApiResponse(200, token);
})