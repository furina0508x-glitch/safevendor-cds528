const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const SUPPLY = ethers.parseEther("1000000");
const PRICE = ethers.parseEther("0.0001");
const THRESHOLD = 2;

async function deployFixture() {
  const [deployer, alice, bob, owner2, owner3, outsider] =
    await ethers.getSigners();

  const Token = await ethers.getContractFactory("SafeVendorToken");
  const token = await Token.deploy(SUPPLY);
  await token.waitForDeployment();

  const Treasury = await ethers.getContractFactory("MultiSigTreasury");
  const treasury = await Treasury.deploy(
    [deployer.address, owner2.address, owner3.address],
    THRESHOLD
  );
  await treasury.waitForDeployment();

  const Vendor = await ethers.getContractFactory("TokenVendor");
  const vendor = await Vendor.deploy(
    await token.getAddress(),
    await treasury.getAddress(),
    PRICE
  );
  await vendor.waitForDeployment();

  await token.transfer(await vendor.getAddress(), SUPPLY);

  return {
    token,
    treasury,
    vendor,
    deployer,
    alice,
    bob,
    owner2,
    owner3,
    outsider
  };
}

describe("SafeVendor", function () {
  describe("SafeVendorToken", function () {
    it("mints the immutable fixed supply to the deployer", async function () {
      const { token, deployer } = await loadFixture(deployFixture);
      expect(await token.name()).to.equal("SafeVendor Token");
      expect(await token.symbol()).to.equal("SVT");
      expect(await token.totalSupply()).to.equal(SUPPLY);
      expect(await token.maxSupply()).to.equal(SUPPLY);
      expect(await token.balanceOf(deployer.address)).to.equal(0);
    });

    it("rejects a zero supply", async function () {
      const Token = await ethers.getContractFactory("SafeVendorToken");
      await expect(Token.deploy(0))
        .to.be.revertedWithCustomError(Token, "InvalidSupply");
    });
  });

  describe("TokenVendor", function () {
    it("rejects zero-address and zero-price configuration", async function () {
      const { token, treasury } = await loadFixture(deployFixture);
      const Vendor = await ethers.getContractFactory("TokenVendor");
      const tokenAddress = await token.getAddress();
      const treasuryAddress = await treasury.getAddress();

      await expect(
        Vendor.deploy(ethers.ZeroAddress, treasuryAddress, PRICE)
      ).to.be.revertedWithCustomError(Vendor, "InvalidConfiguration");
      await expect(
        Vendor.deploy(tokenAddress, ethers.ZeroAddress, PRICE)
      ).to.be.revertedWithCustomError(Vendor, "InvalidConfiguration");
      await expect(
        Vendor.deploy(tokenAddress, treasuryAddress, 0)
      ).to.be.revertedWithCustomError(Vendor, "InvalidConfiguration");
    });

    it("quotes the configured fixed price", async function () {
      const { vendor } = await loadFixture(deployFixture);
      expect(await vendor.quote(ethers.parseEther("0.01"))).to.equal(
        ethers.parseEther("100")
      );
    });

    it("sends ETH directly to treasury and delivers tokens", async function () {
      const { vendor, treasury, token, alice } = await loadFixture(
        deployFixture
      );
      const payment = ethers.parseEther("0.01");

      await expect(
        vendor.connect(alice).buyTokens(ethers.parseEther("100"), {
          value: payment
        })
      )
        .to.emit(vendor, "TokensPurchased")
        .withArgs(
          alice.address,
          payment,
          payment,
          0,
          ethers.parseEther("100")
        );

      expect(await ethers.provider.getBalance(treasury.getAddress())).to.equal(
        payment
      );
      expect(await token.balanceOf(alice.address)).to.equal(
        ethers.parseEther("100")
      );
    });

    it("refunds the integer-division remainder", async function () {
      const { treasury, alice } = await loadFixture(deployFixture);
      const Token = await ethers.getContractFactory("SafeVendorToken");
      const testToken = await Token.deploy(ethers.parseEther("1000"));
      await testToken.waitForDeployment();
      const customPrice = 100000000000001n;
      const Vendor = await ethers.getContractFactory("TokenVendor");
      const testVendor = await Vendor.deploy(
        await testToken.getAddress(),
        await treasury.getAddress(),
        customPrice
      );
      await testVendor.waitForDeployment();
      await testToken.transfer(
        await testVendor.getAddress(),
        ethers.parseEther("1000")
      );
      const gross = customPrice * 10n + 37n;

      await expect(
        testVendor.connect(alice).buyTokens(0, { value: gross })
      ).to.emit(testVendor, "TokensPurchased");

      expect(await ethers.provider.getBalance(treasury.getAddress())).to.equal(
        gross - 1n
      );
    });

    it("reverts when slippage protection is violated", async function () {
      const { vendor, treasury, alice } = await loadFixture(deployFixture);
      await expect(
        vendor
          .connect(alice)
          .buyTokens(ethers.parseEther("51"), {
            value: ethers.parseEther("0.005")
          })
      ).to.be.revertedWithCustomError(vendor, "SlippageExceeded");
      expect(await ethers.provider.getBalance(treasury.getAddress())).to.equal(0);
    });

    it("reverts a zero payment", async function () {
      const { vendor, alice } = await loadFixture(deployFixture);
      await expect(
        vendor.connect(alice).buyTokens(0)
      ).to.be.revertedWithCustomError(vendor, "ZeroPayment");
    });

    it("reverts when inventory is insufficient", async function () {
      const { treasury, alice } = await loadFixture(deployFixture);
      const Token = await ethers.getContractFactory("SafeVendorToken");
      const token = await Token.deploy(ethers.parseEther("1000"));
      await token.waitForDeployment();
      const Vendor = await ethers.getContractFactory("TokenVendor");
      const lowInventoryVendor = await Vendor.deploy(
        await token.getAddress(),
        await treasury.getAddress(),
        PRICE
      );
      await lowInventoryVendor.waitForDeployment();
      await token.transfer(await lowInventoryVendor.getAddress(), 1n);

      await expect(
        lowInventoryVendor
          .connect(alice)
          .buyTokens(0, { value: ethers.parseEther("0.01") })
      ).to.be.revertedWithCustomError(
        lowInventoryVendor,
        "InsufficientInventory"
      );
    });
  });

  describe("MultiSigTreasury", function () {
    it("configures three fixed owners and a 2-of-3 threshold", async function () {
      const { treasury, deployer, owner2, owner3 } = await loadFixture(
        deployFixture
      );
      expect(await treasury.getOwners()).to.deep.equal([
        deployer.address,
        owner2.address,
        owner3.address
      ]);
      expect(await treasury.threshold()).to.equal(THRESHOLD);
    });

    it("rejects duplicate, zero, and invalid thresholds", async function () {
      const { owner2, owner3 } = await loadFixture(deployFixture);
      const Treasury = await ethers.getContractFactory("MultiSigTreasury");

      await expect(
        Treasury.deploy([owner2.address, owner2.address], 1)
      ).to.be.revertedWithCustomError(
        Treasury,
        "InvalidOwnerConfiguration"
      );
      await expect(
        Treasury.deploy([ethers.ZeroAddress, owner2.address], 1)
      ).to.be.revertedWithCustomError(
        Treasury,
        "InvalidOwnerConfiguration"
      );
      await expect(
        Treasury.deploy([owner2.address, owner3.address], 0)
      ).to.be.revertedWithCustomError(Treasury, "InvalidThreshold");
      await expect(
        Treasury.deploy([owner2.address, owner3.address], 3)
      ).to.be.revertedWithCustomError(Treasury, "InvalidThreshold");
    });

    it("requires two distinct confirmations before execution", async function () {
      const { treasury, deployer, owner2, alice } = await loadFixture(
        deployFixture
      );
      await deployer.sendTransaction({
        to: await treasury.getAddress(),
        value: ethers.parseEther("1")
      });
      const value = ethers.parseEther("0.25");

      await expect(
        treasury.submitTransaction(alice.address, value, "0x")
      ).to.emit(treasury, "TransactionSubmitted");

      await expect(
        treasury.executeTransaction(0)
      ).to.be.revertedWithCustomError(treasury, "InsufficientConfirmations");

      await expect(
        treasury.connect(owner2).confirmTransaction(0)
      ).to.emit(treasury, "TransactionConfirmed");

      await expect(
        treasury.connect(owner2).executeTransaction(0)
      ).to.changeEtherBalances(
        [treasury, alice],
        [-value, value]
      );
    });

    it("blocks duplicate confirmation, outsiders, and replay", async function () {
      const { treasury, deployer, owner2, owner3, alice, outsider } =
        await loadFixture(deployFixture);
      await deployer.sendTransaction({
        to: await treasury.getAddress(),
        value: ethers.parseEther("1")
      });
      await treasury.submitTransaction(alice.address, 1n, "0x");

      await expect(
        treasury.confirmTransaction(0)
      ).to.be.revertedWithCustomError(treasury, "AlreadyConfirmed");
      await expect(
        treasury.connect(outsider).confirmTransaction(0)
      ).to.be.revertedWithCustomError(treasury, "NotOwner");

      await treasury.connect(owner2).confirmTransaction(0);
      await treasury.connect(owner2).executeTransaction(0);
      await expect(
        treasury.connect(owner3).executeTransaction(0)
      ).to.be.revertedWithCustomError(treasury, "TransactionAlreadyExecuted");
    });

    it("rejects a non-zero call to an empty EOA as a no-op transfer", async function () {
      const { treasury, deployer, owner2, bob } = await loadFixture(
        deployFixture
      );
      await deployer.sendTransaction({
        to: await treasury.getAddress(),
        value: ethers.parseEther("1")
      });
      await treasury.submitTransaction(bob.address, ethers.parseEther("1"), "0x");
      await treasury.connect(owner2).confirmTransaction(0);

      await expect(
        treasury.connect(owner2).executeTransaction(0)
      ).to.changeEtherBalance(bob, ethers.parseEther("1"));
    });

    it("records ETH deposits with an event", async function () {
      const { treasury, alice } = await loadFixture(deployFixture);
      await expect(
        alice.sendTransaction({
          to: await treasury.getAddress(),
          value: 123n
        })
      )
        .to.emit(treasury, "Deposit")
        .withArgs(alice.address, 123n);
    });

    it("returns submitted transaction details", async function () {
      const { treasury, alice } = await loadFixture(deployFixture);
      await treasury.submitTransaction(alice.address, 77n, "0x1234");
      const transaction = await treasury.getTransaction(0);

      expect(transaction.to).to.equal(alice.address);
      expect(transaction.value).to.equal(77n);
      expect(transaction.data).to.equal("0x1234");
      expect(transaction.executed).to.equal(false);
      expect(transaction.confirmationCount).to.equal(1n);
    });

    it("rejects reentry into the same transaction", async function () {
      const [deployer, owner3] = await ethers.getSigners();
      const Treasury = await ethers.getContractFactory("MultiSigTreasury");
      const Receiver = await ethers.getContractFactory("ReentrantReceiver");
      const receiver = await Receiver.deploy();
      await receiver.waitForDeployment();
      const treasury = await Treasury.deploy(
        [deployer.address, await receiver.getAddress(), owner3.address],
        2
      );
      await treasury.waitForDeployment();

      await deployer.sendTransaction({
        to: await treasury.getAddress(),
        value: ethers.parseEther("1")
      });
      await treasury.submitTransaction(
        await receiver.getAddress(),
        ethers.parseEther("0.1"),
        "0x"
      );
      await receiver.prepare(await treasury.getAddress(), 0);
      await receiver.confirmAndExecute();

      expect(await receiver.reentryRejected()).to.equal(true);
      expect(await ethers.provider.getBalance(await receiver.getAddress())).to.equal(
        ethers.parseEther("0.1")
      );
    });
  });
});
