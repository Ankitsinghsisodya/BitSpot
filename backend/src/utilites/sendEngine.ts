import { createClient } from "redis";

const publisherClient = await createClient()
    .on("error", err => console.log('Redis client error', err))
    .connect();

export async function sendEngine(params: { identifier: number, [key: string]: any }) {
    await publisherClient.lPush('incoming-order', JSON.stringify(params));
}