// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./MyToken.sol";
import "./UserRole.sol";

contract Payment {
    MyToken public token;
    UserRole public userRole;

    // 記錄累積消費：totalPaidFromTo[from][to] = 累計金額
    mapping(address => mapping(address => uint256)) public totalPaidFromTo;

    event PaymentMade(address indexed from, address indexed to, uint256 amount);

    constructor(address tokenAddress, address userRoleAddress) {
        token = MyToken(tokenAddress);
        userRole = UserRole(userRoleAddress);
    }

    function pay(address to, uint256 amount) public {
        require(
            userRole.getRole(msg.sender) == UserRole.Role.Student ||
            userRole.getRole(msg.sender) == UserRole.Role.Merchant,
            "Only student or merchant can pay"
        );
        uint256 amountInWei = amount * 10 ** token.decimals();
        token.transferFrom(msg.sender, to, amountInWei);
        
        // 記錄累積消費（不轉換單位，直接存 wei）
        totalPaidFromTo[msg.sender][to] += amountInWei;
        
        emit PaymentMade(msg.sender, to, amountInWei);
    }

    // 查詢 from 對 to 的累積消費
    function getTotalPaidFromTo(address from, address to) external view returns (uint256) {
        return totalPaidFromTo[from][to];
    }
}
