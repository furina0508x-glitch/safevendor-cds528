const { ethers, network } = require("hardhat");
const deployment = require("../deployments/sepolia.json");

const treasuryAbi = [
  "function submitTransaction(address to,uint256 value,bytes data) returns (uint256)",
  "function confirmTransaction(uint256 transactionId)",
  "function executeTransaction(uint256 transactionId)",
  "function transactionCount() view returns (uint256)",
  "function getTransaction(uint256) view returns (tuple(address to,uint256 value,bytes data,bool executed,uint256 confirmationCount))"
];

async function main() {
  if (network.name !== "sepolia") {
    throw new Error("Demo flow must run on Sepolia");
  }
  if (!process.env.PRIVATE_KEY || !process.env.OWNER_2_PRIVATE_KEY) {
    throw new Error("PRIVATE_KEY and OWNER_2_PRIVATE_KEY are required");
  }
  if (!deployment.treasury || !deployment.treasury.address) {
    throw new Error("Run the Sepolia deployment first");
  }

  const provider = ethers.provider;
  const owner1 = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const owner2 = new ethers.Wallet(
    process.env.OWNER_2_PRIVATE_KEY,
    provider
  );
  const treasury = new ethers.Contract(
    deployment.treasury.address,
    treasuryAbi,
    owner1
  );

  const beneficiary = process.env.DEMO_BENEFICIARY || owner1.address;
  const value = ethers.parseEther("0.001");
  const submitTx = await treasury.submitTransaction(
    beneficiary,
    value,
    "0x"
  );
  await submitTx.wait();
  const transactionId = (await treasury.transactionCount()) - 1n;
  console.log(`Submitted transaction ${transactionId}: ${submitTx.hash}`);

  const confirmTx = await treasury
    .connect(owner2)
    .confirmTransaction(transactionId);
  await confirmTx.wait();
  console.log(`Second owner confirmed: ${confirmTx.hash}`);

  const executeTx = await treasury
    .connect(owner2)
    .executeTransaction(transactionId);
  await executeTx.wait();
  console.log(`Executed: ${executeTx.hash}`);
  console.log(`Beneficiary: ${beneficiary}`);
  console.log(`Amount: ${ethers.formatEther(value)} ETH`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
