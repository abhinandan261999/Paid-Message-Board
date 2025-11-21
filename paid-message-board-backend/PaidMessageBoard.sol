// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract PaidMessageBoard {

    // ------------------------------------------------------------
    // State Variables
    // ------------------------------------------------------------

    address public owner;
    uint256 public postingFee = 0.001 ether;

    struct Message {
        address sender;
        string content;
        uint256 timestamp;
    }

    Message[] public messages;


    // ------------------------------------------------------------
    // Events
    // ------------------------------------------------------------

    event MessagePosted(address indexed sender, string content, uint256 timestamp);
    event FundsWithdrawn(address indexed owner, uint256 amount);


    // ------------------------------------------------------------
    // Constructor
    // ------------------------------------------------------------

    constructor() {
        owner = msg.sender;  // deployer becomes the owner
    }


    // ------------------------------------------------------------
    // Modifiers
    // ------------------------------------------------------------

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this.");
        _;
    }


    // ------------------------------------------------------------
    // State-Changing Functions
    // ------------------------------------------------------------

    // Users pay 0.001 ETH to post a message on-chain
    function postMessage(string calldata content) external payable {
        require(msg.value == postingFee, "Incorrect posting fee.");
        require(bytes(content).length > 0, "Message cannot be empty.");

        messages.push(
            Message({
                sender: msg.sender,
                content: content,
                timestamp: block.timestamp
            })
        );

        emit MessagePosted(msg.sender, content, block.timestamp);
    }

    // Owner withdraws all ETH collected from posting fees
    function withdrawFunds() external onlyOwner {
        uint256 amount = address(this).balance;
        require(amount > 0, "No funds to withdraw.");

        (bool success, ) = owner.call{value: amount}("");
        require(success, "Withdrawal failed.");

        emit FundsWithdrawn(owner, amount);
    }


    // ------------------------------------------------------------
    // View Functions
    // ------------------------------------------------------------

    // Get number of messages stored
    function getMessageCount() external view returns (uint256) {
        return messages.length;
    }

    // Get contract balance (useful for frontend display)
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
