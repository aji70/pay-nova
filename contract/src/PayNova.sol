// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PayNova {
    address public owner;

    struct Call {
        address target;
        bytes data;
        uint256 value;
    }

    enum TxStatus {
        Pending,
        Paid,
        Cancelled
    }

    struct Transaction {
        address from;
        address to;
        uint256 amount;
        address token;
        uint256 timestamp;
        TxStatus status;
        uint256 refunded;
    }

    mapping(bytes32 => Transaction) public transactions;

    event TransactionGenerated(
        address indexed from,
        address indexed to,
        bytes32 indexed refHash,
        uint256 amount,
        address token,
        uint256 timestamp
    );

    event Receipt(
        address indexed from,
        address indexed to,
        bytes32 indexed refHash,
        uint256 amount,
        address token,
        uint256 timestamp,
        uint256 refunded
    );

    event TransactionCancelled(address indexed from, bytes32 indexed refHash, uint256 timestamp);

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Generates a pending transaction on-chain (no funds transferred yet).
     * - Computes refHash = keccak256(ref) for lookup/storage.
     * - Stores as Pending; use executePay() to complete payment.
     * - Emits TransactionGenerated event.
     * @param recipient The beneficiary address.
     * @param amount The intended payment amount.
     * @param token Token address (address(0) for native).
     * @param ref String ref created by frontend (used to save/retrieve tx).
     */
    function generateTransaction(address recipient, uint256 amount, address token, string memory ref)
        external
        returns (bytes32 refHash)
    {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(bytes(ref).length > 0, "ref is required");

        refHash = keccak256(abi.encodePacked(ref));

        // Ensure no existing tx for this ref
        require(transactions[refHash].from == address(0), "ref already used");

        // Save as pending
        transactions[refHash] = Transaction({
            from: msg.sender,
            to: recipient,
            amount: amount,
            token: token,
            timestamp: block.timestamp,
            status: TxStatus.Pending,
            refunded: 0
        });

        emit TransactionGenerated(msg.sender, recipient, refHash, amount, token, block.timestamp);
        return refHash;
    }

    /**
     * @dev Executes payment for a previously generated transaction.
     * - Must match sender, ref, and status=Pending.
     * - For native: msg.value >= amount; transfers exact 'amount' to recipient, refunds excess.
     * - For ERC-20: sentAmount >= amount (user approves sentAmount); pulls 'sentAmount', transfers 'amount' to recipient, refunds excess.
     * - Updates status to Paid; emits Receipt event.
     * @param ref The reference.
     * @param sentAmount The amount sent/approved (== msg.value for native; pull amount for ERC-20). Must >= amount.
     */
    function executePay(string memory ref, uint256 sentAmount) external payable returns (uint256 refundedAmount) {
        bytes32 refHash = keccak256(abi.encodePacked(ref));
        Transaction storage txn = transactions[refHash];
        require(txn.status == TxStatus.Pending, "Invalid tx status");

        uint256 amount = txn.amount;
        address token = txn.token;
        address recipient = txn.to;

        uint256 excess = 0;

        if (token == address(0)) {
            // Native token payment (Ether)
            uint256 actualSent = msg.value;
            require(actualSent >= amount, "Insufficient ETH sent");

            excess = actualSent - amount;

            // Send payment to recipient
            (bool sentToRecipient,) = payable(recipient).call{value: msg.value}("");
            require(sentToRecipient, "Transfer to recipient failed");

            // Refund excess back to sender
            if (excess > 0) {
                (bool refunded,) = payable(msg.sender).call{value: excess}("");
                require(refunded, "Refund failed");
            }
        } else {
            // ERC-20 token payment
            require(sentAmount >= amount, "Sent amount must be >= payment amount for ERC-20");
            excess = sentAmount - amount;

            IERC20 erc = IERC20(token);

            // Transfer tokens from sender to contract
            require(erc.transferFrom(msg.sender, address(this), sentAmount), "Token transfer failed");

            // Send tokens to recipient
            require(erc.transfer(recipient, amount), "Token payment failed");

            // Refund any excess tokens
            if (excess > 0) {
                require(erc.transfer(msg.sender, excess), "Token refund failed");
            }
        }

        // Update transaction state
        txn.status = TxStatus.Paid;
        txn.refunded = excess;
        txn.timestamp = block.timestamp;

        emit Receipt(msg.sender, recipient, refHash, amount, token, block.timestamp, excess);
        return excess;
    }

    /**
     * @dev Cancels a pending transaction (only creator).
     * - Updates status to Cancelled; emits event.
     * @param refHash The keccak256 hash of the reference.
     */
    function cancelTransaction(bytes32 refHash) external {
        Transaction storage txn = transactions[refHash];
        require(txn.from == msg.sender, "Only creator can cancel");
        require(txn.status == TxStatus.Pending, "Cannot cancel non-pending tx");

        txn.status = TxStatus.Cancelled;
        txn.timestamp = block.timestamp; // Update to cancel time

        emit TransactionCancelled(msg.sender, refHash, block.timestamp);
    }

    /**
     * @dev Retrieve transaction details by frontend-generated ref.
     * @param ref The string ref (computes keccak256 internally).
     * @return The Transaction struct.
     */
    function getTransaction(string calldata ref) external view returns (Transaction memory) {
        bytes32 refHash = keccak256(abi.encodePacked(ref));
        return transactions[refHash];
    }

    // Fallback to accept native tokens if sent directly (optional, for safety)
    receive() external payable {}

    // Owner-only: Emergency withdraw (if needed for fees or stuck funds)
    function withdraw(address token, uint256 amount) external {
        require(msg.sender == owner, "Only owner");
        if (token == address(0)) {
            payable(owner).transfer(amount);
        } else {
            IERC20(token).transfer(owner, amount);
        }
    }

    function changeOwner(address newOwner) external {
        require(msg.sender == owner, "only Owner");
        owner = newOwner;
    }

    // Add this function to PayNova.sol
    function multicall(Call[] calldata calls) external payable returns (bytes[] memory results) {
        results = new bytes[](calls.length);
        for (uint256 i = 0; i < calls.length; i++) {
            (bool success, bytes memory result) = calls[i].target.call{value: calls[i].value}(calls[i].data);
            require(success, "Multicall failed");
            results[i] = result;
        }
    }
}
