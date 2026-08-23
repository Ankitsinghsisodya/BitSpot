import * as z from "zod";

export const orderRequest = z.object({
    type: z.enum(["market", "limit"]),
    price: z.number().optional(),
    qty: z.number(),
    market_id: z.string(),
    side: z.enum(["buy", "sell"])
})