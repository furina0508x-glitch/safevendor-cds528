import { ethers } from "ethers";
import {
  createIcons,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Coins,
  Copy,
  ExternalLink,
  Landmark,
  Network,
  RefreshCw,
  Send,
  ShieldCheck,
  UserCheck,
  Wallet
} from "lucide";
import deployment from "./deployment.json";
import "./style.css";

createIcons({
  icons: {
    AlertTriangle,
    ArrowRight,
    CheckCircle2,
    CircleDot,
    Coins,
    Copy,
    ExternalLink,
    Landmark,
    Network,
    RefreshCw,
    Send,
    ShieldCheck,
    UserCheck,
    Wallet
  }
});

const SEPOLIA_CHAIN_ID = 11155111n;
const EXPLORER = "https://sepolia.etherscan.io";

const tokenAbi = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)"
];

const treasuryAbi = [
  "function threshold() view returns (uint256)",
  "function transactionCount() view returns (uint256)",
  "function getOwners() view returns (address[])",
  "function isOwner(address) view returns (bool)",
  "function isConfirmed(uint256,address) view returns (bool)",
  "function submitTransaction(address to,uint256 value,bytes data) returns (uint256)",
  "function confirmTransaction(uint256 transactionId)",
  "function executeTransaction(uint256 transactionId)",
  "function getTransaction(uint256) view returns (tuple(address to,uint256 value,bytes data,bool executed,uint256 confirmationCount))"
];

const vendorAbi = [
  "function pricePerToken() view returns (uint256)",
  "function quote(uint256 ethAmount) view returns (uint256)",
  "function buyTokens(uint256 minTokensOut) payable"
];

const state = {
  provider: null,
  signer: null,
  account: null,
  token: null,
  treasury: null,
  vendor: null,
  pricePerToken: 0n,
  threshold: 2n,
  isOwner: false,
  toastTimer: null
};

const el = {
  connectButton: document.querySelector("#connectButton"),
  networkChip: document.querySelector("#networkChip"),
  networkLabel: document.querySelector("#networkLabel"),
  statusNetwork: document.querySelector("#statusNetwork"),
  treasuryBalance: document.querySelector("#treasuryBalance"),
  vendorInventory: document.querySelector("#vendorInventory"),
  thresholdStatus: document.querySelector("#thresholdStatus"),
  pricePerToken: document.querySelector("#pricePerToken"),
  totalSupply: document.querySelector("#totalSupply"),
  quoteOutput: document.querySelector("#quoteOutput"),
  walletBalance: document.querySelector("#walletBalance"),
  walletStatus: document.querySelector("#walletStatus"),
  ethAmount: document.querySelector("#ethAmount"),
  minTokensOut: document.querySelector("#minTokensOut"),
  buyForm: document.querySelector("#buyForm"),
  buyButton: document.querySelector("#buyButton"),
  refreshButton: document.querySelector("#refreshButton"),
  treasuryForm: document.querySelector("#treasuryForm"),
  proposeButton: document.querySelector("#proposeButton"),
  recipient: document.querySelector("#recipient"),
  treasuryAmount: document.querySelector("#treasuryAmount"),
  ownerList: document.querySelector("#ownerList"),
  transactions: document.querySelector("#transactions"),
  contractRows: document.querySelector("#contractRows"),
  toast: document.querySelector("#toast")
};

function hasDeployment() {
  return Boolean(
    deployment.token?.address &&
      deployment.treasury?.address &&
      deployment.vendor?.address
  );
}

function shortAddress(address, start = 6, end = 4) {
  if (!address || address.length < start + end + 2) return address || "-";
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}

function formatAmount(value, digits = 4) {
  const numeric = Number(ethers.formatEther(value));
  if (!Number.isFinite(numeric)) return "0";
  return numeric.toLocaleString("en-US", {
    maximumFractionDigits: digits
  });
}

