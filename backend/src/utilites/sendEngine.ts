import { createClient } from "redis";
import { QUEUE_NAMES } from "../constants";

const publisherClient = await createClient()
    .on("error", err => console.log('Redis client error', err))
    .connect();

export async function sendEngine(params: { identifier: number, [key: string]: any }) {
    await publisherClient.lPush(QUEUE_NAMES.INCOMING_ORDER, JSON.stringify(params));
}