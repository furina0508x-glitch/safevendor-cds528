const { ethers, network } = require("hardhat");

async function main() {
  if (network.name !== "sepolia") {
    throw new Error("This helper only runs on Sepolia");
  }
  if (!process.env.OWNER_2) {
    throw new Error("OWNER_2 is required");
  }

  const [deployer] = await ethers.getSigners();
  const amount = ethers.parseEther(process.env.OWNER_2_FUNDING || "0.01");
  const tx = await deployer.sendTransaction({
    to: process.env.OWNER_2,
    value: amount
  });
  await tx.wait();
  console.log(`Funded ${process.env.OWNER_2} with ${ethers.formatEther(amount)} ETH`);
  console.log(`Transaction: ${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
