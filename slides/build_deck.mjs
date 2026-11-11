import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "outputs");
const WORK = path.join(ROOT, "work", "slides");
const PREVIEW = path.join(WORK, "previews");
const FINAL = path.join(OUT, "SafeVendor_Presentation_v4.pptx");
const SKILL_DIR =
  "/Users/furina/.codex/plugins/cache/openai-primary-runtime/presentations/26.1110.11613/skills/presentations";

await fs.mkdir(OUT, { recursive: true });
await fs.mkdir(PREVIEW, { recursive: true });

const C = {
  paper: "#F4F1E8",
  paperStrong: "#EBE5D8",
  surface: "#FFFDF8",
  ink: "#13231E",
  muted: "#4B5C55",
  line: "#D6D1C4",
  lineStrong: "#AAA99D",
  teal: "#0D6B61",
  tealPale: "#DCEBE7",
  amber: "#C66A12",
  amberPale: "#F7E5CA",
  white: "#FFFFFF",
  danger: "#A43B30",
};

const FONT = "Aptos";

function text(
  slide,
  value,
  x,
  y,
  width,
  height,
  options = {}
) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: options.name,
    position: { left: x, top: y, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = value;
  shape.text.style = {
    fontFamily: options.fontFamily || FONT,
    fontSize: options.fontSize || 18,
    bold: options.bold || false,
    italic: options.italic || false,
    color: options.color || C.ink,
  };
  return shape;
}

function rule(slide, x, y, width, fill = C.lineStrong, thickness = 1) {
  return slide.shapes.add({
    geometry: "line",
    position: { left: x, top: y, width, height: 0 },
    fill: "none",
    line: { style: "solid", fill, width: thickness },
  });
}

function node(
  slide,
  label,
  sublabel,
  x,
  y,
  width,
  height,
  options = {}
) {
  const shape = slide.shapes.add({
    geometry: "roundRect",
    name: options.name,
    position: { left: x, top: y, width, height },
    fill: options.fill || C.surface,
    line: { style: "solid", fill: options.line || C.lineStrong, width: 1.5 },
    borderRadius: 8,
  });
  text(slide, label, x + 18, y + 18, width - 36, 30, {
    fontSize: options.labelSize || 20,
    bold: true,
  });
  text(slide, sublabel, x + 18, y + 56, width - 36, height - 68, {
    fontSize: options.subSize || 14,
    color: options.subColor || C.muted,
  });
  return shape;
}

function arrow(slide, from, to, options = {}) {
  return slide.shapes.connect(from, to, {
    kind: options.kind || "straight",
    fromSide: options.fromSide || "right",
    toSide: options.toSide || "left",
    line: {
      style: "solid",
      fill: options.color || C.teal,
      width: options.width || 2.5,
    },
    tail: {
      type: "triangle",
      width: "sm",
      length: "sm",
    },
  });
}

function footer(slide, number, section = "") {
  rule(slide, 64, 670, 1152, C.line, 1);
  text(slide, "SafeVendor  /  CDS528 Group Project", 64, 682, 460, 20, {
    fontSize: 10,
    color: C.muted,
  });
  text(slide, section, 740, 682, 390, 20, {
    fontSize: 10,
    color: C.muted,
  });
  text(slide, String(number).padStart(2, "0"), 1182, 678, 34, 22, {
    fontSize: 11,
    bold: true,
    color: C.muted,
  });
}

function title(slide, eyebrow, value, options = {}) {
  if (eyebrow) {
    text(slide, eyebrow.toUpperCase(), 64, 45, 760, 22, {
      fontSize: 10,
      bold: true,
      color: options.accent || C.teal,
    });
  }
  text(slide, value, 64, options.top || 78, options.width || 1080, options.height || 112, {
    fontSize: options.fontSize || 40,
    bold: options.bold !== undefined ? options.bold : false,
    color: options.color || C.ink,
    fontFamily: "Aptos Display",
  });
}

function metric(slide, value, label, x, y, width = 220) {
  text(slide, value, x, y, width, 54, {
    fontSize: 40,
    fontFamily: "Aptos Display",
    color: C.ink,
  });
  rule(slide, x, y + 64, width - 16, C.amber, 3);
  text(slide, label, x, y + 76, width, 34, {
    fontSize: 12,
    color: C.muted,
  });
}

