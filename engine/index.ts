import { APiError } from "./src/errors";
import { sendtoBackend, subscriberClient } from "./src/redisClient";
import { createOrder, getBalanceForUsers, cancelOrder } from "./src/services/order.service";

while (true) {
    const response = await subscriberClient.brPop('incoming-request', 1); // change the queue name
    if (!response) {
        continue;
    }
    let parsedResponse;
    try {
        parsedResponse = JSON.parse(response.element);
    } catch (error) {
        console.error("Failed to parse message from the quue, dropping it:", error, response.element);
        continue;
    }

    try {
        switch (parsedResponse.requestType) {
            case "createOrder":
                await createOrder(parsedResponse.orderDetails);
                break;
            case "getBalance":
                await getBalanceForUsers(parsedResponse.userDetails);
                break;
            case "cancelOrder":
                await cancelOrder(parsedResponse.cancelOrderDetails);
                break;
            default:
                break;
        }
    } catch (error) {
        console.error("Error handling request:", parsedResponse.requestType, error);
        const queue_id = parsedResponse.orderDetails?.queue_id
            ?? parsedResponse.cancelOrderDetails?.queue_id
            ?? parsedResponse.userDetails?.queue_id;
        sendtoBackend(queue_id, {
            data: {
                identifier: parsedResponse.identifier,
                error: [new APiError(500, "Internal engine while processing order")]
            }
        }).catch(err => console.error("Failed to notify backend of error:", err));
    }

}
