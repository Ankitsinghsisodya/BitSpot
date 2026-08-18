import express, { type Request, type Response } from "express";


const app = express();

app.use(express.json());

const BALANCES = {}
const ORDERBOOK = {

}

app.post("/signup", (req: Request, res: Response) => {

})

app.post("/login", (req:Request, res: Response) => {

})

app.post("/order", (req:Request, res:Response) => {

})

app.delete("order/:orderId", (req:Request, res:Response) => {

})

app.get("/orders", (req : Request, res:Response) => {

})

app.get("/orderbook/:symbol", (req:Request, res:Response) => {

})

app.get("/fills/:symbol", (req:Request, res:Response) => {

})

app.get("/stocks", (req:Request, res:Response) => {

})

app.get("/balance", (req:Request, res:Response) => {

})

app.listen(3000, () => console.log(`Server is running on 3000`))