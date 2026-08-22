import { createClient } from "redis";
import { z } from "zod";

const BALANCES: balancesTypes = {}
interface balancesTypes {
    [userId: number]: UserBalance
}
interface UserBalance {
    usd: number,
    stocks: { [symbol: string]: number }
}
const ORDERBOOK: orderbookType = {
    SOL: {
        ASK: new Map(),
        BID: new Map()
    },
    BTC: {
        ASK: new Map(),
        BID: new Map()
    }
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
interface orderItem {
    userId: number,
    qty: number,
    filledQty: number,
    orderId: number,
    createdAt: number
}
interface priceItem {
    totalQuantity: number,
    orders: orderItem[]
}
interface stockOrderBook {
    ASK: Map<number, priceItem>,
    BID: Map<number, priceItem>
}
interface orderbookType {
    [symbol: string]: stockOrderBook
}
const subscriberClient = await createClient()
    .on("error", err => console.log('Redis Client Error', err))
    .connect();

const publisherClient = await createClient()
    .on("error", err => console.log('Redis Client Error', err))
    .connect();

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

const orderRequest = z.object({
    userId: z.number(),
    type: z.enum(["market", "limit"]),
    price: z.number().optional(),
    qty: z.number(),
    market_id: z.string(),
    side: z.enum(["ASK", "BID"]),
    identifer: z.number(),
    queue_id: z.number()
});
type orderRequestType = z.infer<typeof orderRequest>

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
interface returnUpdateOrderBook {
    filledQty: number,
    totalPrice: number,
    fills: fill[]
}
interface fill {
    stocks: string,
    buyOrderId: number,
    sellOrderId:number,
    qty: number,
    filledQty: number,
    orderId: number,
    price:number
}
function rev(side: "ASK" | "BID"): "ASK" | "BID" {
    return (side === "ASK") ? "BID" : "ASK";
}
function getSide(market_id: string, side: "ASK" | "BID") {
    const market = ORDERBOOK[market_id] ?? { ASK: new Map(), BID: new Map() };
    return market[side];
}
interface userIdDetailsForFills {
    buyOrderId: number,
    sellOrderId:number
}
function userIdDetails(userId:number, userSittingOnOrderBookId:number, side:"ASK"|"BID"):userIdDetailsForFills{
    if(side === "ASK"){
        return {
            buyOrderId  : userSittingOnOrderBookId,
            sellOrderId : userId
        }
    }
    else {
        return {
            buyOrderId: userId,
            sellOrderId: userSittingOnOrderBookId
        }
    }
}

function getPriceForFill(side: "ASK"|"BID", priceForUser:number, priceForUserOnOrderbook:number):number {
    if(side === "ASK"){
        Math.max(priceForUser, priceForUserOnOrderbook);
    }
    return Math.min(priceForUser, priceForUserOnOrderbook);

}
function updateOrderBook(userId:number, qty: number, price: number, side: "ASK" | "BID", market_id: string): returnUpdateOrderBook {

    const temp = getSide(market_id, rev(side));
    let filledQty: number = 0;
    let fills: fill[] = [];
    let totalPrice = 0;
    // >> price se jada wala me le lenge
    for (const [pricePerItem, DetailOfItem] of temp.entries()) {
        // x, x-1, x-2
        if (side === "ASK" && Number(pricePerItem) < price) break;
        // x, x+1, x+2
        if (side === "BID" && Number(pricePerItem) > price) break;
        const totalQuantity = DetailOfItem.totalQuantity;
        const orders = DetailOfItem.orders;
        let qtyConsumed = 0;
        for (const orderItem of orders) {
            if (qty >= filledQty + orderItem.qty) {
                fills.push({
                    ...userIdDetails(userId, orderItem.userId, side),
                    stocks: market_id,
                    qty: orderItem.qty,
                    filledQty: orderItem.qty,
                    orderId: orderItem.orderid,
                    price:getPriceForFill(side, price, orderItem.price)
                })
                filledQty += orderItem.qty;
                totalPrice += orderItem.qty * Number(pricePerItem);
                qtyConsumed += orderItem.qty;
            }
            else {
                fills.push({
                    ...userIdDetails(userId, orderItem.userId, side),
                    stocks: market_id,
                    qty: orderItem.qty,
                    filledQty: orderItem.filledQty + (qty - filledQty),
                    orderId: orderItem.orderid,
                    price:getPriceForFill(side, price, orderItem.price)
                });
                orderItem.filledQty = orderItem.filledQty + (qty - filledQty);
                qtyConsumed += qty - filledQty;
                totalPrice += (qty - filledQty) * Number(pricePerItem);
                filledQty = qty;
            }
        }
        DetailOfItem.totalQuantity -= qtyConsumed;
        DetailOfItem.orders = DetailOfItem.orders.filter((order: orderItem) => order.filledQty < order.qty);
        if (DetailOfItem.orders.length === 0) {
            temp.delete(pricePerItem)
        }
    }
    return { filledQty, totalPrice, fills };
}
// ASK -> increasing order me h
// BID -> Decreasing order me h
function addInOrderBook(userId: number, side: "ASK" | "BID", price: number, qty: number, filledQty:number, market_id: string, orderId:number) {
    const market = getSide(market_id, side);
    if(!market.has(price)){
        market.set(price,{totalQuantity:0,ordres:[]});
    }
    const priceLevel = market.get(price);
    priceLevel.totalQuantity += qty;
    priceLevel.orders.push({
        userId,
        qty,
        filledQty,
        orderId,
        createdAt:Date.now()
    })
}
while (true) {
    const response = await subscriberClient.brPop('incoming-order', 1);
    if (!response) {
        continue;
    }
    const parsedResponse: orderRequestType = JSON.parse(response.element);

    // ask -> infinity
    // bid ->
    let { userId, type, price, qty, market_id, side, queue_id, identifer } = parsedResponse;
    if (type === "market")
        price = (side === "ASK") ? -Infinity : Infinity;

    // matching
    const { filledQty, totalPrice, fills } = updateOrderBook(userId, qty, price!, side, market_id)

    // orderId Generation
    const orderId = Number(Date.now() + crypto.randomUUID());

    // orderbook me limit order dalna h if filletedQty < qty
    if (type === "limit" && filledQty < qty)
        addInOrderBook(userId, side, price!, qty, filledQty, market_id, orderId);

    // sending it back to the backend
    await publisherClient.lPush("Response-queue" + parsedResponse.queue_id, JSON.stringify({
        filledQty, totalPrice, fills, identifer, orderId
    }))
}