function styleTable(table, options = {}) {
  table.borders.assign({
    style: "solid",
    fill: C.line,
    width: 1,
  });
  table.styleOptions = {
    headerRow: true,
    bandedRows: true,
  };
  for (let row = 0; row < table.rows.length; row++) {
    for (let col = 0; col < table.columns.length; col++) {
      const cell = table.getCell(row, col);
      cell.fill =
        row === 0 ? C.ink : row % 2 === 0 ? "#F1F0EA" : C.surface;
      cell.text.style = {
        fontFamily: FONT,
        fontSize: options.fontSize || 14,
        bold: row === 0,
        color: row === 0 ? C.white : C.ink,
      };
    }
  }
}

async function image(slide, imagePath, x, y, width, height, fit = "cover") {
  const bytes = await fs.readFile(imagePath);
  return slide.images.add({
    blob: bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ),
    contentType: "image/png",
    alt: path.basename(imagePath),
    fit,
    position: { left: x, top: y, width, height },
    geometry: "roundRect",
    borderRadius: 6,
  });
}

const presentation = Presentation.create({
  slideSize: { width: 1280, height: 720 },
  theme: {
    fonts: {
      heading: FONT,
      body: FONT
    }
  }
});

// 1. Cover
{
  const slide = presentation.slides.add();
  slide.background.fill = C.ink;
  rule(slide, 64, 62, 112, C.amber, 4);
  text(slide, "CDS528 / DEFI SMART CONTRACT DEVELOPMENT", 64, 82, 760, 26, {
    fontSize: 11,
    bold: true,
    color: C.amberPale,
  });
  text(slide, "SafeVendor", 64, 176, 900, 110, {
    fontSize: 66,
    fontFamily: "Aptos Display",
    color: C.paper,
  });
  text(
    slide,
    "A fixed-price token sale where every payment settles directly into a 2-of-3 treasury",
    64,
    312,
    800,
    116,
    {
      fontSize: 25,
      color: "#D8D4C9",
    }
  );
  rule(slide, 64, 515, 1152, "#3F4D48", 1);
  text(slide, "SEPOLIA  /  CHAIN ID 11155111", 64, 542, 410, 24, {
    fontSize: 12,
    bold: true,
    color: C.amberPale,
  });
  text(slide, "Group Name and ID", 64, 594, 420, 28, {
    fontSize: 17,
    bold: true,
    color: C.paper,
  });
  text(slide, "Members: add final presenter names", 64, 624, 520, 24, {
    fontSize: 13,
    color: "#ABB5B0",
  });
  text(slide, "18 November 2026", 1000, 594, 216, 28, {
    fontSize: 16,
    color: C.paper,
  });
  text(slide, "github.com/furina0508x-glitch/safevendor-cds528", 880, 618, 336, 38, {
    fontSize: 10,
    color: "#ABB5B0",
  });
  slide.speakerNotes.text =
    "0:00-0:45. Introduce the project and state the central design claim: sale proceeds never enter a seller-controlled account. Add the group name and presenter names before submission.";
}

