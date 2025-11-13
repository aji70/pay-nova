// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.5.0
pragma solidity ^0.8.27;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract USDT is ERC20, Ownable {
    uint256 public constant MINT_AMOUNT = 100 * 10 ** 18;
    uint256 public constant COOLDOWN = 24 hours;

    mapping(address => uint256) public lastMintTime;
    address public pendingOwner;

    constructor(address initialOwner) ERC20("USDT", "USDT") Ownable(initialOwner) {}

    /// @notice Allows users to mint 100 tokens every 24 hours
    /// @dev Owner can mint any amount anytime
    function mint() external {
        if (msg.sender == owner()) {
            // Owner has unlimited mint rights
            _mint(msg.sender, (MINT_AMOUNT * 100));
            return;
        }

        require(block.timestamp >= lastMintTime[msg.sender] + COOLDOWN, "You can only mint once every 24 hours");

        lastMintTime[msg.sender] = block.timestamp;
        _mint(msg.sender, MINT_AMOUNT);
    }

    /// @notice Initiates ownership transfer
    function proposeNewOwner(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        pendingOwner = newOwner;
    }

    /// @notice New owner must accept ownership
    function acceptOwnership() external {
        require(msg.sender == pendingOwner, "Not authorized");
        _transferOwnership(pendingOwner);
        pendingOwner = address(0);
    }
}
