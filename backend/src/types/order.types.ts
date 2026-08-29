import type ApiError from "../utilites/ApiError"
export interface creatFillsAndUpdateOrderParams {
    fillsForThisOrder: fill[],
    stockId: number
};

export interface fill {
    stocks: string,
    buyOrderId: number,
    sellOrderId: number,
    qty: number,
    filledQty: number,
    orderId: number,
    price: number
}

export interface returnedCreateOrderDataType {
    identifier: number,
    error?: [ApiError],
    filledQty: number,
    fills: fill[],
    orderId: number,
    totalPrice: number
}

export interface createOrderParams {
    userId: number,
    orderId: number,
    side: "ASK" | "BID",
    type: "market" | "limit",
    stockId: number,
    price: number | undefined,
    qty: number,
    filledQty: number,
}

export interface UserBalance {
    error?: [ApiError],
    balances:
    {
        available: number,
        locked: number
    }
}

export interface cancelOrderResponse {
    error?: [ApiError],
    success:boolean
}