import { createClient } from "redis";
const BALANCES = {}
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

while (true) {
    const response = await subscriberClient.brPop('incoming-order', 1);
    if (!response) {
        continue;
    }
    const parsedResponse = JSON.parse(response.element);

    const filledQty = 10;
    const identifier = parsedResponse.identifier;
    await publisherClient.lPush("Response-queue" + parsedResponse.queue_id, JSON.stringify({
        filledQty, identifier
    }))
}



