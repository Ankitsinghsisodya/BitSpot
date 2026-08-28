import { createClient } from "redis";

export const subscriberClient = await createClient()
    .on("error", err => console.log('Redis Client Error', err))
    .connect();

export const publisherClient = await createClient()
    .on("error", err => console.log('Redis Client Error', err))
    .connect();