// 2. Problem
{
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;
  title(
    slide,
    "Problem statement",
    "Buyers should not have to trust the seller's next step",
    { fontSize: 38, width: 1030, height: 100 }
  );
  text(
    slide,
    "A conventional token sale asks buyers to send ETH to an operator, then relies on a promise that the funds will later reach shared custody.",
    64,
    205,
    600,
    112,
    { fontSize: 21, color: C.ink }
  );
  text(
    slide,
    "A database records the promise. It cannot make the transfer non-discretionary.",
    64,
    342,
    570,
    84,
    { fontSize: 17, color: C.muted }
  );
  rule(slide, 690, 198, 1, C.lineStrong, 1);
  text(slide, "Custody gap", 750, 210, 420, 32, {
    fontSize: 11,
    bold: true,
    color: C.amber,
  });
  text(slide, "1 person", 750, 258, 380, 62, {
    fontSize: 46,
    fontFamily: "Aptos Display",
  });
  text(slide, "controls the money before shared custody exists", 750, 332, 390, 84, {
    fontSize: 20,
    color: C.muted,
  });
  const promise = node(
    slide,
    "Seller promise",
    "off-chain and discretionary",
    750,
    452,
    235,
    106,
    { fill: C.surface, line: C.amber }
  );
  const treasury = node(
    slide,
    "Treasury",
    "not yet funded",
    1050,
    452,
    180,
    106,
    { fill: C.paperStrong, line: C.lineStrong }
  );
  const connector = arrow(slide, promise, treasury, {
    color: C.amber,
    fromSide: "right",
    toSide: "left",
  });
  connector.line = { style: "dashed", fill: C.amber, width: 2 };
  text(slide, "Buyer goal: make this path automatic", 64, 579, 560, 30, {
    fontSize: 16,
    bold: true,
    color: C.teal,
  });
  footer(slide, 2, "Problem");
  slide.speakerNotes.text =
    "0:45-2:15. Define the users and the custody gap. Explain why a conventional database cannot enforce the later transfer. End on the design requirement: settlement and shared custody must happen in one transaction.";
}

// 3. Architecture
{
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;
  title(slide, "Solution design", "Three contracts, one settlement path", {
    fontSize: 39,
  });
  text(
    slide,
    "ETH never lands in a seller-controlled account.",
    64,
    162,
    760,
    34,
    { fontSize: 18, color: C.muted }
  );
  const buyer = node(
    slide,
    "Buyer",
    "pays ETH\nreceives SVT",
    64,
    264,
    220,
    132,
    { fill: C.surface, line: C.teal }
  );
  const vendor = node(
    slide,
    "TokenVendor",
    "fixed price\natomic settlement",
    380,
    244,
    330,
    172,
    { fill: C.tealPale, line: C.teal }
  );
  const treasury = node(
    slide,
    "MultiSigTreasury",
    "2-of-3 custody\nproposal execution",
    840,
    244,
    360,
    172,
    { fill: C.amberPale, line: C.amber }
  );
  const recipient = node(
    slide,
    "Recipient",
    "receives funds only after 2 confirmations",
    870,
    508,
    290,
    102,
    { fill: C.surface, line: C.lineStrong, subSize: 13 }
  );
  arrow(slide, buyer, vendor, { color: C.teal });
  arrow(slide, vendor, treasury, { color: C.amber });
  arrow(slide, treasury, recipient, {
    color: C.ink,
    kind: "straight",
    fromSide: "bottom",
    toSide: "top",
  });
  text(slide, "ETH + minimum token output", 284, 220, 130, 40, {
    fontSize: 12,
    bold: true,
    color: C.teal,
  });
  text(slide, "net ETH to Treasury", 696, 220, 152, 40, {
    fontSize: 12,
    bold: true,
    color: C.amber,
  });
  text(slide, "SVT delivery", 256, 416, 160, 26, {
    fontSize: 13,
    bold: true,
    color: C.teal,
  });
  text(
    slide,
    "Fixed owners  /  Threshold 2  /  No upgrade path  /  No pause key",
    64,
    610,
    1050,
    30,
    { fontSize: 14, color: C.muted }
  );
  footer(slide, 3, "Solution design");
  slide.speakerNotes.text =
    "2:15-3:30. Walk left to right. The vendor prices and checks the purchase, but the ETH path terminates at Treasury. The buyer receives SVT. Treasury can send funds only after two distinct confirmations.";
}

