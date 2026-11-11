# Security Analysis

## Scope

The production scope is:

- `contracts/SafeVendorToken.sol`
- `contracts/MultiSigTreasury.sol`
- `contracts/TokenVendor.sol`

`contracts/test/ReentrantReceiver.sol` is a test helper and is not deployed.
OpenZeppelin dependency findings are excluded from the project-specific scan.

## Threat model

### T1: Single-owner exfiltration

The vendor does not keep sale proceeds and has no seller withdrawal function.
ETH moves to a treasury that requires two distinct owner confirmations. A
compromised owner cannot move funds alone.

Residual risk: two compromised owners can collude. The 2-of-3 model assumes at
least two independent key holders.

### T2: Reentrancy

`TokenVendor.buyTokens` uses `nonReentrant`. `MultiSigTreasury.executeTransaction`
sets `executed = true` before the external call and also uses `nonReentrant`.
The test helper attempts to re-enter the same treasury transaction and confirms
that it is rejected.

### T3: Duplicate confirmation

`isConfirmed[transactionId][owner]` prevents one owner from counting twice.
Submitting a transaction automatically records exactly one confirmation.

### T4: Unauthorized action

Only configured owners can submit, confirm, or execute treasury transactions.
The owner set and threshold have no post-deployment setter.

### T5: Replay or repeated execution

`executed` is checked before execution and set before the call. A replay reverts.
If the call itself fails, the complete transaction reverts, including the
`executed` update.

### T6: Payment and inventory errors

The vendor:

- rejects zero payments;
- rejects output below `minTokensOut`;
- rejects purchases larger than current inventory;
- calculates token output using `Math.mulDiv`;
- refunds any rounding remainder;
- requires both the treasury transfer and refund call to succeed.

### T7: Administrative abuse

There is no proxy, pause, owner replacement, threshold setter, or post-mint.
This is a deliberate availability and governance trade-off. The team cannot
repair deployed logic, but no privileged party can freeze the sale or replace
the treasury.

## Static analysis

Command:

```bash
PYTHONPATH=work/slither-packages python -m slither . \
  --filter-paths "contracts/test" \
  --exclude-dependencies
```

Result:

```text
INFO:Detectors:
Low level call in MultiSigTreasury.executeTransaction
Low level call in TokenVendor.buyTokens
INFO:Slither:. analyzed (18 contracts with 100 detectors), 2 result(s) found
```

Both low-level calls are intentional:

- The treasury needs `call` so owners can target contract wallets and arbitrary
  approved calldata.
- The vendor needs `call` to forward ETH to Treasury and return rounding dust.

Both call sites explicitly check the returned success flag, and both contracts
that make external calls inherit `ReentrancyGuard`.

The full raw scan is in `docs/slither-output.txt`.

## Automated test evidence

The suite covers:

- fixed supply and invalid supply;
- invalid Vendor configuration;
- quote accuracy;
- successful purchase and direct Treasury settlement;
- rounding refunds;
- slippage failure;
- zero payment;
- insufficient inventory;
- owner/threshold configuration;
- duplicate, zero-address, and invalid-threshold owners;
- two distinct confirmations;
- unauthorized owner action;
- duplicate confirmation;
- replay prevention;
- transaction retrieval;
- ETH deposit event;
- reentrancy rejection.

Coverage output is in `docs/coverage-output.txt`.
