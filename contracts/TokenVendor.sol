// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title TokenVendor
/// @notice Fixed-price ERC-20 sale. Sale proceeds settle directly in treasury.
contract TokenVendor is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    address payable public immutable treasury;
    uint256 public immutable pricePerToken;

    error InvalidConfiguration();
    error ZeroPayment();
    error AmountTooSmall();
    error InsufficientInventory();
    error SlippageExceeded();
    error TreasuryTransferFailed();
    error RefundFailed();

    event TokensPurchased(
        address indexed buyer,
        uint256 grossEthPaid,
        uint256 netEthPaid,
        uint256 ethRefunded,
        uint256 tokenAmount
    );

    constructor(
        address token_,
        address payable treasury_,
        uint256 pricePerToken_
    ) {
        if (
            token_ == address(0) ||
            treasury_ == address(0) ||
            pricePerToken_ == 0
        ) {
            revert InvalidConfiguration();
        }

        token = IERC20(token_);
        treasury = treasury_;
        pricePerToken = pricePerToken_;
    }

    /// @notice Return the token amount purchased for an ETH amount.
    function quote(uint256 ethAmount) public view returns (uint256) {
        if (ethAmount == 0) return 0;
        return Math.mulDiv(ethAmount, 1 ether, pricePerToken);
    }

    /// @notice Buy tokens with ETH. Any rounding remainder is refunded.
    function buyTokens(uint256 minTokensOut) external payable nonReentrant {
        if (msg.value == 0) revert ZeroPayment();

        uint256 tokenAmount = quote(msg.value);
        if (tokenAmount == 0) revert AmountTooSmall();
        if (tokenAmount < minTokensOut) revert SlippageExceeded();
        if (token.balanceOf(address(this)) < tokenAmount) {
            revert InsufficientInventory();
        }

        uint256 netEthPaid = Math.mulDiv(
            tokenAmount,
            pricePerToken,
            1 ether
        );
        uint256 refund = msg.value - netEthPaid;

        (bool treasuryOk, ) = treasury.call{value: netEthPaid}("");
        if (!treasuryOk) revert TreasuryTransferFailed();

        if (refund != 0) {
            (bool refundOk, ) = msg.sender.call{value: refund}("");
            if (!refundOk) revert RefundFailed();
        }

        token.safeTransfer(msg.sender, tokenAmount);

        emit TokensPurchased(
            msg.sender,
            msg.value,
            netEthPaid,
            refund,
            tokenAmount
        );
    }
}
