import type { Value } from "@prisma/client/runtime/client";
import { createClient } from "redis";
import type { returnedDataType } from "../types/order.types";
import { queue_id, QUEUE_NAMES } from "../constants";


const subscriberClient = await createClient()
    .on('error', err => console.log('Redis client Error', err))
    .connect()

const publisherClient = await createClient()
    .on('error', err => console.log('Redis Client Error', err))
    .connect();

interface pendingResolvesType {
    [key: number]: (value: returnedDataType) => void
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
        if (parsedResponse.identifier && pendingResolves[parsedResponse.identifier]) {
            const resolver = pendingResolves[parsedResponse.identifier];
            if (resolver)
                resolver({
                    error: parsedResponse.error,
                    totalPrice: parsedResponse.totalPrice,
                    filledQty: parsedResponse.filledQty,
                    fills: parsedResponse.fills,
                    orderId: parsedResponse.orderId
                }
                );
        }
    }
}

pollQueue();

export async function untilWeGotBack(identifier: number): Promise<returnedDataType> {
    return new Promise((resolve, reject) => {
        pendingResolves[identifier] = resolve;
    })
}