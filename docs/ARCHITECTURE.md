# SafeVendor Architecture

## Actors

| Actor | Capability |
|---|---|
| Buyer | Calls `buyTokens`, pays ETH, receives SVT |
| Treasury owner | Submits, confirms, and executes treasury transactions |
| Seller | Provides SVT inventory to the vendor |
| Deployer | Deploys contracts and transfers inventory; no privileged sale function |

## On-chain and off-chain boundary

The chain stores token balances, sale payments, treasury ownership, confirmations,
and execution state. The optional dApp reads this state and prepares transactions,
but it cannot bypass contract access control.

## Sale flow

1. The seller transfers SVT inventory to `TokenVendor`.
2. A buyer calls `buyTokens(minTokensOut)` with ETH.
3. The vendor calculates the token amount from the fixed `pricePerToken`.
4. Sale proceeds go directly to `MultiSigTreasury`; any rounding remainder is
   refunded to the buyer.
5. The vendor transfers SVT to the buyer.
6. The sale transaction emits `TokensPurchased`.

## Treasury flow

1. A treasury owner submits a transaction and automatically confirms it.
2. A second owner confirms.
3. Any owner executes after the 2-of-3 threshold is met.
4. Execution marks the transaction before the external call and is protected by
   `ReentrancyGuard`.

## Design choices

- Fixed-supply ERC-20: no post-deployment mint authority.
- Direct treasury settlement: the seller never controls the sale proceeds.
- Immutable owners and threshold: simpler security model and no admin upgrade path.
- Low-level `call` with checked return values: compatible with contract wallets.
- No pause: the contracts remain operational without a privileged pause key.

## Trust assumptions

- At least two of the three treasury owners remain independent and available.
- The treasury is funded only with Sepolia ETH in this assignment.
- The deployment account supplies the entire token inventory and retains no
  administrative control over the token or vendor.
