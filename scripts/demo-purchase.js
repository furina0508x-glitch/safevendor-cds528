const { ethers, network } = require("hardhat");
const deployment = require("../deployments/sepolia.json");

const vendorAbi = [
  "function quote(uint256 ethAmount) view returns (uint256)",
  "function buyTokens(uint256 minTokensOut) payable"
];

async function main() {
  if (network.name !== "sepolia") {
    throw new Error("Demo purchase must run on Sepolia");
  }

  const [buyer] = await ethers.getSigners();
  const vendor = new ethers.Contract(
    deployment.vendor.address,
    vendorAbi,
    buyer
  );
  const payment = ethers.parseEther("0.01");
  const quotedTokens = await vendor.quote(payment);
  const minTokensOut = (quotedTokens * 995n) / 1000n;
  const tx = await vendor.buyTokens(minTokensOut, { value: payment });
  await tx.wait();

  console.log(`Buyer: ${buyer.address}`);
  console.log(`Payment: ${ethers.formatEther(payment)} ETH`);
  console.log(`Tokens received: ${ethers.formatEther(quotedTokens)} SVT`);
  console.log(`Transaction: ${tx.hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
