import type { balancesTypes, orderbookType } from "./types";

export const BALANCES: balancesTypes = {}

export const ORDERBOOK: orderbookType = {
    SOL: {
        ASK: new Map(),
        BID: new Map()
    },
    BTC: {
        ASK: new Map(),
        BID: new Map()
    }
}
