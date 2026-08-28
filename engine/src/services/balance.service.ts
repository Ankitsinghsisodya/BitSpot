import { BALANCES } from "../state";

export function getBalanceForUser(userId: number): number {
    if (!BALANCES[userId]) BALANCES[userId] = { available: 0, locked: 0 };
    return BALANCES[userId]["available"] - BALANCES[userId]["locked"];
}
export function init(userId: number) {
    if (!BALANCES[userId]) BALANCES[userId] = { available: 0, locked: 0 };
}
export function lockuserBalance(userId: number, balance: number): void {

    BALANCES[userId]!.locked += balance;
    BALANCES[userId]!.available -= balance;
}
export function unlockBalance(userId: number) {
    BALANCES[userId]!.available += BALANCES[userId]!.locked;
    BALANCES[userId]!.locked = 0;
}
