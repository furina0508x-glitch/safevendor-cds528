const { run, network } = require("hardhat");
const deployment = require("../deployments/sepolia.json");

async function verify(name, address, constructorArguments) {
  console.log(`Verifying ${name} at ${address}`);
  try {
    await run("verify:verify", {
      address,
      constructorArguments
    });
  } catch (error) {
    if (error.message.toLowerCase().includes("already verified")) {
      console.log(`${name} is already verified`);
      return;
    }
    throw error;
  }
}

async function main() {
  if (network.name !== "sepolia") {
    throw new Error("Verification must run on Sepolia");
  }
  if (!process.env.ETHERSCAN_API_KEY) {
    throw new Error("ETHERSCAN_API_KEY is required");
  }

  await verify("SafeVendorToken", deployment.token.address, [
    1000000000000000000000000n
  ]);
  await verify("MultiSigTreasury", deployment.treasury.address, [
    deployment.treasury.owners,
    deployment.treasury.threshold
  ]);
  await verify("TokenVendor", deployment.vendor.address, [
    deployment.vendor.tokenAddress,
    deployment.vendor.treasuryAddress,
    BigInt(deployment.vendor.pricePerToken)
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
