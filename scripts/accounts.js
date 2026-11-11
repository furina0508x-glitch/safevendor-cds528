const fs = require("node:fs");
const path = require("node:path");
const { Wallet } = require("ethers");

const outputPath = path.join(__dirname, "..", "work", "wallet-candidates.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

const wallets = Array.from({ length: 4 }, () =>
  Wallet.createRandom().privateKey
).map((privateKey) => new Wallet(privateKey));

fs.writeFileSync(
  outputPath,
  `${JSON.stringify(
    wallets.map((wallet, index) => ({
      role: index === 0 ? "deployer and owner 1" : `owner ${index + 1}`,
      address: wallet.address,
      privateKey: wallet.privateKey
    })),
    null,
    2
  )}\n`,
  { mode: 0o600 }
);

console.log(`Generated test-only wallets in ${outputPath}`);
for (const wallet of wallets) {
  console.log(`${wallet.address}`);
}
