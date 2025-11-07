// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PayNova {
    address public owner;

    enum TxStatus { Pending, Paid, Cancelled }

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

    event TransactionCancelled(
        address indexed from,
        bytes32 indexed refHash,
        uint256 timestamp
    );

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
    function generateTransaction(
        address recipient,
        uint256 amount,
        address token,
        string memory ref
    ) external returns (bytes32 refHash) {
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
     * - Must match sender, refHash, and status=Pending.
     * - For native: msg.value >= amount; transfers exact 'amount' to recipient, refunds excess.
     * - For ERC-20: sentAmount >= amount (user approves sentAmount); pulls 'sentAmount', transfers 'amount' to recipient, refunds excess.
     * - Updates status to Paid; emits Receipt event.
     * @param refHash The keccak256 hash of the reference.
     * @param sentAmount The amount sent/approved (== msg.value for native; pull amount for ERC-20). Must >= amount.
     */
    function executePay(bytes32 refHash, uint256 sentAmount) external payable returns (uint256 refundedAmount) {
        Transaction storage txn = transactions[refHash];
        require(txn.from == msg.sender, "Only creator can execute");
        require(txn.status == TxStatus.Pending, "Invalid tx status");
        require(txn.amount > 0, "Invalid transaction");

        uint256 amount = txn.amount;
        address token = txn.token;
        address recipient = txn.to;

        uint256 excess = 0;
        if (token == address(0)) {
            // Native token payment
            uint256 actualSent = msg.value;
            require(actualSent >= amount, "Insufficient native amount sent");
            excess = actualSent - amount;
            payable(recipient).transfer(amount);
            
            // Refund excess to sender
            if (excess > 0) {
                payable(msg.sender).transfer(excess);
            }
            // Ignore passed sentAmount for native
        } else {
            // ERC-20 token payment (supports excess refund like native)
            require(sentAmount >= amount, "Sent amount must be >= payment amount for ERC-20");
            excess = sentAmount - amount;
            IERC20 erc = IERC20(token);
            erc.transferFrom(msg.sender, address(this), sentAmount);
            erc.transfer(recipient, amount);
            
            // Refund excess to sender
            if (excess > 0) {
                erc.transfer(msg.sender, excess);
            }
        }

        // Update to paid
        txn.status = TxStatus.Paid;
        txn.refunded = excess;
        txn.timestamp = block.timestamp; // Update timestamp to execution time

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
    receive() external payable {
        revert("Use generateTransaction() + executePay() for payments");
    }

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
}