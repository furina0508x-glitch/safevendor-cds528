const fs = require("node:fs");
const path = require("node:path");

const sourcePath = path.join(__dirname, "..", "work", "wallet-candidates.json");
const targetPath = path.join(__dirname, "..", ".env");
const wallets = JSON.parse(fs.readFileSync(sourcePath, "utf8"));

if (wallets.length < 3) {
  throw new Error("At least three wallet candidates are required");
}

const deployer = wallets[0];
const owner2 = wallets[1];
const owner3 = wallets[2];
const lines = [
  "SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com",
  `PRIVATE_KEY=${deployer.privateKey}`,
  `TREASURY_OWNERS=${deployer.address},${owner2.address},${owner3.address}`,
  `OWNER_2=${owner2.address}`,
  `OWNER_3=${owner3.address}`,
  `OWNER_2_PRIVATE_KEY=${owner2.privateKey}`,
  ""
];

fs.writeFileSync(targetPath, lines.join("\n"), { mode: 0o600 });
console.log("Wrote test-only deployment credentials to .env with mode 600.");