function showToast(message, type = "success") {
  window.clearTimeout(state.toastTimer);
  el.toast.textContent = message;
  el.toast.className = `toast visible ${type === "error" ? "error" : ""}`;
  state.toastTimer = window.setTimeout(() => {
    el.toast.className = "toast";
  }, 5000);
}

function errorMessage(error) {
  return (
    error?.shortMessage ||
    error?.reason ||
    error?.info?.error?.message ||
    error?.message ||
    "Transaction failed"
  );
}

function setBusy(button, busy, label = "Working...") {
  if (!button.dataset.originalLabel) {
    button.dataset.originalLabel =
      button.querySelector("span")?.textContent || button.textContent;
  }
  button.disabled = busy;
  const labelNode = button.querySelector("span");
  if (labelNode) {
    labelNode.textContent = busy ? label : button.dataset.originalLabel;
  }
}

async function ensureSepolia() {
  if (!window.ethereum) {
    throw new Error("Install MetaMask or another EVM wallet to transact.");
  }
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (BigInt(chainId) === SEPOLIA_CHAIN_ID) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xaa36a7" }]
    });
  } catch (error) {
    if (error.code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: "0xaa36a7",
          chainName: "Sepolia",
          nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
          blockExplorerUrls: [EXPLORER]
        }
      ]
    });
  }
}

function bindContracts(withSigner = false) {
  const runner = withSigner ? state.signer : state.provider;
  if (!runner || !hasDeployment()) return;
  state.token = new ethers.Contract(
    deployment.token.address,
    tokenAbi,
    runner
  );
  state.treasury = new ethers.Contract(
    deployment.treasury.address,
    treasuryAbi,
    runner
  );
  state.vendor = new ethers.Contract(
    deployment.vendor.address,
    vendorAbi,
    runner
  );
}

async function connectWallet() {
  try {
    await ensureSepolia();
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts"
    });
    state.provider = new ethers.BrowserProvider(window.ethereum);
    state.signer = await state.provider.getSigner();
    state.account = accounts[0];
    bindContracts(true);

    const connectLabel = el.connectButton.querySelector("span");
    connectLabel.textContent = shortAddress(state.account);
    el.walletStatus.textContent = "Connected to Sepolia";
    await refreshData();
    showToast("Wallet connected to Sepolia.");
  } catch (error) {
    showToast(errorMessage(error), "error");
  }
}

async function loadReadOnlyProvider() {
  if (state.provider) return;
  state.provider = new ethers.JsonRpcProvider(
    "https://ethereum-sepolia-rpc.publicnode.com",
    SEPOLIA_CHAIN_ID,
    { staticNetwork: true }
  );
  bindContracts(false);
}

async function updateQuote() {
  if (!state.vendor) return;
  try {
    const amount = Number(el.ethAmount.value || 0);
    if (amount <= 0) {
      el.quoteOutput.textContent = "0";
      return;
    }
    const quote = await state.vendor.quote(ethers.parseEther(String(amount)));
    el.quoteOutput.textContent = formatAmount(quote, 6);
  } catch {
    el.quoteOutput.textContent = "0";
  }
}

function renderOwnerList(owners) {
  el.ownerList.innerHTML = "";
  owners.forEach((owner) => {
    const item = document.createElement("div");
    item.className = "owner-item";
    item.innerHTML = '<i data-lucide="user-check"></i><span></span>';
    item.querySelector("span").textContent = owner;
    item.title = owner;
    el.ownerList.appendChild(item);
  });
  createIcons({
    icons: { UserCheck }
  });
}

function renderContracts() {
  if (!hasDeployment()) return;
  const rows = [
    ["SafeVendorToken", deployment.token.address],
    ["MultiSigTreasury", deployment.treasury.address],
    ["TokenVendor", deployment.vendor.address]
  ];
  el.contractRows.innerHTML = "";

  rows.forEach(([name, address]) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const addressCell = document.createElement("td");
    const linkCell = document.createElement("td");
    const link = document.createElement("a");

    nameCell.textContent = name;
    addressCell.className = "mono";
    addressCell.textContent = shortAddress(address, 10, 8);
    addressCell.title = address;
    link.className = "explorer-link";
    link.href = `${EXPLORER}/address/${address}`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.innerHTML = '<span>Etherscan</span><i data-lucide="external-link"></i>';

    linkCell.appendChild(link);
    row.append(nameCell, addressCell, linkCell);
    el.contractRows.appendChild(row);
  });
  createIcons({ icons: { ExternalLink } });
}

