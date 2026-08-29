import { z } from "zod";

export interface balancesTypes {
    [userId: number]: UserBalance
}

export interface UserBalance {
    available: number,
    locked: number
}

/*
    ORDERBOOK = {
        price: {
            totalQuantity: number,
            orders: [
                {
                    userId: number,
                    qty: number,
                    filledQty: number,
                    orderId : number,
                    createdAt: time
                }
            ]
        }
    }
*/
export interface orderItem {
    userId: number,
    qty: number,
    filledQty: number,
    orderId: number,
    createdAt: number
}
export interface priceItem {
    totalQuantity: number,
    orders: orderItem[]
}
export interface stockOrderBook {
    ASK: Map<number, priceItem>,
    BID: Map<number, priceItem>
}
export interface orderbookType {
    [symbol: string]: stockOrderBook
}

/*
    body = {
        type:           "market" | "limit",
        price:          number | null,
        qty:            number,
        market_id:      string,
        side:           "ASK" | "BID"
    }

    @returns {
        orderId: string,
        filledQty: number,
        averagePrice
    }
*/

export const orderRequest = z.object({
    identifier: z.number(),
    userId: z.number(),
    type: z.enum(["market", "limit"]),
    price: z.number().optional(),
    qty: z.number(),
    market_id: z.string(),
    side: z.enum(["ASK", "BID"]),
    identifer: z.number(),
    queue_id: z.number()
});
export type orderRequestType = z.infer<typeof orderRequest>

// consume other elements
// bids -> ask
// ask -> bid
/*
    market order -> [solved h]
    limit order -> []
        ask -> {price}
        bid -> {}
    filltedQty, [kitna khaya]
    [kitna khaya] -> db store kr denge [fills and order table]
    totalQty-filledQty  ==> order table me store krna h

    // what is the value jisse chota lena h
    // what is the value jisse bada lena h
    ASK -> increasing
    BID -> Decreasing me rkhege
*/
// filltedQty, fills[{}]
export interface returnUpdateOrderBook {
    filledQty: number,
    totalPrice: number,
    fills: fill[]
}
export interface fill {
    stocks: string,
    buyOrderId: number,
    sellOrderId: number,
    qty: number,
    filledQty: number,
    orderId: number,
    price: number
}

export interface userIdDetailsForFills {
    buyOrderId: number,
    sellOrderId: number
}

export interface errorType {
    status: number,
    message: string
}

export interface userDetailsType {
    userId: number,
    queue_id: number,
    identifier: number
}

export interface cancelOrderDetailsType {
    orderId: number,
    queue_id: number,
    identifier: number
}
