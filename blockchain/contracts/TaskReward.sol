// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./MyToken.sol";
import "./UserRole.sol";
import "./Payment.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract TaskReward {
    using SafeERC20 for MyToken;

    MyToken public token;
    UserRole public userRole;
    Payment public payment;

    enum TaskType { Consumer, Survey, Event }

    struct Task {
        TaskType taskType;
        string description;
        uint256 reward;
        uint256 maxClaims;
        uint256 currentClaims;
        uint256 targetAmount;        // 消費目標或不使用（Survey/Event）
        address createdBy;
        uint256 createdAt;
        bool exists;
        mapping(address => bool) hasClaimed;
    }

    uint256 public nextTaskId;
    mapping(uint256 => Task) private _tasks;

    event TaskCreated(uint256 indexed taskId, TaskType taskType, string description, uint256 reward, uint256 maxClaims, uint256 targetAmount, address indexed creator);
    event TaskCompleted(uint256 indexed taskId, address indexed user, uint256 reward);
    event TaskCancelled(uint256 indexed taskId, address indexed creator, uint256 refunded);

    constructor(address tokenAddr, address roleAddr, address paymentAddr) {
        token = MyToken(tokenAddr);
        userRole = UserRole(roleAddr);
        payment = Payment(paymentAddr);
    }

    modifier onlyPublisher() {
        UserRole.Role r = userRole.getRole(msg.sender);
        require(r == UserRole.Role.Merchant || r == UserRole.Role.Admin, "Not allowed");
        _;
    }

    modifier onlyStudent() {
        require(userRole.getRole(msg.sender) == UserRole.Role.Student, "Only students can complete tasks");
        _;
    }

    modifier onlyAdmin() {
        require(userRole.getRole(msg.sender) == UserRole.Role.Admin, "Only admin");
        _;
    }

    /**
     * 發布任務（escrow 模式）
     * @param _type 任務類型 (0=Consumer, 1=Survey, 2=Event)
     * @param desc 任務描述
     * @param reward 單位獎勵（wei）
     * @param maxClaims 最大領取次數
     * @param targetAmount 消費目標金額（wei）；若非 Consumer 類型可設 0
     */
    function createTask(
        uint8 _type,
        string memory desc,
        uint256 reward,
        uint256 maxClaims,
        uint256 targetAmount
    ) external onlyPublisher {
        require(reward > 0, "Reward must be > 0");
        require(maxClaims > 0, "MaxClaims must be > 0");
        require(_type <= 2, "Invalid task type");

        TaskType taskType = TaskType(_type);
        if (taskType == TaskType.Consumer) {
            require(targetAmount > 0, "Consumer task requires targetAmount > 0");
        }

        // Escrow：計算總獎勵額，要求商家一次轉入合約
        uint256 totalAmount = reward * maxClaims;
        token.safeTransferFrom(msg.sender, address(this), totalAmount);

        Task storage t = _tasks[nextTaskId];
        t.taskType = taskType;
        t.description = desc;
        t.reward = reward;
        t.maxClaims = maxClaims;
        t.targetAmount = targetAmount;
        t.createdBy = msg.sender;
        t.createdAt = block.timestamp;
        t.exists = true;

        emit TaskCreated(nextTaskId, taskType, desc, reward, maxClaims, targetAmount, msg.sender);
        nextTaskId++;
    }

    /**
     * 完成任務、領取獎勵
     * Consumer: 驗證累積消費
     * Survey: 由於簡化方案，前端提交/後端確認後呼叫此函式；此版先簡化為 Admin 呼叫
     * Event: 直接領取（QR 掃描對應 eventId）
     */
    function completeTask(uint256 taskId) external onlyStudent {
        require(taskId < nextTaskId, "Task does not exist");
        Task storage t = _tasks[taskId];
        require(t.exists, "Task does not exist or is cancelled");
        require(t.currentClaims < t.maxClaims, "Max claims reached");
        require(!t.hasClaimed[msg.sender], "Already claimed this task");

        // 驗證邏輯（根據任務類型）
        if (t.taskType == TaskType.Consumer) {
            // Consumer：檢查學生對商家的累積消費是否達到目標
            uint256 totalPaid = payment.getTotalPaidFromTo(msg.sender, t.createdBy);
            require(totalPaid >= t.targetAmount, "Consumption target not reached");
        }
        // Survey 與 Event 暫不做額外驗證（Survey 由後端確認，Event 無條件）

        // Checks-Effects-Interactions：先更新狀態再轉帳
        t.hasClaimed[msg.sender] = true;
        t.currentClaims++;

        // 從 escrow 發放獎勵給學生
        token.safeTransfer(msg.sender, t.reward);

        emit TaskCompleted(taskId, msg.sender, t.reward);
    }

    /**
     * 管理員或商家取消任務並取回未領的獎勵
     */
    function cancelTask(uint256 taskId) external {
        require(taskId < nextTaskId, "Task does not exist");
        Task storage t = _tasks[taskId];
        require(t.exists, "Task does not exist");
        require(msg.sender == t.createdBy || userRole.getRole(msg.sender) == UserRole.Role.Admin, "Only creator or admin can cancel");

        // 計算未領的獎勵額
        uint256 remaining = (t.maxClaims - t.currentClaims) * t.reward;

        // 標記任務為已取消
        t.exists = false;

        // 返還未領獎勵給建立者
        if (remaining > 0) {
            token.safeTransfer(t.createdBy, remaining);
        }

        emit TaskCancelled(taskId, t.createdBy, remaining);
    }

    /**
     * 查詢任務信息（不含 mapping）
     */
    function getTask(uint256 taskId) external view returns (
        uint8 taskType,
        string memory description,
        uint256 reward,
        uint256 maxClaims,
        uint256 currentClaims,
        uint256 targetAmount,
        address createdBy,
        uint256 createdAt,
        bool exists
    ) {
        require(taskId < nextTaskId, "Task does not exist");
        Task storage t = _tasks[taskId];
        return (
            uint8(t.taskType),
            t.description,
            t.reward,
            t.maxClaims,
            t.currentClaims,
            t.targetAmount,
            t.createdBy,
            t.createdAt,
            t.exists
        );
    }

    /**
     * 查詢某用戶是否已領過任務
     */
    function hasUserClaimed(uint256 taskId, address user) external view returns (bool) {
        require(taskId < nextTaskId, "Task does not exist");
        return _tasks[taskId].hasClaimed[user];
    }

    /**
     * 查詢學生對商家的累積消費（輔助查詢）
     */
    function getUserConsumption(address user, address merchant) external view returns (uint256) {
        return payment.getTotalPaidFromTo(user, merchant);
    }
}
