const { ethers, network } = require("hardhat");
const deployment = require("../deployments/sepolia.json");

const treasuryAbi = [
  "function transactionCount() view returns (uint256)",
  "function executeTransaction(uint256 transactionId)",
  "function getTransaction(uint256) view returns (tuple(address to,uint256 value,bytes data,bool executed,uint256 confirmationCount))"
];

async function main() {
  if (network.name !== "sepolia") {
    throw new Error("Pending execution must run on Sepolia");
  }
  if (!process.env.OWNER_2_PRIVATE_KEY) {
    throw new Error("OWNER_2_PRIVATE_KEY is required");
  }

  const owner2 = new ethers.Wallet(
    process.env.OWNER_2_PRIVATE_KEY,
    ethers.provider
  );
  const treasury = new ethers.Contract(
    deployment.treasury.address,
    treasuryAbi,
    owner2
  );
  const count = await treasury.transactionCount();
  if (count === 0n) throw new Error("No treasury proposals exist");

  for (let id = count - 1n; id >= 0n; id--) {
    const transaction = await treasury.getTransaction(id);
    if (transaction.executed) continue;

    const tx = await treasury.executeTransaction(id);
    await tx.wait();
    console.log(`Executed proposal ${id}: ${tx.hash}`);
    console.log(`Recipient: ${transaction.to}`);
    console.log(`Amount: ${ethers.formatEther(transaction.value)} ETH`);
    return;
  }

  throw new Error("No pending treasury proposal found");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
