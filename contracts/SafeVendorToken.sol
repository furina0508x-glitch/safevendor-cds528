// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title SafeVendorToken
/// @notice Fixed-supply ERC-20 used by the SafeVendor sale.
contract SafeVendorToken is ERC20 {
    uint256 public immutable maxSupply;

    error InvalidSupply();

    constructor(uint256 initialSupply) ERC20("SafeVendor Token", "SVT") {
        if (initialSupply == 0) revert InvalidSupply();
        maxSupply = initialSupply;
        _mint(msg.sender, initialSupply);
    }
}
