import { subscriberClient } from "./src/redisClient";
import { createOrder, getBalanceForUsers, cancelOrder } from "./src/services/order.service";

while (true) {
    const response = await subscriberClient.brPop('incoming-request', 1); // change the queue name
    if (!response) {
        continue;
    }
    const parsedResponse = JSON.parse(response.element);

    switch (parsedResponse.requestType) {
        case "createOrder":
            await createOrder(parsedResponse.orderDetails);
            break;
        case "getBalance":
            getBalanceForUsers(parsedResponse.userDetails);
            break;
        case "cancelOrder":
            cancelOrder(parsedResponse.cancelOrderDetails);
            break;
        default:
            break;
    }

}
