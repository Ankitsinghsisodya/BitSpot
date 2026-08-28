import { createClient } from "redis";

export const subscriberClient = await createClient()
    .on("error", err => console.log('Redis Client Error', err))
    .connect();

export const publisherClient = await createClient()
    .on("error", err => console.log('Redis Client Error', err))
    .connect();

export async function sendtoBackend(queue_id: number, params: { data: { identifier: number, [key: string]: any } }) {
    await publisherClient.lPush("Response-queue" + queue_id, JSON.stringify(params.data));
}