async function loadTransactions() {
  if (!state.treasury) return;
  const count = await state.treasury.transactionCount();
  if (count === 0n) {
    el.transactions.innerHTML =
      '<div class="empty-state">No treasury proposals yet.</div>';
    return;
  }

  const start = count > 6n ? count - 6n : 0n;
  const rows = [];
  for (let id = count - 1n; id >= start; id--) {
    const tx = await state.treasury.getTransaction(id);
    if (!state.isOwner) {
      rows.push(renderTransaction(id, tx, false));
      continue;
    }
    const confirmed = await state.treasury.isConfirmed(id, state.account);
    rows.push(renderTransaction(id, tx, confirmed));
  }
  el.transactions.innerHTML = rows.join("");
}

function renderTransaction(id, tx, confirmed) {
  const isExecuted = tx.executed;
  const confirmationCount = tx.confirmationCount;
  let action = "";
  if (!isExecuted && state.isOwner && !confirmed) {
    action = `<button class="tx-action" data-action="confirm" data-id="${id}">Confirm</button>`;
  } else if (
    !isExecuted &&
    state.isOwner &&
    confirmationCount >= state.threshold
  ) {
    action = `<button class="tx-action" data-action="execute" data-id="${id}">Execute</button>`;
  } else {
    action = `<span class="tx-state">${isExecuted ? "Executed" : "Pending"}</span>`;
  }

  return `
    <div class="transaction-row">
      <span class="tx-id">#${id}</span>
      <div class="tx-main">
        <strong title="${tx.to}">${shortAddress(tx.to, 8, 6)}</strong>
        <span>${formatAmount(tx.value, 5)} ETH</span>
      </div>
      <span class="tx-state">${confirmationCount} / ${state.threshold} confirmed</span>
      ${action}
    </div>
  `;
}

async function refreshData() {
  el.refreshButton.disabled = true;
  try {
    await loadReadOnlyProvider();
    if (!hasDeployment()) {
      el.statusNetwork.textContent = "Deployment pending";
      return;
    }
    if (state.signer) {
      bindContracts(true);
    }

    const [
      price,
      threshold,
      treasuryBalance,
      inventory,
      totalSupply,
      owners
    ] = await Promise.all([
      state.vendor.pricePerToken(),
      state.treasury.threshold(),
      state.provider.getBalance(deployment.treasury.address),
      state.token.balanceOf(deployment.vendor.address),
      state.token.totalSupply(),
      state.treasury.getOwners()
    ]);

    state.pricePerToken = price;
    state.threshold = threshold;
    state.isOwner = state.account
      ? await state.treasury.isOwner(state.account)
      : false;

    el.statusNetwork.textContent = "Sepolia / 11155111";
    el.networkLabel.textContent = "Sepolia";
    el.treasuryBalance.textContent = `${formatAmount(treasuryBalance, 4)} ETH`;
    el.vendorInventory.textContent = `${formatAmount(inventory, 2)} SVT`;
    el.thresholdStatus.textContent = `${threshold.toString()} of ${owners.length}`;
    el.pricePerToken.textContent = ethers.formatEther(price);
    el.totalSupply.textContent = `${formatAmount(totalSupply, 0)} SVT`;

    if (state.account) {
      const balance = await state.token.balanceOf(state.account);
      el.walletBalance.textContent = formatAmount(balance, 4);
      el.walletStatus.textContent = state.isOwner
        ? "Owner access detected"
        : "Buyer account";
    }

    renderOwnerList(owners);
    renderContracts();
    await Promise.all([updateQuote(), loadTransactions()]);
  } catch (error) {
    showToast(errorMessage(error), "error");
  } finally {
    el.refreshButton.disabled = false;
  }
}

