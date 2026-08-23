export const EngineRequest = Object.freeze({
    CREATEORDER:     "createOrder",
    DELETEORDER:     "deleteOrder",
    GETORDER:        "getOrder",
    ORDERBOOKSYMBOL: "orderbookSymbol",
    GETSTOCKS:       "getStocks",
    GETBALANCE:      "getBalance"
});
export const QUEUE_NAMES = {
    INCOMING_ORDER:  "incoming-order",
    RESPONSE_QUEUE:  "Response-queue"
};
export const queue_id = Math.random();