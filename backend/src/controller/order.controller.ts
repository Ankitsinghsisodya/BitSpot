import type { Request, Response } from "express";
import asyncHandler from "../utilites/asynchandler";
import { prisma } from "../utilites/db";
import ApiResponse from "../utilites/ApiResponse";
import ApiError from "../utilites/ApiError";
import * as z from "zod";
import { untilWeGotBack } from "../utilites/untilWeGotBack";
import { orderRequest } from "../schemas/order.schema";
import { sendEngine } from "../utilites/sendEngine";
import { EngineRequest } from "../types/engine.types";
import type { returnedDataType } from "../types/order.types";
import { createFillsAndUpdateOrder, createOrderInDb } from "../utilites/orderHelpers";
import { queue_id } from "../constants";

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


export const deleteOrder = asyncHandler(async (req: Request, res: Response) => {

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

export const createOrder =  asyncHandler(async (req: Request, res: Response) => {
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

    sendEngine({ RequestType: EngineRequest.CREATEORDER, userId, type, price, qty, market_id, side, queue_id: queue_id, identifier });
    const returnedData: returnedDataType = await pendingResponse;

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