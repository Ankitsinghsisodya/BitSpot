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

export interface returnedDataType {
    error: ApiError,
    filledQty: number,
    fills: fill[],
    orderId: number,
    totalPrice: number

}

export interface createOrderParams {
    userId: number,
    orderId: number,
    side: "buy" | "sell",
    type: "market" | "limit",
    stockId: number,
    price: number | undefined,
    qty: number,
    filledQty: number,
}