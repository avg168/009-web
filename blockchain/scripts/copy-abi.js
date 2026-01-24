const fs = require("fs");
const path = require("path");

// 合約列表（需要複製 ABI 的合約）
const contracts = ["MyToken", "UserRole", "Payment", "TaskReward"];

// 來源與目的路徑
const artifactsDir = path.join(__dirname, "..", "artifacts", "contracts");
const abiOutputDir = path.join(__dirname, "..", "..", "frontend", "src", "abi");

// 確保輸出目錄存在
if (!fs.existsSync(abiOutputDir)) {
  fs.mkdirSync(abiOutputDir, { recursive: true });
  console.log("Created abi directory:", abiOutputDir);
}

// 複製每個合約的 ABI
contracts.forEach((contract) => {
  // 查找合約檔案（可能在 Solidity 檔案資料夾中）
  const artifactFile = path.join(artifactsDir, `${contract}.sol`, `${contract}.json`);
  
  if (fs.existsSync(artifactFile)) {
    const artifact = JSON.parse(fs.readFileSync(artifactFile, "utf8"));
    
    // 僅提取 ABI 部分
    const abiOnly = { abi: artifact.abi };
    
    // 寫到前端
    const outputFile = path.join(abiOutputDir, `${contract}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(abiOnly, null, 2));
    console.log(`✓ Copied ${contract}.json to ${outputFile}`);
  } else {
    console.warn(`⚠ Not found: ${artifactFile}`);
  }
});

console.log("ABI copy complete!");
