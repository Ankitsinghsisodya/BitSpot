import { createClient } from "redis";
const BALANCES : balancesTypes = {}
interface balancesTypes {
    [userId: number] : UserBalance
}
interface UserBalance{
    usd: number,
    stocks: {[symbol:string] : number}
}
const ORDERBOOK = {
    SOL: {
        ASK:{},
        BID:{}
    },
    BTC: {
        ASK:{},
        BID:{}
    }
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

while (true) {
    const response = await subscriberClient.brPop('incoming-order', 1);
    if (!response) {
        continue;
    }
    const parsedResponse = JSON.parse(response.element);
    const { type, price, qty, market_id, side, queue_id: queue_id, identifier } = parsedResponse;
    const filledQty = 0;
    await publisherClient.lPush("Response-queue" + parsedResponse.queue_id, JSON.stringify({
        filledQty, identifier
    }))
}


