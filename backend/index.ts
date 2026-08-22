import express, { type NextFunction, type Request, type Response } from "express";
import { createClient } from "redis";
import * as z from 'zod';
import { queue_id, untilWeGotBack } from "./untilWeGotBack";
import { password } from "bun";
import { prisma } from "./db";
import jwt from "jsonwebtoken";
import { SIDE, STATUS, TYPES } from "./generated/prisma/enums";


const app = express();

app.use(express.json());

const publisherClient = await createClient()
    .on("error", err => console.log('Redis client error', err))
    .connect();

const authRequest = z.object({
    username: z.string().min(5).max(20),
    password: z.string().min(6).max(15)
})

app.post("/signup", async (req: Request, res: Response) => {
    try {
        const parsedRequest = authRequest.safeParse(req.body);
        if (!parsedRequest.success) {
            return res.status(400).json({
                success: false,
                errors: parsedRequest.error
            })
        }
        const isExistingUser = await prisma.users.findFirst({
            where: {
                username: parsedRequest.data.username
            }
        })
        if (isExistingUser) {
            return res.status(400).json({
                success: false,
                message: "The username should be unique"
            })
        }
        const hashedPassword = await Bun.password.hash(parsedRequest.data.password);
        const newUser = await prisma.users.create({
            data: {
                username: parsedRequest.data.username,
                password: hashedPassword
            }
        });
        return res.status(201).json({
            success: true,
            message: "The user creation is successful"
        })

    } catch (error) {
        return res.status(500).json({
            success: false,
            errors: error instanceof Error ? error.stack : error
        })
    }
})


app.post("/login", async (req: Request, res: Response) => {
    try {
        const parsedRequest = authRequest.safeParse(req.body);
        if (!parsedRequest.success) {
            return res.status(400).json({
                success: false,
                errors: parsedRequest.error
            })
        }
        const user = await prisma.users.findFirst({
            where: {
                username: parsedRequest.data.username
            }
        })
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "The user doesn't exists"
            })
        }
        const isPasswordCorrect = await Bun.password.verify(parsedRequest.data.password, user.password);
        if (!isPasswordCorrect) {
            return res.status(400).json({
                success: false,
                message: "The password is incorrect"
            })
        }
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT Secret not found");
        }
        const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
            expiresIn: "1h"
        });
        return res.status(201).json({
            success: true,
            token
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            errors: error instanceof Error ? error.stack : error
        })
    }
})


app.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                errors: "No token provided"
            })
        }
        const token = authHeader.split(" ")[1];
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "The user is not logged in"
            })
        }
        if (!process.env.JWT_SECRET) {
            throw new Error("JWT_SECRET is not available");
        }
        const decode = jwt.verify(token, process.env.JWT_SECRET);
        if (typeof decode === 'string') {
            return res.status(400).json({
                success: false,
                message: "The token is invalid"
            })
        }
        req.userId = decode.userId;
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            errors: error instanceof Error ? error.stack : error
        })
    }
})
/*
    body = {
        type:           "market" | "limit",
        price:          number | null,
        qty:            number,
        market_id:      string,
        side:           "buy" | "sell"
    }

    @returns {
        orderId: string,
        filledQty: number,
        averagePrice
    }
*/

// 50.01

// 500001
const orderRequest = z.object({
    type: z.enum(["market", "limit"]),
    price: z.number().optional(),
    qty: z.number(),
    market_id: z.string(),
    side: z.enum(["buy", "sell"])
})

export interface returnedDataType {
    filledQty: number,
    fills: fill[],
    orderId: number,
    totalPrice:number

}
interface fill {
    stocks: string,
    userId: number,
    qty: number,
    filledQty: number,
    orderId: number,
}

async function createOrderInDb(userId: number, type: "market" | "limit", price: number, qty: number, market_id: string, side: "buy" | "sell", orderId: number, fills: fill[], filledQty: number, stockId:number) {
 
    await prisma.orders.create({
        data: {
            id: orderId,
            userId,
            side: ((side=="buy")?SIDE.BUY:SIDE.SELL),
            types :(type==="market"?TYPES.MARKET:TYPES.LIMIT) ,
            stockId, //
            price, //
            qty,
            filledQty,
            status: ((filledQty === 0)?STATUS.EMPTY:(filledQty<qty?STATUS.PARTIALLY:STATUS.FILLED))
        }
    })
}

app.post("/order", async (req: Request, res: Response) => {
    try {
        const { userId } = req;
        const parsed = orderRequest.safeParse(req.body);

        if (!parsed.success) {
            return res.status(400).json({
                errors: parsed.error
            })
        }
        if(!userId){
            return res.status(400).json({
                success:false,
                message: "User is not logged in"
            })
        }
        const { type, price, qty, market_id, side } = parsed.data;
        const stock = await prisma.stocks.findFirst({
            where:{
                symbol: market_id
            }
           });
        if(!stock){
            return res.status(400).json({
                success:false,
                message: "The stocks is not valid"
            })
        }
        
        const stockId = stock.id;
        let identifier = Math.random();
        let pendingResponse = untilWeGotBack(identifier);
        await publisherClient.lPush("incoming-order",
            JSON.stringify({ userId, type, price, qty, market_id, side, queue_id: queue_id, identifier }));
        const returnedData: returnedDataType = await pendingResponse;

        const { filledQty, fills, orderId, totalPrice } = returnedData;

        res.status(201).json({
            success: true,
            filledQty,
            message: "order placed"
        })
        // create order in db
        createOrderInDb(userId, type, totalPrice, qty, market_id, side, orderId, fills, filledQty, stockId);
        // create fills

    } catch (error) {
        res.status(500).json({
            success: false,
            errors: error instanceof Error ? error.stack : error
        })
    }
})


app.delete("order/:orderId", (req: Request, res: Response) => {

})

app.get("/orders", (req: Request, res: Response) => {

})

app.get("/orderbook/:symbol", (req: Request, res: Response) => {

})

app.get("/fills/:symbol", (req: Request, res: Response) => {

})

app.get("/stocks", (req: Request, res: Response) => {

})

app.get("/balance", (req: Request, res: Response) => {

})

app.listen(3000, () => console.log(`Server is running on 3000`))