// 4. Purchase flow
{
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;
  title(slide, "Implementation", "Purchase is atomic", { fontSize: 40 });
  text(
    slide,
    "If the treasury transfer, refund, or token delivery fails, the complete purchase reverts.",
    64,
    162,
    900,
    34,
    { fontSize: 18, color: C.muted }
  );
  rule(slide, 128, 346, 1008, C.lineStrong, 2);
  const steps = [
    {
      number: "01",
      label: "Quote",
      body: "Math.mulDiv converts ETH into token units at the immutable price.",
      x: 72
    },
    {
      number: "02",
      label: "Check",
      body: "Reject zero payment, slippage, and insufficient inventory.",
      x: 358
    },
    {
      number: "03",
      label: "Settle",
      body: "Forward net ETH to Treasury; refund the integer remainder.",
      x: 644
    },
    {
      number: "04",
      label: "Deliver",
      body: "Transfer SVT with SafeERC20 and emit TokensPurchased.",
      x: 930
    }
  ];
  for (const step of steps) {
    const dot = slide.shapes.add({
      geometry: "ellipse",
      position: { left: step.x, top: 320, width: 54, height: 54 },
      fill: C.teal,
      line: { style: "solid", fill: C.teal, width: 1 },
    });
    text(slide, step.number, step.x + 7, 334, 42, 22, {
      fontSize: 12,
      bold: true,
      color: C.white,
    });
    text(slide, step.label, step.x, 402, 220, 34, {
      fontSize: 24,
      bold: true,
    });
    text(slide, step.body, step.x, 450, 220, 104, {
      fontSize: 15,
      color: C.muted,
    });
  }
  rule(slide, 64, 590, 1152, C.amber, 3);
  text(
    slide,
    "The seller can supply inventory, but cannot withdraw sale ETH from the vendor.",
    64,
    608,
    1080,
    30,
    { fontSize: 17, bold: true, color: C.ink }
  );
  footer(slide, 4, "Purchase flow");
  slide.speakerNotes.text =
    "3:30-5:00. Explain the four checks and the direct settlement path. Emphasize atomicity: there is no partial success state and no seller custody window.";
}

// 5. Treasury flow
{
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;
  title(
    slide,
    "Shared custody",
    "One owner can propose. One owner cannot move funds.",
    { fontSize: 38, width: 1120 }
  );
  text(slide, "Owner set", 64, 206, 220, 26, {
    fontSize: 11,
    bold: true,
    color: C.teal,
  });
  const owners = [
    { label: "Owner 1", sub: "submits + confirms", y: 244, fill: C.tealPale },
    { label: "Owner 2", sub: "second confirmation", y: 348, fill: C.tealPale },
    { label: "Owner 3", sub: "backup approval", y: 452, fill: C.surface }
  ];
  for (const owner of owners) {
    const circle = slide.shapes.add({
      geometry: "ellipse",
      position: { left: 64, top: owner.y, width: 64, height: 64 },
      fill: owner.fill,
      line: { style: "solid", fill: C.teal, width: 1.5 },
    });
    text(slide, "O", 85, owner.y + 18, 24, 25, {
      fontSize: 15,
      bold: true,
      color: C.teal,
    });
    text(slide, owner.label, 148, owner.y + 2, 190, 28, {
      fontSize: 19,
      bold: true,
    });
    text(slide, owner.sub, 148, owner.y + 32, 230, 26, {
      fontSize: 13,
      color: C.muted,
    });
  }
  rule(slide, 406, 220, 1, C.lineStrong, 1);
  text(slide, "Execution sequence", 500, 206, 300, 26, {
    fontSize: 11,
    bold: true,
    color: C.amber,
  });
  const sequence = [
    { n: "1", title: "Submit", body: "Records first confirmation", y: 262 },
    { n: "2", title: "Confirm", body: "A different owner adds the threshold vote", y: 374 },
    { n: "3", title: "Execute", body: "Any owner calls; executed is set before the external call", y: 486 }
  ];
  for (const item of sequence) {
    const num = slide.shapes.add({
      geometry: "roundRect",
      position: { left: 500, top: item.y, width: 58, height: 58 },
      fill: C.ink,
      line: { style: "solid", fill: C.ink, width: 1 },
      borderRadius: 8,
    });
    text(slide, item.n, 518, item.y + 14, 24, 24, {
      fontSize: 17,
      bold: true,
      color: C.white,
    });
    text(slide, item.title, 590, item.y, 210, 32, {
      fontSize: 25,
      bold: true,
    });
    text(slide, item.body, 590, item.y + 36, 440, 60, {
      fontSize: 15,
      color: C.muted,
    });
  }
  text(slide, "THRESHOLD", 1084, 282, 120, 22, {
    fontSize: 10,
    bold: true,
    color: C.amber,
  });
  text(slide, "2 / 3", 1084, 306, 120, 56, {
    fontSize: 38,
    bold: true,
    color: C.amber,
  });
  text(
    slide,
    "Residual risk: two compromised owners can collude. Availability requires at least two live owner keys.",
    64,
    604,
    1100,
    34,
    { fontSize: 14, color: C.muted }
  );
  footer(slide, 5, "Treasury flow");
  slide.speakerNotes.text =
    "5:00-6:30. Explain the submit, confirm, execute sequence. Submission is the first vote. A second distinct owner is required. Mention key loss and collusion assumptions.";
}

