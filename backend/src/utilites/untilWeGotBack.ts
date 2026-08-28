import { createClient } from "redis";
import { queue_id, QUEUE_NAMES } from "../constants";


const subscriberClient = await createClient()
    .on('error', err => console.log('Redis client Error', err))
    .connect()

const publisherClient = await createClient()
    .on('error', err => console.log('Redis Client Error', err))
    .connect();

interface pendingResolvesType {
    [key: number]: (value: any) => void
}
let pendingResolves: pendingResolvesType = {
};



async function pollQueue() {
    const response = await subscriberClient.brPop(QUEUE_NAMES.RESPONSE_QUEUE + queue_id, 1)
    if (!response) {
        pollQueue();
    }
    else {
        const parsedResponse = JSON.parse(response.element);
        if (parsedResponse.data.identifier && pendingResolves[parsedResponse.data.identifier]) {
            const resolver = pendingResolves[parsedResponse.identifier];
            if (resolver)
                resolver(
                    parsedResponse.data
                );
        }
    }
}

pollQueue();

export async function untilWeGotBack(identifier: number): Promise<any> {
    return new Promise((resolve, reject) => {
        pendingResolves[identifier] = resolve;
    })
}