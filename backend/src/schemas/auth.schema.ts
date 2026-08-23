import * as z from "zod";

const authRequest = z.object({
    username: z.string().min(5).max(20),
    password: z.string().min(6).max(15)
})