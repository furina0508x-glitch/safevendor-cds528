const fs = require("node:fs");
const path = require("node:path");
const { ethers, network } = require("hardhat");

const TOKEN_SUPPLY = ethers.parseEther("1000000");
const PRICE_PER_TOKEN = ethers.parseEther("0.0001");
const THRESHOLD = 2;

function parseOwners(deployerAddress) {
  const configured = (process.env.TREASURY_OWNERS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (configured.length > 0) {
    if (configured.length !== 3) {
      throw new Error("TREASURY_OWNERS must contain exactly three addresses");
    }
    return configured;
  }

  const fallback = [
    deployerAddress,
    process.env.OWNER_2,
    process.env.OWNER_3
  ].filter(Boolean);
  if (fallback.length !== 3) {
    throw new Error(
      "Provide TREASURY_OWNERS or PRIVATE_KEY, OWNER_2, and OWNER_3"
    );
  }
  return fallback;
}

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("No deployer account configured");
  }

  const owners = parseOwners(deployer.address);
  const providerNetwork = await ethers.provider.getNetwork();
  const expectedChainId = network.name === "sepolia" ? 11155111n : null;
  if (expectedChainId && providerNetwork.chainId !== expectedChainId) {
    throw new Error(
      `Expected chain ${expectedChainId}, got ${providerNetwork.chainId}`
    );
  }

  console.log(`Network: ${network.name} (${providerNetwork.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Treasury owners: ${owners.join(", ")}`);

  const Token = await ethers.getContractFactory("SafeVendorToken");
  const token = await Token.deploy(TOKEN_SUPPLY);
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  const tokenDeployment = token.deploymentTransaction();
  const tokenReceipt = await tokenDeployment.wait();
  console.log(`SafeVendorToken: ${tokenAddress}`);

  const Treasury = await ethers.getContractFactory("MultiSigTreasury");
  const treasury = await Treasury.deploy(owners, THRESHOLD);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  const treasuryDeployment = treasury.deploymentTransaction();
  const treasuryReceipt = await treasuryDeployment.wait();
  console.log(`MultiSigTreasury: ${treasuryAddress}`);

  const Vendor = await ethers.getContractFactory("TokenVendor");
  const vendor = await Vendor.deploy(
    tokenAddress,
    treasuryAddress,
    PRICE_PER_TOKEN
  );
  await vendor.waitForDeployment();
  const vendorAddress = await vendor.getAddress();
  const vendorDeployment = vendor.deploymentTransaction();
  const vendorReceipt = await vendorDeployment.wait();
  console.log(`TokenVendor: ${vendorAddress}`);

  const fundingTx = await token.transfer(vendorAddress, TOKEN_SUPPLY);
  await fundingTx.wait();
  console.log(`Vendor inventory funded: ${fundingTx.hash}`);

  const deployment = {
    network: network.name,
    chainId: providerNetwork.chainId.toString(),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    token: {
      address: tokenAddress,
      deploymentHash: tokenDeployment.hash,
      deploymentBlock: tokenReceipt.blockNumber
    },
    treasury: {
      address: treasuryAddress,
      owners,
      threshold: THRESHOLD,
      deploymentHash: treasuryDeployment.hash,
      deploymentBlock: treasuryReceipt.blockNumber
    },
    vendor: {
      address: vendorAddress,
      pricePerToken: PRICE_PER_TOKEN.toString(),
      tokenAddress,
      treasuryAddress,
      deploymentHash: vendorDeployment.hash,
      deploymentBlock: vendorReceipt.blockNumber,
      inventoryFundingHash: fundingTx.hash
    }
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const frontendDir = path.join(__dirname, "..", "frontend", "src");
  fs.mkdirSync(deploymentsDir, { recursive: true });
  fs.mkdirSync(frontendDir, { recursive: true });
  fs.writeFileSync(
    path.join(deploymentsDir, `${network.name}.json`),
    `${JSON.stringify(deployment, null, 2)}\n`
  );
  fs.writeFileSync(
    path.join(frontendDir, "deployment.json"),
    `${JSON.stringify(deployment, null, 2)}\n`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
