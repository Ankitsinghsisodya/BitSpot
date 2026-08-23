import Router from "express"
import { createOrder, deleteOrder, getFillForSymbol } from "../controller/order.controller";

const router = Router();

router.get("/stocks",);
router.get("/balance",);
router.get("/orders",);
router.get("/orderbook/:symbol",);
router.get("/fills/:symbol", getFillForSymbol);
router.delete("order/:orderId", deleteOrder);
router.post("/order", createOrder);


export default router