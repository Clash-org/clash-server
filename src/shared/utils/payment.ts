/**
 * Clash Server - Tournament Management System
 * Copyright (C) 2026 Clash Contributors
 *
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { getContract } from "./helpers";
import addresses from "../../../blockchain/addresses.json"
import ServerABI from "../../../blockchain/abi/ClashServer.json"

export async function isUserPay(userWallet: string) {
    const contract = getContract(addresses.Server, ServerABI)
    if (!userWallet)
    return Response.json({ error: "I need to send you a wallet" }, { status: 404 });
    const payment = await contract.getUserLastPayment(userWallet);
    if (payment) {
    if (payment.refunded || new Date(Number(payment.expiresAt) * 1000) < new Date()) {
        return Response.json({ error: "You need to pay for this month" }, { status: 404 });
    }
    } else {
        return Response.json({ error: "You haven't paid for the server" }, { status: 404 });
    }
}