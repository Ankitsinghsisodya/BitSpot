import { BALANCES, ORDERBOOK } from "../state";
import type { returnUpdateOrderBook, fill, userIdDetailsForFills, orderItem, priceItem } from "../types";

function rev(side: "ASK" | "BID"): "ASK" | "BID" {
    return (side === "ASK") ? "BID" : "ASK";
}
export function getSide(market_id: string, side: "ASK" | "BID") {
    const market = ORDERBOOK[market_id] ?? { ASK: new Map(), BID: new Map() };
    return market[side];
}
function userIdDetails(userId: number, userSittingOnOrderBookId: number, side: "ASK" | "BID"): userIdDetailsForFills {
    if (side === "ASK") {
        return {
            buyOrderId: userSittingOnOrderBookId,
            sellOrderId: userId
        }
    }
    else {
        return {
            buyOrderId: userId,
            sellOrderId: userSittingOnOrderBookId
        }
    }
}

function getPriceForFill(side: "ASK" | "BID", priceForUser: number, priceForUserOnOrderbook: number): number {
    if (side === "ASK") {
        return Math.max(priceForUser, priceForUserOnOrderbook);
    }
    return Math.min(priceForUser, priceForUserOnOrderbook);

}
export function updateOrderBook(userId: number, qty: number, price: number, side: "ASK" | "BID", market_id: string): returnUpdateOrderBook {

    const temp = getSide(market_id, rev(side));
    let filledQty: number = 0;
    let fills: fill[] = [];
    let totalPrice = 0;
    // >> price se jada wala me le lenge
    const sortedEntries: [number, priceItem][] = [...temp.entries()].sort(([a], [b]) => ((side === "ASK") ? a - b : b - a));
    for (const [pricePerItem, DetailOfItem] of sortedEntries) {
        // x, x-1, x-2
        if (side === "ASK" && Number(pricePerItem) < price) break;
        // x, x+1, x+2
        if (side === "BID" && Number(pricePerItem) > price) break;
        const totalQuantity = DetailOfItem.totalQuantity;
        const orders = DetailOfItem.orders;
        let qtyConsumed = 0;
        for (const orderItem of orders) {
            const cost = getPriceForFill(side, price, pricePerItem);

            if (side === "ASK" || cost <= BALANCES[userId]!.locked) {
                const affordableByBalance = side === "BID"
                    ? Math.floor(BALANCES[userId]!.locked / cost)
                    : Infinity;
                const qtytaken = Math.min(orderItem.qty - orderItem.filledQty, affordableByBalance, qty - filledQty);
                if (qtytaken <= 0) continue; // or break, since balance won't recover mid-loop
                fills.push({
                    ...userIdDetails(userId, orderItem.userId, side),
                    stocks: market_id,
                    qty: qtytaken,
                    filledQty: orderItem.filledQty + qtytaken,
                    orderId: orderItem.orderId,
                    price: cost
                });
                orderItem.filledQty = orderItem.filledQty + qtytaken;
                qtyConsumed += qtytaken;
                totalPrice += qtytaken * cost;
                filledQty += qtytaken;
                if (side === "BID") {
                    BALANCES[userId]!.locked -= qtytaken * cost; // also: reuse `cost`, no need to recompute getPriceForFill
                    BALANCES[orderItem.userId]!.available += qtytaken*cost;
                }
                else {
                    BALANCES[userId]!.locked += qtytaken * cost; // also: reuse `cost`, no need to recompute getPriceForFill
                    BALANCES[orderItem.userId]!.available -= qtytaken*cost;
                }
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
export function addInOrderBook(userId: number, side: "ASK" | "BID", price: number, qty: number, filledQty: number, market_id: string, orderId: number) {
    const market = getSide(market_id, side);
    if (!market.has(price)) {
        market.set(price, { totalQuantity: 0, orders: [] });
    }
    const priceLevel = market.get(price);
    priceLevel.totalQuantity += qty;
    priceLevel.orders.push({
        userId,
        qty,
        filledQty,
        orderId,
        createdAt: Date.now()
    })
}
