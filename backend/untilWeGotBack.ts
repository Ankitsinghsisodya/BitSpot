import type { Value } from "@prisma/client/runtime/client";
import { createClient } from "redis";
import type { returnedDataType } from ".";

const subscriberClient = await createClient()
.on('error', err => console.log('Redis client Error', err))
.connect()

interface pendingResolvesType {
    [key:number]: (value:returnedDataType) => void
}
let pendingResolves: pendingResolvesType = {
};

export const queue_id = Math.random();

async function pollQueue(){
    const response = await subscriberClient.brPop("Response-queue" + queue_id, 1)
    if(!response){
        pollQueue();
    }
    else {
        const parsedResponse = JSON.parse(response.element);
        if(parsedResponse && parsedResponse.identifier && pendingResolves[parsedResponse.identifier] && parsedResponse.filledQty)
        {
            const resolver = pendingResolves[parsedResponse.identifier];
            if(resolver)
            resolver(parsedResponse.filledQty);

        }
    }
}

pollQueue();

export async function untilWeGotBack(identifier: number):Promise<returnedDataType>{
    return new Promise((resolve, reject)=> {
        pendingResolves[identifier] =  resolve;
    })
}