async function buyTokens(event) {
  event.preventDefault();
  try {
    if (!state.signer) {
      await connectWallet();
      if (!state.signer) return;
    }
    const ethAmount = el.ethAmount.value;
    if (!ethAmount || Number(ethAmount) <= 0) {
      throw new Error("Enter an ETH amount greater than zero.");
    }
    const minTokens = ethers.parseEther(el.minTokensOut.value || "0");
    const quote = await state.vendor.quote(ethers.parseEther(ethAmount));

    setBusy(el.buyButton, true, "Confirm in wallet...");
    const tx = await state.vendor.buyTokens(minTokens, {
      value: ethers.parseEther(ethAmount)
    });
    showToast(`Transaction submitted: ${shortAddress(tx.hash)}`);
    setBusy(el.buyButton, true, "Settling...");
    await tx.wait();
    showToast(`Purchase complete. ${formatAmount(quote, 4)} SVT received.`);
    await refreshData();
  } catch (error) {
    showToast(errorMessage(error), "error");
  } finally {
    setBusy(el.buyButton, false);
  }
}

async function proposeTransfer(event) {
  event.preventDefault();
  try {
    if (!state.signer) {
      await connectWallet();
      if (!state.signer) return;
    }
    if (!ethers.isAddress(el.recipient.value)) {
      throw new Error("Enter a valid recipient address.");
    }
    if (!el.treasuryAmount.value || Number(el.treasuryAmount.value) <= 0) {
      throw new Error("Enter an ETH amount greater than zero.");
    }

    setBusy(el.proposeButton, true, "Confirm in wallet...");
    const tx = await state.treasury.submitTransaction(
      el.recipient.value,
      ethers.parseEther(el.treasuryAmount.value),
      "0x"
    );
    showToast(`Proposal submitted: ${shortAddress(tx.hash)}`);
    await tx.wait();
    el.treasuryForm.reset();
    await refreshData();
  } catch (error) {
    showToast(errorMessage(error), "error");
  } finally {
    setBusy(el.proposeButton, false);
  }
}

async function handleTransactionAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button || !state.signer) return;
  const id = BigInt(button.dataset.id);
  const action = button.dataset.action;

  try {
    button.disabled = true;
    button.textContent = "Confirm...";
    const tx =
      action === "confirm"
        ? await state.treasury.confirmTransaction(id)
        : await state.treasury.executeTransaction(id);
    showToast(`Transaction ${shortAddress(tx.hash)} submitted.`);
    await tx.wait();
    showToast(`Proposal #${id} ${action === "confirm" ? "confirmed" : "executed"}.`);
    await refreshData();
  } catch (error) {
    showToast(errorMessage(error), "error");
    button.disabled = false;
    button.textContent = action === "confirm" ? "Confirm" : "Execute";
  }
}

async function copyAddress(address) {
  try {
    await navigator.clipboard.writeText(address);
    showToast("Address copied.");
  } catch {
    showToast("Clipboard access is unavailable.", "error");
  }
}

el.connectButton.addEventListener("click", connectWallet);
el.buyForm.addEventListener("submit", buyTokens);
el.treasuryForm.addEventListener("submit", proposeTransfer);
el.ethAmount.addEventListener("input", updateQuote);
el.refreshButton.addEventListener("click", refreshData);
el.transactions.addEventListener("click", handleTransactionAction);
el.contractRows.addEventListener("click", (event) => {
  const addressCell = event.target.closest("td.mono");
  if (addressCell?.title) copyAddress(addressCell.title);
});

if (window.ethereum) {
  window.ethereum.on?.("accountsChanged", () => window.location.reload());
  window.ethereum.on?.("chainChanged", () => window.location.reload());
}

refreshData();
