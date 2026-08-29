import type { Request, Response } from "express";
import asyncHandler from "../utilites/asynchandler";
import { prisma } from "../utilites/db";
import ApiResponse from "../utilites/ApiResponse";
import ApiError from "../utilites/ApiError";
import * as z from "zod";
import { untilWeGotBack } from "../utilites/untilWeGotBack";
import { orderRequest } from "../schemas/order.schema";
import { sendEngine } from "../utilites/sendEngine";
import type { cancelOrderResponse, returnedCreateOrderDataType, UserBalance } from "../types/order.types";
import { createFillsAndUpdateOrder, createOrderInDb } from "../utilites/orderHelpers";
import { queue_id } from "../constants";
import { STATUS } from "../../generated/prisma/enums";

export const getFillForSymbol = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req;
    const symbol = req.params.symbol;
    if (!symbol) {
        throw new ApiError(400, "The symbol is required");
    }
    const stock = await prisma.stocks.findFirst({
        where: {
            symbol: symbol as string
        }
    })
    if (!stock) {
        throw new ApiError(400, "the symbol is not valid");
    }
    const fills = await prisma.fills.findMany({
        where: {
            OR: [
                { buyOrder: { userId } },
                { sellOrder: { userId } }
            ],
            stockId: stock.id

        }
    })
    return new ApiResponse(200, fills);
})

// send the message to the engine to delete the order and marks the status of the order to be cancelled in db
// and also send some error object to the engine to know if the deletion in orderbook is successful or not
export const cancelOrder = asyncHandler(async (req: Request, res: Response) => {
    const orderId = req.params.id;
    if (!orderId || typeof orderId !== "number") {
        throw new ApiError(400, "The orderId is not valid")
    }
    let identifier = Math.random();
    let pendingResponse = untilWeGotBack(identifier);
    sendEngine({
        identifier,
        requestType: "cancelOrder",
        "cancelOrderDetails": {
            orderId,
            queue_id
        }
    })
    const response: cancelOrderResponse = await pendingResponse;
    if (response.error && response.error.length > 0) {
        // [new APiError(500, "Internal engine while processing order")]
        throw new ApiError(500, "Internal engine error", response.error);

    }
    if (response.success) {
        await prisma.orders.update({
            where: {
                id: orderId
            },
            data: {
                status: STATUS.CANCELLED
            }
        })
        return new ApiResponse(201, [], "The order is successfully deleted");
    }
    throw new ApiError(500, "The order is not successfully cancelled")
})

/*
    body = {
        type:           "market" | "limit",
        price:          number | null,
        qty:            number,
        market_id:      string,
        side:           "buy" | "sell"
    }

    @returns {
        orderId: string,
        filledQty: number,
        averagePrice
    }
*/

// 50.01

// 500001
// update order to be cancelled in db and delete from orderbook

export const createOrder = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req;
    const parsed = orderRequest.safeParse(req.body);

    if (!parsed.success) {
        throw new ApiError(400, "", [z.treeifyError(parsed.error)]);
    }
    if (!userId) {
        throw new ApiError(400, "User is not logged in");
    }
    const { type, price, qty, market_id, side } = parsed.data;
    const stock = await prisma.stocks.findFirst({
        where: {
            symbol: market_id
        }
    });
    if (!stock) {
        throw new ApiError(400, "The stocks is not valid");
    }

    const stockId = stock.id;
    let identifier = Math.random();
    let pendingResponse = untilWeGotBack(identifier);

    sendEngine({
        requestType: "createOrder",
        identifier,
        orderDetails:
            { userId, type, price, qty, market_id, side, queue_id: queue_id, identifier }
    });
    const returnedData: returnedCreateOrderDataType = await pendingResponse;
    if (returnedData.error && returnedData.error.length > 0) {
        // [new APiError(500, "Internal engine while processing order")]
        throw new ApiError(500, "Internal engine error", returnedData.error);

    }
    const { filledQty, fills, orderId, totalPrice, error } = returnedData;

    // create order in db
    await createOrderInDb({
        userId,
        orderId,
        side,
        type,
        stockId,
        price,
        qty,
        filledQty
    });
    // create fills and update order
    await createFillsAndUpdateOrder({
        fillsForThisOrder: fills,
        stockId
    })
    return new ApiResponse(201, filledQty, "Order placed");
});


export const getOrder = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req;
    const orders = await prisma.orders.findMany({
        where: {
            userId
        }
    });
    return res.status(201).json({
        success: true,
        orders
    })
});



export const getBalance = asyncHandler(async (req: Request, res: Response) => {
    const identifier = Math.random();
    let pendingResponse = untilWeGotBack(identifier);
    sendEngine({
        identifier,
        requestType: "getBalance",
        "userDetails": {
            userId: req.userId,
            queue_id
        }
    })
    const response: UserBalance = await pendingResponse;
    if (response.error && response.error.length > 0) {
        // [new APiError(500, "Internal engine while processing order")]
        throw new ApiError(500, "Internal engine error", response.error);

    }
    const balance = response.balances;
    return new ApiResponse(201, balance);

})