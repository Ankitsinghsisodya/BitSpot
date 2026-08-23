import { SIDE, STATUS, TYPES } from "../../generated/prisma/enums";
import type { createOrderParams, creatFillsAndUpdateOrderParams } from "../types/order.types";
import { prisma } from "./db";

export function getOrderStatus(filledQty: number, qty: number): STATUS {
    if (filledQty === qty) return STATUS.FILLED;
    if (filledQty === 0) return STATUS.EMPTY;
    return STATUS.PARTIALLY;
}

export function toSideEnum(side: "buy" | "sell"): SIDE {
    if (side === 'buy') return SIDE.BUY;
    return SIDE.SELL;
}

export function toTypesEnum(type: "market" | "limit"): TYPES {
    if (type === "market")
        return TYPES.MARKET;
    return TYPES.LIMIT;
}

export async function createOrderInDb(params: createOrderParams) {
    const { userId, orderId, side, type, stockId, price, qty, filledQty } = params;
    await prisma.orders.create({
        data: {
            id: orderId,
            userId,
            side: toSideEnum(side),
            types: toTypesEnum(type),
            stockId,
            price,
            qty,
            filledQty,
            status: getOrderStatus(filledQty, qty)
        }
    })
}


export async function createFillsAndUpdateOrder(params: creatFillsAndUpdateOrderParams) {
    const { fillsForThisOrder, stockId } = params;
    for (const fill of fillsForThisOrder) {

        await prisma.fills.create({
            data: {
                stockId,
                price: fill.price,
                qty: fill.qty,
                buyOrderId: fill.buyOrderId,
                sellOrderId: fill.sellOrderId,
            }
        })

        await prisma.orders.updateMany({
            where: {
                OR: [{ id: fill.buyOrderId }, { id: fill.sellOrderId }]
            },
            data: {
                filledQty: { increment: fill.filledQty }
            }
        })
    }
}
