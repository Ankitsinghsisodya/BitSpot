import { BALANCES, ORDERBOOK } from "../state";
import { sendtoBackend } from "../redisClient";
import { APiError } from "../errors";
import type { orderRequestType, userDetailsType, cancelOrderDetailsType, orderItem } from "../types";
import { init, lockuserBalance, unlockBalance } from "./balance.service";
import { updateOrderBook, addInOrderBook } from "./orderbook.service";

export async function createOrder(orderDetails: orderRequestType) {
    // const parsedResponse: orderRequestType = JSON.parse(response.element);

    // error
    const error: APiError[] = [];

    // ask -> infinity
    // bid ->
    let { userId, type, price, qty, market_id, side, queue_id, identifier } = orderDetails;
    if (type === "market")
        price = (side === "ASK") ? -Infinity : Infinity;

    // orderId Generation
    const orderId = Number(Date.now() + crypto.randomUUID());
    init(userId);
    if (side === 'BID' && type === "limit") {
        if (price! * qty <= BALANCES[userId]!.available) {
            lockuserBalance(userId, price! * qty);
        }
        else {
            error.push(new APiError(403, "The available balance is not enough "))
        }
    }
    else if (side === "BID" && type === "market") {
        lockuserBalance(userId, BALANCES[userId]!.available);
    }

    // matching
    const { filledQty, totalPrice, fills } = updateOrderBook(userId, qty, price!, side, market_id)


    // orderbook me limit order dalna h if filletedQty < qty
    if (type === "limit" && filledQty < qty)
        addInOrderBook(userId, side, price!, qty, filledQty, market_id, orderId);

    if (side === "BID" && type === "market") {
        unlockBalance(userId);
    }

    await sendtoBackend(orderDetails.queue_id, {
        data: {
            identifier,
            error, filledQty, totalPrice, fills, orderId
        }
    })
}

export async function getBalanceForUsers(userDetails: userDetailsType) {
    const balances = BALANCES[userDetails.userId]
    await sendtoBackend(userDetails.queue_id, {
        data: {
            identifier: userDetails.identifier,
            balances
        }
    });
};

export function cancelOrder(cancelOrderDetails: cancelOrderDetailsType) {
    for (const [_, stocksDetails] of Object.entries(ORDERBOOK)) {
        for (const [_, OrderDetails] of Object.entries(stocksDetails)) {
            for (const [price, priceWiseOrderDetails] of OrderDetails) {

                priceWiseOrderDetails.orders = priceWiseOrderDetails.orders.filter((order: orderItem) => {
                    if (order.orderId === cancelOrderDetails.orderId) {
                        priceWiseOrderDetails.totalQuantity -= order.qty;
                    }
                    return (order.orderId === cancelOrderDetails.orderId)
                });

            }
        }
    }
    sendtoBackend(cancelOrderDetails.queue_id, {
        data: { identifier: cancelOrderDetails.identifier, success: true }
    })
};
