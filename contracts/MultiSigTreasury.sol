// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title MultiSigTreasury
/// @notice Fixed-owner multisig treasury for sale proceeds.
/// @dev Owners and threshold are immutable. The contract has no upgrade or pause path.
contract MultiSigTreasury is ReentrancyGuard {
    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 confirmationCount;
    }

    mapping(address => bool) public isOwner;
    mapping(uint256 => mapping(address => bool)) public isConfirmed;
    mapping(uint256 => Transaction) private _transactions;

    address[] private _owners;
    uint256 public immutable threshold;
    uint256 public transactionCount;

    error NotOwner();
    error InvalidOwnerConfiguration();
    error InvalidThreshold();
    error InvalidDestination();
    error TransactionAlreadyExecuted();
    error AlreadyConfirmed();
    error NotConfirmed();
    error InsufficientConfirmations();
    error CallFailed();

    event Deposit(address indexed sender, uint256 amount);
    event TransactionSubmitted(
        uint256 indexed transactionId,
        address indexed owner,
        address indexed to,
        uint256 value,
        bytes data
    );
    event TransactionConfirmed(
        uint256 indexed transactionId,
        address indexed owner,
        uint256 confirmationCount
    );
    event TransactionExecuted(
        uint256 indexed transactionId,
        address indexed executor
    );

    modifier onlyOwner() {
        if (!isOwner[msg.sender]) revert NotOwner();
        _;
    }

    constructor(address[] memory initialOwners, uint256 threshold_) {
        if (initialOwners.length == 0) revert InvalidOwnerConfiguration();
        if (threshold_ == 0 || threshold_ > initialOwners.length) {
            revert InvalidThreshold();
        }

        for (uint256 i = 0; i < initialOwners.length; i++) {
            address owner = initialOwners[i];
            if (owner == address(0) || isOwner[owner]) {
                revert InvalidOwnerConfiguration();
            }
            isOwner[owner] = true;
            _owners.push(owner);
        }

        threshold = threshold_;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    /// @notice Submit and automatically confirm a treasury transaction.
    function submitTransaction(
        address to,
        uint256 value,
        bytes calldata data
    ) external onlyOwner returns (uint256 transactionId) {
        if (to == address(0)) revert InvalidDestination();

        transactionId = transactionCount++;
        Transaction storage transaction = _transactions[transactionId];
        transaction.to = to;
        transaction.value = value;
        transaction.data = data;
        transaction.confirmationCount = 1;
        isConfirmed[transactionId][msg.sender] = true;

        emit TransactionSubmitted(
            transactionId,
            msg.sender,
            to,
            value,
            data
        );
        emit TransactionConfirmed(transactionId, msg.sender, 1);
    }

    function confirmTransaction(uint256 transactionId) external onlyOwner {
        Transaction storage transaction = _transactions[transactionId];
        if (transaction.executed) revert TransactionAlreadyExecuted();
        if (isConfirmed[transactionId][msg.sender]) revert AlreadyConfirmed();
        if (transaction.confirmationCount == 0) revert NotConfirmed();

        isConfirmed[transactionId][msg.sender] = true;
        transaction.confirmationCount++;

        emit TransactionConfirmed(
            transactionId,
            msg.sender,
            transaction.confirmationCount
        );
    }

    /// @notice Execute a transaction after the confirmation threshold is met.
    function executeTransaction(
        uint256 transactionId
    ) external onlyOwner nonReentrant {
        Transaction storage transaction = _transactions[transactionId];
        if (transaction.executed) revert TransactionAlreadyExecuted();
        if (transaction.confirmationCount < threshold) {
            revert InsufficientConfirmations();
        }

        // Checks-effects-interactions: mark the transaction before the call.
        transaction.executed = true;
        emit TransactionExecuted(transactionId, msg.sender);

        (bool success, ) = transaction.to.call{value: transaction.value}(
            transaction.data
        );
        if (!success) revert CallFailed();
    }

    function getTransaction(
        uint256 transactionId
    ) external view returns (Transaction memory) {
        return _transactions[transactionId];
    }

    function getOwners() external view returns (address[] memory) {
        return _owners;
    }
}
