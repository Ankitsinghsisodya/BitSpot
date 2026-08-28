import Router from "express"
import { cancelOrder, createOrder, getBalance, getFillForSymbol, getOrder } from "../controller/order.controller";

const router = Router();

// db
router.get("/orders",getOrder); 
router.get("/fills/:symbol", getFillForSymbol);


router.post("/order", createOrder);
router.get("/balance", getBalance); // orderbook
router.delete("order/:orderId", cancelOrder);


export default router