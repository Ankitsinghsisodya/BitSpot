import express from "express";
import * as z from 'zod';
import { errorHandlingMiddleware } from "./src/middleware/error.middleware";
import { authMiddlware } from "./src/middleware/auth.middleware";
import orderRouter from "./src/routes/order.route"
import authRouter from "./src/routes/auth.route"


const app = express();

app.use(express.json());

app.use(authRouter);
app.use(authMiddlware);
app.use(orderRouter);
app.use(errorHandlingMiddleware);
app.listen(3000, () => console.log(`Server is running on 3000`))
