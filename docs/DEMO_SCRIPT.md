# Live Demonstration Script

## Preparation

1. Open the dApp at the local URL or the deployed frontend.
2. Have MetaMask set to Sepolia.
3. Confirm that the dashboard shows Treasury balance `0.009 ETH`, Vendor
   inventory `999,900 SVT`, and threshold `2 of 3`.
4. Keep the Etherscan contract page open as a fallback for network problems.

## Two-minute flow

1. Show the rate: `0.0001 ETH` per SVT.
2. Enter `0.01 ETH`.
3. Point out the quote: `100 SVT`; minimum received is `99.5 SVT`.
4. Execute the purchase.
5. Show the buyer balance increase and Treasury balance update.
6. Open the purchase transaction on Etherscan.
7. Scroll to Recent Proposals and show proposal `#0`.
8. Explain that the submitter counts as the first confirmation.
9. Use owner 2 to confirm.
10. Execute after two confirmations.
11. Show the recipient balance and the `executed` proposal state.
12. Open one verified contract and show the source, constructor arguments, and
    ABI.

## Q&A preparation

### Why not let the seller receive ETH and forward it?

That creates a single point of failure and a custody window. SafeVendor forwards
ETH to Treasury in the purchase transaction.

### Why 2-of-3?

It tolerates one unavailable owner while preventing one compromised owner from
moving funds. The trade-off is that two unavailable owners halt execution.

### Why immutable?

Immutability removes upgrade, pause, owner replacement, and threshold-change
backdoors. The cost is that a logic defect requires redeployment.

### Why use a low-level call?

Treasury owners may need to call contract wallets or contracts with calldata.
The success flag is checked and execution is protected against reentrancy.

### What happens if the price does not divide evenly?

The vendor calculates a whole token-unit amount and refunds the remainder. If
the refund fails, the purchase reverts.

### Where is the novelty?

The design combines a token vendor with direct multisig settlement. The sale
contract cannot accumulate proceeds, and the treasury cannot be administered by
one privileged account.

### What are the main limitations?

- Sepolia-only demonstration.
- No dynamic owner management.
- No upgrade or pause path.
- No oracle; the fixed price does not track market value.
- The dApp is operational evidence, not a production wallet interface.