// 6. Security
{
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;
  title(slide, "Testing and security", "Security is enforced at the state boundary", {
    fontSize: 37,
    width: 1130
  });
  const table = slide.tables.add({
    rows: 7,
    columns: 3,
    left: 64,
    top: 190,
    width: 1152,
    height: 390,
    columnWidths: [230, 395, 527],
    values: [
      ["Threat", "Attack path", "Control"],
      ["Single-owner exfiltration", "One owner tries to move funds", "2-of-3 threshold"],
      ["Replay", "Execute the same proposal twice", "executed set before the call"],
      ["Duplicate approval", "One owner votes repeatedly", "per-owner confirmation map"],
      ["Unauthorized action", "Non-owner submits or executes", "onlyOwner checks"],
      ["Payment ambiguity", "Rounding or failed transfer", "minimum output + atomic revert"],
      ["Reentrancy", "Recipient re-enters during ETH delivery", "CEI + ReentrancyGuard"]
    ]
  });
  styleTable(table, { fontSize: 14 });
  table.rows[0].height = 44;
  text(
    slide,
    "Static scan: two INFO-level low-level call findings; both are required and both return flags are checked.",
    64,
    610,
    1110,
    30,
    { fontSize: 14, color: C.muted }
  );
  footer(slide, 6, "Security");
  slide.speakerNotes.text =
    "6:30-8:00. Focus on the state transition controls, not a generic list of attacks. The two Slither findings are informational and intentional.";
}

// 7. Evidence metrics
{
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;
  title(slide, "Verification", "The implementation is tested and verified", {
    fontSize: 39
  });
  metric(slide, "17", "tests passing", 64, 210, 230);
  metric(slide, "100%", "line coverage", 350, 210, 230);
  metric(slide, "3", "verified contracts", 636, 210, 230);
  metric(slide, "0", "High / Medium findings", 922, 210, 270);
  rule(slide, 64, 382, 1152, C.line, 1);
  text(slide, "What the tests cover", 64, 420, 270, 30, {
    fontSize: 11,
    bold: true,
    color: C.teal,
  });
  text(
    slide,
    "successful purchase, rounding refunds, slippage, inventory limits, invalid configuration, duplicate approval, replay, unauthorized access, and reentrancy",
    64,
    458,
    500,
    136,
    { fontSize: 20, color: C.ink }
  );
  text(slide, "Why the scan is credible", 692, 420, 270, 30, {
    fontSize: 11,
    bold: true,
    color: C.amber,
  });
  text(
    slide,
    "Slither analyzed the reduced production scope with dependencies excluded. The complete command and raw output are stored in the repository.",
    692,
    458,
    480,
    136,
    { fontSize: 20, color: C.ink }
  );
  text(slide, "Coverage", 64, 622, 120, 24, {
    fontSize: 11,
    bold: true,
    color: C.muted,
  });
  text(slide, "Statements 100%   Functions 100%   Lines 100%   Branch 79.03%", 164, 620, 700, 30, {
    fontSize: 15,
    color: C.muted,
  });
  footer(slide, 7, "Verification");
  slide.speakerNotes.text =
    "8:00-9:00. Give the evidence, not a claim. Mention 17 tests, full production line and function coverage, three verified contracts, and the two INFO findings.";
}

