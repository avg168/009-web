const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const initialSupply = 100000;

  const Token = await ethers.getContractFactory("MyToken");
  const token = await Token.deploy(initialSupply);
  await token.deployed();
  console.log("MyToken 部署完成:", token.address);

  const UserRole = await ethers.getContractFactory("UserRole");
  const userRole = await UserRole.deploy();
  await userRole.deployed();
  console.log("UserRole 部署完成:", userRole.address);

  // 先部署 Payment
  const Payment = await ethers.getContractFactory("Payment");
  const payment = await Payment.deploy(token.address, userRole.address);
  await payment.deployed();
  console.log("Payment 部署完成:", payment.address);

  // 再部署 TaskReward，傳入 payment.address
  const TaskReward = await ethers.getContractFactory("TaskReward");
  const taskReward = await TaskReward.deploy(token.address, userRole.address, payment.address);
  await taskReward.deployed();
  console.log("TaskReward 部署完成:", taskReward.address);

  const out = {
    token: token.address,
    userRole: userRole.address,
    payment: payment.address,
    taskReward: taskReward.address
  };
  fs.writeFileSync(path.join(__dirname, "..", "deployed-addresses.json"), JSON.stringify(out, null, 2));
  console.log("Saved deployed-addresses.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});