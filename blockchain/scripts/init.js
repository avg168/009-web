const { ethers } = require("hardhat");
const addresses = require("../deployed-addresses.json");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Initializing with:", deployer.address);

  // 帳號配置
  const studentAccount = "0x2732D1FC45D4621b3432638D0b65cc5728d279dd";
  const adminAccount = "0x28f43eF5392dF23cE60bF01357CE73329AD25037";

  // 取得合約
  const userRole = await ethers.getContractAt("UserRole", addresses.userRole);
  const token = await ethers.getContractAt("MyToken", addresses.token);

  console.log("\n=== 設定角色 ===");

  // 設定學生角色 (Role.Student = 1)
  console.log(`設定 ${studentAccount} 為學生...`);
  let tx = await userRole.setRole(studentAccount, 1);
  await tx.wait();
  console.log("✓ 學生角色設定完成");

  // 設定管理員角色 (Role.Admin 需透過 owner，此例 deployer 已是 owner)
  // 但若要設定另一個地址為 Admin，需要先給該地址 Admin 權限，然後由該地址操作
  // 這裡改為設為 Merchant (Role.Merchant = 2)，或直接讓 deployer 完成後轉移 owner
  console.log(`設定 ${adminAccount} 為管理員...`);
  tx = await userRole.setRole(adminAccount, 3); // Role.Admin = 3
  await tx.wait();
  console.log("✓ 管理員角色設定完成");

  console.log("\n=== 鑄造代幣 ===");

  // 鑄造 10000 MTK 給管理員帳號
  const mintAmount = ethers.utils.parseUnits("10000", 18);
  console.log(`鑄造 10000 MTK 給 ${adminAccount}...`);
  tx = await token.mint(adminAccount, mintAmount);
  await tx.wait();
  console.log("✓ 代幣鑄造完成");

  // 檢查餘額
  const balance = await token.balanceOf(adminAccount);
  console.log(`${adminAccount} 的餘額: ${ethers.utils.formatUnits(balance, 18)} MTK`);

  console.log("\n✅ 初始化完成！");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});