// 8. Deployment
{
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;
  title(slide, "Deployment and DevOps", "Sepolia deployment is live and reproducible", {
    fontSize: 36,
    width: 1130
  });
  const table = slide.tables.add({
    rows: 4,
    columns: 3,
    left: 64,
    top: 190,
    width: 700,
    height: 220,
    columnWidths: [220, 320, 160],
    values: [
      ["Contract", "Address", "State"],
      ["SafeVendorToken", "0x69D7…C4deeA", "Verified"],
      ["MultiSigTreasury", "0x53C6…19F13d", "Verified"],
      ["TokenVendor", "0x6030…7d519A", "Verified"]
    ]
  });
  styleTable(table, { fontSize: 12.5 });
  table.rows[0].height = 38;
  text(
    slide,
    "Deployment order",
    64,
    456,
    270,
    28,
    { fontSize: 11, bold: true, color: C.teal }
  );
  text(
    slide,
    "Token  →  Treasury  →  Vendor  →  Inventory",
    64,
    492,
    670,
    42,
    { fontSize: 24, bold: true }
  );
  text(
    slide,
    "pnpm compile  /  pnpm test  /  pnpm deploy  /  pnpm verify",
    64,
    548,
    740,
    28,
    { fontSize: 14, color: C.muted }
  );
  text(
    slide,
    "Generated deployment metadata:\naddresses, constructor data, receipts, and frontend config",
    64,
    602,
    650,
    54,
    { fontSize: 14, color: C.muted }
  );
  if (await fs.stat(path.join(ROOT, "work/evidence/etherscan-treasury-verified.png")).then(() => true).catch(() => false)) {
    await image(
      slide,
      path.join(ROOT, "work/evidence/etherscan-treasury-verified.png"),
      812,
      190,
      404,
      228,
      "cover"
    );
    text(slide, "Etherscan: matching bytecode and ABI", 812, 430, 404, 28, {
      fontSize: 12,
      color: C.muted,
    });
  }
  text(slide, "Ops stance", 812, 492, 180, 24, {
    fontSize: 11,
    bold: true,
    color: C.amber,
  });
  text(
    slide,
    "Immutable by choice: no pause, proxy, owner replacement, or threshold setter. Defects require redeployment.",
    812,
    526,
    404,
    84,
    { fontSize: 15, color: C.ink }
  );
  footer(slide, 8, "Deployment");
  slide.speakerNotes.text =
    "9:00-10:00. Show that live deployment and source verification are complete. State the immutable operations choice and its trade-off.";
}

// 9. Demo screenshot
{
  const slide = presentation.slides.add();
  slide.background.fill = C.paper;
  title(slide, "Live demonstration", "The dApp exposes the complete workflow", {
    fontSize: 38,
    width: 1050
  });
  const screenshot = path.join(ROOT, "work/report/frontend-report.png");
  await image(slide, screenshot, 64, 180, 640, 462, "contain");
  text(slide, "Sepolia state", 758, 190, 260, 28, {
    fontSize: 11,
    bold: true,
    color: C.teal,
  });
  text(slide, "999,900", 758, 228, 330, 58, {
    fontSize: 42,
    fontFamily: "Aptos Display",
  });
  text(slide, "SVT still available", 758, 284, 330, 28, {
    fontSize: 14,
    color: C.muted,
  });
  text(slide, "0.009 ETH", 758, 338, 330, 58, {
    fontSize: 42,
    fontFamily: "Aptos Display",
  });
  text(slide, "Treasury balance after the demo transfer", 758, 394, 366, 38, {
    fontSize: 14,
    color: C.muted,
  });
  text(slide, "Proposal #0", 758, 460, 330, 42, {
    fontSize: 30,
    bold: true,
  });
  text(slide, "2 / 2 confirmed  /  Executed", 758, 506, 366, 30, {
    fontSize: 16,
    color: C.teal,
  });
  text(
    slide,
    "The transaction evidence is real: 0.01 ETH bought 100 SVT, then two owners approved a 0.001 ETH treasury transfer.",
    64,
    632,
    1140,
    32,
    { fontSize: 13, color: C.muted }
  );
  footer(slide, 9, "Live demo");
  slide.speakerNotes.text =
    "10:00-11:30. Switch to the dApp only if the live wallet connection is stable. Otherwise use the screenshot and Etherscan receipts. Walk through purchase, proposal, confirmation, execution, and post-state.";
}

