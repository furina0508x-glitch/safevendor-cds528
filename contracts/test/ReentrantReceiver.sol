// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {MultiSigTreasury} from "../MultiSigTreasury.sol";

/// @dev Test-only contract used to prove that execution cannot re-enter.
contract ReentrantReceiver {
    MultiSigTreasury public treasury;
    uint256 public attackTransactionId;
    bool public attackMode;
    bool public reentryRejected;

    function prepare(
        MultiSigTreasury treasury_,
        uint256 transactionId
    ) external {
        treasury = treasury_;
        attackTransactionId = transactionId;
        attackMode = true;
    }

    function confirmAndExecute() external {
        treasury.confirmTransaction(attackTransactionId);
        treasury.executeTransaction(attackTransactionId);
    }

    receive() external payable {
        if (attackMode) {
            attackMode = false;
            try treasury.executeTransaction(attackTransactionId) {
                reentryRejected = false;
            } catch {
                reentryRejected = true;
            }
        }
    }
}
