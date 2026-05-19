const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

function hrtimeMs(start) {
  const diff = process.hrtime(start);
  return diff[0] * 1000 + diff[1] / 1e6;
}

async function run() {
  const addressesPath = path.join(__dirname, "..", "deployed-addresses.json");
  if (!fs.existsSync(addressesPath)) {
    throw new Error("deployed-addresses.json not found. Please deploy contracts first.");
  }

  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:7545");

  const merchantPk = process.env.MERCHANT_PK || "0x5c9713189c44fc80e1af6f83258bc616ba9a6f141311cf89a2734b82dcd398a0";
  const studentPk = process.env.STUDENT_PK || null;

  const merchant = new ethers.Wallet(merchantPk, provider);
  const token = await ethers.getContractAt("MyToken", addresses.token, merchant);
  const taskReward = await ethers.getContractAt("TaskReward", addresses.taskReward, merchant);
  const userRole = await ethers.getContractAt("UserRole", addresses.userRole, merchant);

  console.log("Merchant address:", merchant.address);
  if (studentPk) {
    const student = new ethers.Wallet(studentPk, provider);
    console.log("Student address:", student.address);
  } else {
    console.log("No STUDENT_PK provided. Only createTask will be measured.");
  }

  const rewardWei = ethers.utils.parseUnits("1", 18);
  const maxClaims = 1;
  const targetAmount = ethers.utils.parseUnits("0", 18);
  const totalAmount = rewardWei.mul(maxClaims);

  console.log("\n[1] Approve token for TaskReward");
  const approveStart = process.hrtime();
  const approveTx = await token.approve(addresses.taskReward, totalAmount);
  const approveReceipt = await approveTx.wait();
  const approveMs = hrtimeMs(approveStart);
  console.log(`approve: tx=${approveReceipt.transactionHash} gas=${approveReceipt.gasUsed.toString()} time=${approveMs.toFixed(0)}ms`);

  const results = [];
  for (let i = 0; i < 3; i++) {
    console.log(`\n[2] createTask iteration ${i + 1}`);
    const description = `perf-task-${Date.now()}-${i}`;
    const createStart = process.hrtime();
    const createTx = await taskReward.createTask(2, description, rewardWei, maxClaims, targetAmount);
    const createReceipt = await createTx.wait();
    const createMs = hrtimeMs(createStart);
    console.log(`createTask: tx=${createReceipt.transactionHash} gas=${createReceipt.gasUsed.toString()} time=${createMs.toFixed(0)}ms`);
    results.push({ step: 'createTask', iteration: i + 1, time: createMs, gas: createReceipt.gasUsed.toString(), taskId: i });
  }

  if (studentPk) {
    const student = new ethers.Wallet(studentPk, provider);
    const taskId = (await taskReward.nextTaskId()).toNumber() - 1;
    console.log(`\n[3] completeTask for taskId=${taskId} by student ${student.address}`);

    const studentTaskReward = taskReward.connect(student);
    const completeStart = process.hrtime();
    const completeTx = await studentTaskReward.completeTask(taskId);
    const completeReceipt = await completeTx.wait();
    const completeMs = hrtimeMs(completeStart);
    console.log(`completeTask: tx=${completeReceipt.transactionHash} gas=${completeReceipt.gasUsed.toString()} time=${completeMs.toFixed(0)}ms`);
    results.push({ step: 'completeTask', time: completeMs, gas: completeReceipt.gasUsed.toString(), taskId });
  }

  console.log("\nSummary:");
  results.forEach((item) => {
    console.log(JSON.stringify(item));
  });
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