// 10. Conclusion
{
  const slide = presentation.slides.add();
  slide.background.fill = C.ink;
  text(slide, "CONCLUSION", 64, 55, 260, 24, {
    fontSize: 10,
    bold: true,
    color: C.amberPale,
  });
  text(slide, "The trust boundary is smaller by design", 64, 94, 1100, 92, {
    fontSize: 42,
    fontFamily: "Aptos Display",
    color: C.paper,
  });
  rule(slide, 64, 222, 1152, "#43514C", 1);
  const points = [
    {
      n: "01",
      title: "Atomic settlement",
      body: "Payment, custody, and token delivery share one transaction."
    },
    {
      n: "02",
      title: "Shared control",
      body: "One owner cannot move treasury funds alone."
    },
    {
      n: "03",
      title: "Public evidence",
      body: "Source, tests, deployment, and verification are reproducible."
    }
  ];
  for (let i = 0; i < points.length; i++) {
    const x = 64 + i * 380;
    text(slide, points[i].n, x, 270, 60, 26, {
      fontSize: 12,
      bold: true,
      color: C.amber,
    });
    text(slide, points[i].title, x, 312, 320, 38, {
      fontSize: 25,
      bold: true,
      color: C.paper,
    });
    text(slide, points[i].body, x, 368, 320, 74, {
      fontSize: 16,
      color: "#CBD0CC",
    });
  }
  rule(slide, 64, 498, 1152, "#43514C", 1);
  text(slide, "Known limits", 64, 524, 200, 24, {
    fontSize: 11,
    bold: true,
    color: C.amberPale,
  });
  text(
    slide,
    "Sepolia only  /  fixed price  /  immutable  /  no pause or recovery  /  key management remains operational",
    64,
    558,
    1120,
    30,
    { fontSize: 15, color: "#CBD0CC" }
  );
  text(slide, "Questions", 64, 626, 200, 36, {
    fontSize: 26,
    bold: true,
    color: C.paper,
  });
  text(slide, "Thank you", 1010, 626, 206, 36, {
    fontSize: 26,
    color: C.amberPale,
  });
  slide.speakerNotes.text =
    "11:30-12:00. Close on the smaller trust boundary. State the limitations without hiding them, then hand over to Q&A. Keep the Etherscan links ready.";
}

// Export previews.
for (const [index, slide] of presentation.slides.items.entries()) {
  const png = await presentation.export({ slide, format: "png", scale: 1 });
  const bytes = new Uint8Array(await png.arrayBuffer());
  await fs.writeFile(
    path.join(PREVIEW, `slide-${String(index + 1).padStart(2, "0")}.png`),
    bytes
  );
}

// Export candidate and run the local finalizer.
const stagingDir = path.join(ROOT, ".codex-finalizer");
await fs.mkdir(stagingDir, { recursive: true });
const candidatePath = path.join(stagingDir, "SafeVendor_Presentation.candidate.pptx");
await (await PresentationFile.exportPptx(presentation)).save(candidatePath);

const { finalizePresentation } = await import(
  pathToFileURL(
    path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")
  ).href
);

const result = await finalizePresentation({
  explicitTotalSlideCount: 10,
  requiredNativeTableOwnerSlides: [6, 8],
  requiredNativeChartOwnerSlides: [],
  workspaceDir: ROOT,
  candidatePath,
  finalPath: FINAL,
  pythonExecutable:
    "/Users/furina/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3",
  integrityValidatorPath: path.join(
    SKILL_DIR,
    "container_tools/inspect_presentation_package_integrity.py"
  ),
  layoutValidatorPath: path.join(
    SKILL_DIR,
    "container_tools/inspect_presentation_layout_geometry.py"
  ),
  layoutArgs: [
    "--expected-slide-size-emu",
    "12192000,6858000",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
    "--require-native-table-slide",
    "6",
    "--require-native-table-slide",
    "8",
  ],
  fontPolicy: {
    basis: "design",
    families: ["Arial"]
  },
  verifyArtifactToolImport: true,
  receiptPath: path.join(
    stagingDir,
    "SafeVendor_Presentation_v4.validation.json"
  )
});

console.log(JSON.stringify(result, null, 2));
console.log(FINAL);
