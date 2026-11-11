from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK, WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "outputs"
WORK = ROOT / "work" / "report"
OUTPUT.mkdir(exist_ok=True)
WORK.mkdir(parents=True, exist_ok=True)

DOCX_PATH = OUTPUT / "SafeVendor_Project_Report.docx"
ARCH_PATH = WORK / "architecture.png"
FRONTEND_SHOT = ROOT / "work" / "evidence" / "frontend-desktop.png"
FRONTEND_REPORT_SHOT = WORK / "frontend-report.png"
ETHERSCAN_SHOT = ROOT / "work" / "evidence" / "etherscan-treasury-verified.png"

TOKEN_ADDRESS = "0x69D7f801AA1EB37321B6F7C1843E380c76C4deeA"
TREASURY_ADDRESS = "0x53C6F389B8773C9C74b275BCb2B55ba4C119F13d"
VENDOR_ADDRESS = "0x6030d8D8674f96F3e8BF9dCe5AF74b65247d519A"

INK = RGBColor(17, 31, 26)
MUTED = RGBColor(79, 92, 86)
TEAL = "0D6B61"
TEAL_LIGHT = "DCEBE7"
AMBER = "C66A12"
AMBER_LIGHT = "F7E5CA"
GRAY = "E9E7DF"
GRAY_DARK = "D4D1C7"
BLACK = RGBColor(0, 0, 0)


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_border(cell, color="D6D1C4", size="4"):
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = f"w:{edge}"
        element = borders.find(qn(tag))
        if element is None:
            element = OxmlElement(tag)
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)


def add_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = paragraph.add_run()
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = "PAGE"
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char1)
    run._r.append(instr_text)
    run._r.append(fld_char2)


def add_hyperlink(paragraph, text, url, color="0D6B61", underline=True):
    part = paragraph.part
    relationship_id = part.relate_to(
        url,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
        is_external=True,
    )
    hyperlink = OxmlElement("w:hyperlink")
    hyperlink.set(qn("r:id"), relationship_id)
    new_run = OxmlElement("w:r")
    run_properties = OxmlElement("w:rPr")
    run_color = OxmlElement("w:color")
    run_color.set(qn("w:val"), color)
    run_properties.append(run_color)
    if underline:
        underline_element = OxmlElement("w:u")
        underline_element.set(qn("w:val"), "single")
        run_properties.append(underline_element)
    new_run.append(run_properties)
    text_element = OxmlElement("w:t")
    text_element.text = text
    new_run.append(text_element)
    hyperlink.append(new_run)
    paragraph._p.append(hyperlink)


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    table_header = OxmlElement("w:tblHeader")
    table_header.set(qn("w:val"), "true")
    tr_pr.append(table_header)


def style_table(table, widths=None, font_size=9.5):
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    for row_idx, row in enumerate(table.rows):
        if row_idx == 0:
            set_repeat_table_header(row)
        for col_idx, cell in enumerate(row.cells):
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_border(cell)
            if widths:
                cell.width = Inches(widths[col_idx])
            if row_idx == 0:
                set_cell_shading(cell, "172B25")
            elif row_idx % 2 == 0:
                set_cell_shading(cell, "F1F0EA")
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.space_after = Pt(0)
                paragraph.paragraph_format.line_spacing = 1.05
                for run in paragraph.runs:
                    run.font.name = "Aptos"
                    run.font.size = Pt(font_size)
                    if row_idx == 0:
                        run.font.color.rgb = RGBColor(255, 255, 255)
                        run.font.bold = True


def add_table(doc, headers, rows, widths, font_size=9.5):
    table = doc.add_table(rows=1, cols=len(headers))
    hdr = table.rows[0].cells
    for i, header in enumerate(headers):
        hdr[i].text = header
    for row in rows:
        cells = table.add_row().cells
        for i, value in enumerate(row):
            cells[i].text = str(value)
    style_table(table, widths=widths, font_size=font_size)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table


def add_caption(doc, text):
    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.space_before = Pt(2)
    paragraph.paragraph_format.space_after = Pt(8)
    run = paragraph.add_run(text)
    run.font.name = "Aptos"
    run.font.size = Pt(9)
    run.font.color.rgb = MUTED
    run.font.italic = True


def add_bullets(doc, items):
    for item in items:
        paragraph = doc.add_paragraph(style="List Bullet")
        paragraph.paragraph_format.left_indent = Inches(0.25)
        paragraph.paragraph_format.space_after = Pt(3)
        paragraph.add_run(item)


def add_metric_row(doc, metrics):
    table = doc.add_table(rows=2, cols=len(metrics))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, (value, label) in enumerate(metrics):
        top = table.cell(0, i)
        bottom = table.cell(1, i)
        set_cell_shading(top, "F4F1E8")
        set_cell_shading(bottom, "F4F1E8")
        set_cell_border(top)
        set_cell_border(bottom)
        top.text = value
        bottom.text = label
        top.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        bottom.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
        for run in top.paragraphs[0].runs:
            run.font.name = "Aptos Display"
            run.font.size = Pt(19)
            run.font.bold = True
            run.font.color.rgb = INK
        for run in bottom.paragraphs[0].runs:
            run.font.name = "Aptos"
            run.font.size = Pt(9)
            run.font.color.rgb = MUTED
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def make_architecture_diagram(path):
    width, height = 1800, 760
    image = Image.new("RGB", (width, height), "#F5F2E9")
    draw = ImageDraw.Draw(image)
    font_path = "/System/Library/Fonts/Supplemental/Arial.ttf"
    bold_path = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
    font = ImageFont.truetype(font_path, 34)
    bold = ImageFont.truetype(bold_path, 42)
    small = ImageFont.truetype(font_path, 28)

    def box(x, y, w, h, label, sublabel, fill):
        draw.rounded_rectangle(
            (x, y, x + w, y + h),
            radius=18,
            fill=fill,
            outline="#17302A",
            width=3,
        )
        label_box = draw.textbbox((0, 0), label, font=bold)
        draw.text(
            (x + (w - (label_box[2] - label_box[0])) / 2, y + 36),
            label,
            font=bold,
            fill="#13231E",
        )
        sub_box = draw.textbbox((0, 0), sublabel, font=small)
        draw.text(
            (x + (w - (sub_box[2] - sub_box[0])) / 2, y + 100),
            sublabel,
            font=small,
            fill="#4B5C55",
        )

    box(70, 240, 330, 190, "Buyer", "pays ETH, receives SVT", "#FFFFFF")
    box(520, 170, 410, 330, "TokenVendor", "fixed price + atomic settlement", "#DCEBE7")
    box(1120, 240, 400, 190, "Treasury", "2-of-3 shared custody", "#F7E5CA")
    box(1120, 580, 400, 100, "Recipient", "executes after 2 confirms", "#FFFFFF")

    draw.line((400, 335, 520, 335), fill="#0D6B61", width=8)
    draw.polygon([(520, 335), (495, 320), (495, 350)], fill="#0D6B61")
    draw.text((415, 285), "ETH", font=small, fill="#0D6B61")

    draw.line((930, 335, 1120, 335), fill="#C66A12", width=8)
    draw.polygon([(1120, 335), (1095, 320), (1095, 350)], fill="#C66A12")
    draw.text((990, 285), "proceeds", font=small, fill="#C66A12")

    draw.arc((760, 385, 1050, 585), 30, 145, fill="#0D6B61", width=7)
    draw.polygon([(805, 455), (780, 445), (790, 475)], fill="#0D6B61")
    draw.text((790, 470), "SVT", font=small, fill="#0D6B61")

    draw.line((1320, 430, 1320, 580), fill="#17302A", width=6)
    draw.polygon([(1320, 580), (1305, 552), (1335, 552)], fill="#17302A")
    draw.text((1350, 490), "execute", font=small, fill="#17302A")

    draw.text((70, 55), "SafeVendor settlement architecture", font=bold, fill="#13231E")
    draw.text(
        (72, 110),
        "Sale payments never accumulate in a seller-controlled account.",
        font=font,
        fill="#4B5C55",
    )
    image.save(path)


def make_frontend_crop(source, target):
    image = Image.open(source).convert("RGB")
    crop = image.crop((0, 0, image.width, min(image.height, 1080)))
    crop.save(target, quality=95)


def configure_document(doc):
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.72)
    section.bottom_margin = Inches(0.72)
    section.left_margin = Inches(0.82)
    section.right_margin = Inches(0.82)
    section.header_distance = Inches(0.32)
    section.footer_distance = Inches(0.32)

    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Aptos"
    normal.font.size = Pt(12)
    normal.font.color.rgb = INK
    normal.paragraph_format.space_after = Pt(7)
    normal.paragraph_format.line_spacing = 1.18

    for name, size, before, after in [
        ("Title", 28, 0, 18),
        ("Heading 1", 19, 14, 8),
        ("Heading 2", 14, 10, 5),
        ("Heading 3", 12, 8, 4),
    ]:
        style = styles[name]
        style.font.name = "Aptos Display" if name == "Title" else "Aptos"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = BLACK
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True

    header = section.header
    header_para = header.paragraphs[0]
    header_para.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    header_run = header_para.add_run("CDS528 Group Project  /  SafeVendor")
    header_run.font.name = "Aptos"
    header_run.font.size = Pt(8.5)
    header_run.font.color.rgb = MUTED

    footer = section.footer
    footer_para = footer.paragraphs[0]
    footer_para.add_run("Sepolia test assets only  |  ")
    add_page_number(footer_para)
    for run in footer_para.runs:
        run.font.name = "Aptos"
        run.font.size = Pt(8.5)
        run.font.color.rgb = MUTED


def add_cover(doc):
    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.space_before = Pt(26)
    run = paragraph.add_run("CDS528 GROUP PROJECT")
    run.font.name = "Aptos"
    run.font.size = Pt(10)
    run.font.bold = True
    run.font.color.rgb = RGBColor(13, 107, 97)

    title = doc.add_paragraph(style="Title")
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.add_run("SafeVendor")

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.paragraph_format.space_after = Pt(20)
    subtitle_run = subtitle.add_run(
        "A trust-minimized token sale with direct 2-of-3 treasury settlement"
    )
    subtitle_run.font.name = "Aptos Display"
    subtitle_run.font.size = Pt(18)
    subtitle_run.font.color.rgb = MUTED

    repo = doc.add_paragraph()
    repo.alignment = WD_ALIGN_PARAGRAPH.CENTER
    repo.add_run("Repository: ").bold = True
    add_hyperlink(
        repo,
        "https://github.com/furina0508x-glitch/safevendor-cds528",
        "https://github.com/furina0508x-glitch/safevendor-cds528",
    )

    doc.add_paragraph()
    add_metric_row(
        doc,
        [
            ("1,000,000", "fixed SVT supply"),
            ("2 of 3", "treasury approvals"),
            ("0.0001 ETH", "price per SVT"),
            ("17", "automated tests"),
        ],
    )

    metadata = [
        ("Course", "CDS528 Blockchain DeFi Smart Contract Development"),
        ("Group", "[Group Name and ID]"),
        ("Members", "[Add all member names]"),
        ("Network", "Ethereum Sepolia, chain ID 11155111"),
        ("Submission", "18 November 2026"),
    ]
    add_table(
        doc,
        ["Item", "Submission information"],
        metadata,
        [1.45, 5.35],
        font_size=10.5,
    )

    intro = doc.add_paragraph()
    intro.paragraph_format.space_before = Pt(14)
    intro.paragraph_format.line_spacing = 1.22
    intro.add_run(
        "SafeVendor addresses a concrete token-sale custody problem: buyers must "
        "currently trust a seller or operator to hold sale proceeds and later honor "
        "withdrawals. The design removes that trust window by sending ETH directly "
        "to a fixed-owner multisig treasury in the same transaction that delivers "
        "the token. The deployed system is test-only, publicly verified, and fully "
        "documented for reproduction."
    )


def add_section_1(doc):
    doc.add_page_break()
    doc.add_heading("1. Problem Statement", level=1)
    doc.add_heading("1.1 Context and users", level=2)
    doc.add_paragraph(
        "The primary users are small project teams or DAOs that want a simple "
        "fixed-price token sale, and buyers who want assurance that sale proceeds "
        "do not remain under one person's control. The secondary user is the "
        "three-person treasury group responsible for spending proceeds after the "
        "sale."
    )
    doc.add_paragraph(
        "A conventional custody flow asks buyers to send ETH to a seller-controlled "
        "address, after which the seller promises to transfer the funds into a shared "
        "account. The buyer cannot enforce that later step. A database can record the "
        "promise, but it cannot make the subsequent transfer non-discretionary."
    )

    doc.add_heading("1.2 Problem statement", level=2)
    doc.add_paragraph(
        "How can a fixed-price ERC-20 sale guarantee that every successful purchase "
        "settles into shared custody without allowing a seller, deployer, or single "
        "treasury member to redirect or withdraw the proceeds unilaterally?"
    )

    doc.add_heading("1.3 Why a smart contract", level=2)
    add_bullets(
        doc,
        [
            "Settlement is atomic: the payment, treasury deposit, and token delivery "
            "either all succeed or all revert.",
            "The 2-of-3 threshold is enforced by code rather than by an off-chain policy.",
            "Token supply, price, owners, and threshold are publicly inspectable and "
            "cannot be silently changed after deployment.",
            "Buyers can verify the deployed bytecode and contract state on Etherscan.",
        ],
    )

    doc.add_heading("1.4 Goals and scope", level=2)
    add_table(
        doc,
        ["Goal", "Success condition"],
        [
            (
                "Direct settlement",
                "Every successful buy sends ETH to Treasury with no seller withdrawal path.",
            ),
            (
                "Shared control",
                "Two distinct owners must confirm before any Treasury transfer executes.",
            ),
            (
                "Safe failure",
                "Wrong payment, insufficient inventory, and failed transfers revert.",
            ),
            (
                "Reproducibility",
                "A new user can install, test, deploy, and verify from the README.",
            ),
        ],
        [2.0, 4.8],
    )

    doc.add_heading("1.5 Constraints and assumptions", level=2)
    add_bullets(
        doc,
        [
            "Sepolia only; all assets are test assets with no monetary value.",
            "Fixed supply of one million SVT; there is no post-deployment mint.",
            "Three fixed treasury owners and a threshold of two.",
            "No proxy, upgrade path, pause switch, or owner replacement.",
            "The sale price does not follow a market oracle; it is a teaching mechanism.",
        ],
    )


def add_section_2(doc):
    doc.add_page_break()
    doc.add_heading("2. Solution Design", level=1)
    doc.add_heading("2.1 Architecture and roles", level=2)
    doc.add_paragraph(
        "SafeVendor separates three responsibilities. The token contract owns only "
        "the fixed supply. The vendor owns the sale rule and inventory. The treasury "
        "owns shared custody and transaction approval. No contract can upgrade or "
        "replace another contract after deployment."
    )
    doc.add_picture(str(ARCH_PATH), width=Inches(6.65))
    add_caption(doc, "Figure 1. Sale payments settle directly in the multisig treasury.")

    add_table(
        doc,
        ["Actor", "On-chain capability", "Trust boundary"],
        [
            (
                "Buyer",
                "Calls buyTokens with ETH and a minimum SVT output.",
                "Does not need to trust a seller address with custody.",
            ),
            (
                "Treasury owner",
                "Submits, confirms, and executes proposals when threshold is met.",
                "One owner is insufficient; two can collude.",
            ),
            (
                "Seller",
                "Supplies token inventory; has no vendor withdrawal function.",
                "Cannot retrieve sale ETH from the vendor.",
            ),
            (
                "Frontend",
                "Reads state and prepares wallet transactions.",
                "Cannot bypass contract access control.",
            ),
        ],
        [1.2, 2.75, 2.8],
        font_size=9.2,
    )

    doc.add_heading("2.2 Mechanism and token rationale", level=2)
    doc.add_paragraph(
        "ERC-20 is appropriate because the sale needs a fungible unit that any wallet "
        "can hold and transfer. SafeVendorToken uses OpenZeppelin ERC20 and mints the "
        "entire one-million-token supply once. It deliberately omits owner-only mint "
        "and burn functions, preventing post-sale supply dilution."
    )
    doc.add_paragraph(
        "The vendor stores the token address, treasury address, and price as immutable "
        "values. A fixed price is feasible for this teaching scope and avoids oracle "
        "complexity. The design's distinctive property is not a new token standard. "
        "It is the settlement combination: a familiar vendor pattern whose proceeds "
        "flow into a multisig that no single operator controls."
    )

    doc.add_heading("2.3 Key process flows", level=2)
    add_table(
        doc,
        ["Purchase flow", "Treasury flow"],
        [
            (
                "1. Buyer sends ETH and minTokensOut.",
                "1. Owner submits a recipient, value, and calldata.",
            ),
            (
                "2. Vendor quotes the fixed-price token amount.",
                "2. Submission records the first owner confirmation.",
            ),
            (
                "3. Vendor checks inventory and slippage.",
                "3. A different owner confirms the proposal.",
            ),
            (
                "4. Vendor sends net ETH to Treasury.",
                "4. Execution requires confirmation count >= 2.",
            ),
            (
                "5. Vendor transfers SVT and emits an event.",
                "5. Executed is set before the external call.",
            ),
        ],
        [3.25, 3.25],
    )

    doc.add_heading("2.4 On-chain and off-chain partition", level=2)
    doc.add_paragraph(
        "Trust-critical state and value transfer stay on-chain: balances, ownership, "
        "confirmations, execution state, and ETH movement. The optional Vite frontend "
        "stays off-chain because it only reads chain state and prepares signed "
        "transactions. There is no server-side custodian or backend signing key."
    )


def add_section_3(doc):
    doc.add_heading("3. Implementation", level=1)
    doc.add_heading("3.1 Core mechanisms", level=2)
    add_table(
        doc,
        ["Mechanism", "Implementation", "Why it matters"],
        [
            (
                "Fixed supply",
                "One constructor mint; immutable maxSupply.",
                "No post-deployment dilution.",
            ),
            (
                "Fixed price",
                "Math.mulDiv converts ETH amount to token units; minimum output protects the buyer.",
                "Deterministic sale terms.",
            ),
            (
                "Direct settlement",
                "Checked native call forwards net ETH to Treasury before token delivery.",
                "No seller custody window.",
            ),
            (
                "2-of-3 execution",
                "Per-owner confirmation mapping and immutable threshold.",
                "One owner cannot move funds.",
            ),
            (
                "Replay protection",
                "Executed state is set before the external call.",
                "A transaction cannot execute twice.",
            ),
            (
                "Reentrancy protection",
                "CEI plus OpenZeppelin ReentrancyGuard.",
                "External calls cannot re-enter value paths.",
            ),
        ],
        [1.5, 3.0, 2.0],
        font_size=9.0,
    )

    doc.add_heading("3.2 Events and access control", level=2)
    doc.add_paragraph(
        "Token and vendor behavior uses standard ERC-20 Transfer events and a custom "
        "TokensPurchased event with gross payment, net settlement, refund, and token "
        "amount. Treasury emits Deposit, TransactionSubmitted, TransactionConfirmed, "
        "and TransactionExecuted. The event set is sufficient to reconstruct each "
        "purchase and approval sequence from logs."
    )
    doc.add_paragraph(
        "Treasury submission, confirmation, and execution are guarded by onlyOwner. "
        "The owner mapping and fixed owner array are initialized once. The vendor has "
        "no privileged withdrawal function, so even the deployer cannot retrieve its "
        "sale ETH."
    )

    doc.add_heading("3.3 Gas-awareness and code quality", level=2)
    add_bullets(
        doc,
        [
            "Immutable token, treasury, price, threshold, and max supply avoid storage reads.",
            "The only loop is bounded owner initialization at deployment time.",
            "Small custom errors replace long revert strings.",
            "The optimizer is enabled with 200 runs.",
            "Events expose value-bearing state changes without requiring historical storage.",
            "Code is split by responsibility and uses OpenZeppelin components rather than "
            "reimplementing token, transfer, and reentrancy primitives.",
        ],
    )

    doc.add_heading("3.4 Frontend integration", level=2)
    doc.add_paragraph(
        "The dApp displays live Sepolia state, quotes a purchase, collects wallet "
        "signatures, submits treasury proposals, and exposes owner confirm and execute "
        "actions. It reads deployment metadata from a generated JSON file, so the "
        "interface cannot silently point at a different contract set."
    )
    if FRONTEND_SHOT.exists():
        make_frontend_crop(FRONTEND_SHOT, FRONTEND_REPORT_SHOT)
        doc.add_picture(str(FRONTEND_REPORT_SHOT), width=Inches(6.0))
        add_caption(doc, "Figure 2. Operational dApp displaying live Sepolia sale and treasury state.")


def add_section_4(doc):
    doc.add_page_break()
    doc.add_heading("4. Testing and Security", level=1)
    doc.add_heading("4.1 Verification results", level=2)
    add_metric_row(
        doc,
        [
            ("17", "tests passing"),
            ("100%", "production line coverage"),
            ("100%", "function coverage"),
            ("2", "Slither INFO findings"),
        ],
    )
    doc.add_paragraph(
        "The test suite exercises successful behavior and failure paths, including "
        "duplicate confirmation, unauthorized callers, replay, slippage, insufficient "
        "inventory, invalid configuration, rounding refunds, and reentrancy. Production "
        "contracts have 100 percent statement, function, and line coverage. Aggregate "
        "branch coverage is 79.03 percent."
    )

    doc.add_heading("4.2 Static analysis", level=2)
    doc.add_paragraph(
        "Slither analyzed 18 compiled contracts with 100 detectors after excluding "
        "OpenZeppelin dependencies and the test-only receiver. It reported no High or "
        "Medium severity findings. The two project-level findings are informational "
        "low-level call findings."
    )
    add_table(
        doc,
        ["Finding", "Location", "Decision"],
        [
            (
                "Low-level call",
                "MultiSigTreasury.executeTransaction",
                "Required for arbitrary approved calldata and contract wallets; success is checked.",
            ),
            (
                "Low-level call",
                "TokenVendor.buyTokens",
                "Required for ETH settlement and refunds; both return flags are checked.",
            ),
        ],
        [1.45, 2.15, 2.9],
        font_size=9.2,
    )

    doc.add_heading("4.3 Top threats and mitigations", level=2)
    add_table(
        doc,
        ["Threat", "Attack path", "Mitigation and residual risk"],
        [
            (
                "Single-owner exfiltration",
                "One compromised owner submits and executes a transfer.",
                "2-of-3 threshold blocks one owner; two colluding owners remain a residual risk.",
            ),
            (
                "Reentrancy",
                "Recipient re-enters during ETH delivery.",
                "CEI plus ReentrancyGuard; the reentry test confirms rejection.",
            ),
            (
                "Replay",
                "Execute the same approved transfer twice.",
                "Executed is checked and set before the call; replay reverts.",
            ),
            (
                "Duplicate approval",
                "One owner confirms repeatedly to reach threshold.",
                "A per-owner, per-transaction confirmation mapping blocks duplicates.",
            ),
            (
                "Unauthorized action",
                "Non-owner submits, confirms, or executes.",
                "OnlyOwner on all treasury state changes.",
            ),
            (
                "Payment ambiguity",
                "Buyer overpays or price rounding differs.",
                "Minimum output and explicit remainder refund; failed sends revert.",
            ),
        ],
        [1.45, 2.3, 2.8],
        font_size=8.8,
    )

    doc.add_heading("4.4 Economic and compliance risks", level=2)
    add_bullets(
        doc,
        [
            "The fixed price is not market-derived and can diverge from any external value.",
            "Three EOAs create key-management risk; the design assumes independent custody.",
            "The absence of an upgrade path prevents patching; migration requires redeployment.",
            "There is no owner-removal mechanism; lost keys reduce availability.",
            "The project must remain on Sepolia and must not be presented as an investment.",
        ],
    )
    if ETHERSCAN_SHOT.exists():
        doc.add_picture(str(ETHERSCAN_SHOT), width=Inches(6.2))
        add_caption(doc, "Figure 3. Etherscan reports matching bytecode and ABI for the treasury.")


def add_section_5(doc):
    doc.add_page_break()
    doc.add_heading("5. Deployment and DevOps", level=1)
    doc.add_heading("5.1 Live Sepolia deployment", level=2)
    doc.add_paragraph(
        "The contracts are deployed on Sepolia and verified on Etherscan with Solidity "
        "0.8.24, optimizer enabled, and 200 runs. Constructor arguments match the live "
        "deployment and the source is available through Standard JSON verification."
    )
    table = doc.add_table(rows=1, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers = table.rows[0].cells
    headers[0].text = "Contract"
    headers[1].text = "Verified Sepolia address"
    records = [
        ("SafeVendorToken", TOKEN_ADDRESS),
        ("MultiSigTreasury", TREASURY_ADDRESS),
        ("TokenVendor", VENDOR_ADDRESS),
    ]
    for name, address in records:
        cells = table.add_row().cells
        cells[0].text = name
        cells[1].text = ""
        add_hyperlink(
            cells[1].paragraphs[0],
            address,
            f"https://sepolia.etherscan.io/address/{address}#code",
        )
    style_table(table, widths=[2.1, 4.4], font_size=10)
    doc.add_paragraph()

    doc.add_heading("5.2 Reproducible deployment", level=2)
    doc.add_paragraph(
        "pnpm deploy validates chain ID 11155111, deploys Token, Treasury, and Vendor "
        "in dependency order, transfers the full inventory, and writes addresses, "
        "transaction hashes, and constructor data to deployments/sepolia.json. The "
        "frontend imports the generated deployment file so UI state and on-chain "
        "contracts stay aligned."
    )
    add_table(
        doc,
        ["Artifact", "Purpose"],
        [
            ("pnpm compile", "Compiles Solidity 0.8.24 with optimized settings."),
            ("pnpm test", "Runs 17 unit and failure-path tests."),
            ("pnpm coverage", "Writes Istanbul coverage reports."),
            ("pnpm deploy", "Deploys and records addresses and receipts."),
            ("pnpm verify", "Verifies constructors through the Etherscan API."),
            ("pnpm frontend:build", "Creates the production Vite bundle."),
        ],
        [2.05, 4.45],
        font_size=9.3,
    )

    doc.add_heading("5.3 Operational readiness", level=2)
    doc.add_paragraph(
        "The contracts deliberately omit pause and upgrade controls. This choice "
        "removes a privileged emergency key and prevents an administrator from freezing "
        "the sale or replacing the treasury. The trade-off is that a logic defect cannot "
        "be patched in place; the team would deploy a new immutable contract set and "
        "inform users."
    )
    doc.add_paragraph(
        "Operationally, two of three owner keys must remain available. Only one may be "
        "offline without blocking execution. Two offline or lost keys halt treasury "
        "spending, while two compromised keys can collude. These conditions are stated "
        "explicitly rather than hidden behind an admin recovery function."
    )

    doc.add_heading("5.4 Live demonstration evidence", level=2)
    add_table(
        doc,
        ["Event", "Observed result"],
        [
            ("Buyer purchase", "0.01 ETH paid; 100 SVT received."),
            ("Settlement", "ETH routed directly to Treasury."),
            ("Proposal", "Owner 1 submitted and automatically confirmed."),
            ("Approval", "Owner 2 added the second distinct confirmation."),
            ("Execution", "0.001 ETH transferred after the threshold was met."),
            ("Post-state", "Proposal marked executed; Treasury balance 0.009 ETH."),
        ],
        [1.8, 4.7],
        font_size=9.5,
    )


def add_section_6(doc):
    doc.add_heading("6. Documentation, Process, and Evaluation", level=1)
    doc.add_heading("6.1 Repository and documentation", level=2)
    doc.add_paragraph(
        "The repository includes source, tests, deployment scripts, a reproducible "
        "README, security evidence, a requirements matrix, a demo script, and the "
        "optional frontend. The readme identifies exact prerequisites, network, commands, "
        "risk controls, and the operational rationale for immutability."
    )
    doc.add_paragraph(
        "The public GitHub URL is on the cover and at the top of the repository README. "
        "The group must confirm instructor and TA read access and add the true group "
        "name, group ID, and member names before Moodle submission."
    )

    doc.add_heading("6.2 Rubric coverage", level=2)
    add_table(
        doc,
        ["Criterion", "Evidence", "Risk"],
        [
            (
                "R1 Problem Statement",
                "Concrete users, custody pain point, why on-chain, scope and assumptions.",
                "Low",
            ),
            (
                "R2 Solution Design",
                "Three-contract architecture, actor table, rationale, purchase and approval flows.",
                "Low",
            ),
            (
                "R3 Implementation",
                "Deployed contracts, events, access control, immutable values, frontend.",
                "Low",
            ),
            (
                "R4 Testing and Security",
                "17 tests, full production line coverage, Slither, threat table.",
                "Low",
            ),
            (
                "R5 Deployment and DevOps",
                "Three verified Sepolia addresses, reproducible scripts, immutability rationale.",
                "Low",
            ),
            (
                "R6 Documentation",
                "README, report, citations, license, AI disclosure.",
                "Medium until group metadata and presenter names are inserted.",
            ),
            (
                "R7 Presentation",
                "Editable slide deck, 12-minute flow, four speaker roles, Q&A preparation.",
                "Medium until real member roles are assigned and rehearsed.",
            ),
        ],
        [1.65, 3.7, 1.15],
        font_size=8.8,
    )

    doc.add_heading("6.3 Team process", level=2)
    add_bullets(
        doc,
        [
            "Project lead: scope, rubric mapping, submission, and timeline control.",
            "Smart contract lead: contract design, deployment, verification, and gas review.",
            "Testing and security analyst: failure-path tests, Slither, assumptions, and Q&A.",
            "Frontend and integration engineer: Vite + ethers.js workflow in the dApp, "
            "wallet flows, and live demonstration.",
            "All members participate in final rehearsal and answer at least one question.",
        ],
    )

    doc.add_heading("6.4 Limitations and future work", level=2)
    doc.add_paragraph(
        "The current project intentionally favors a small auditable scope. Future work "
        "could add an explicit inventory recovery decision, owner rotation with timelocks, "
        "proposal cancellation, richer event indexing, fuzz invariants, and a formal "
        "threat model for market pricing. Those additions would introduce new trust "
        "surfaces and should not be added without matching tests and governance rationale."
    )


def add_section_7(doc):
    doc.add_heading("7. Conclusion", level=1)
    doc.add_paragraph(
        "SafeVendor meets the assignment's central engineering goal. It presents a "
        "concrete DeFi custody problem, implements a complete Solidity system, tests "
        "failure paths, deploys and verifies on Sepolia, provides a usable frontend, and "
        "documents the operational trade-offs. The architecture is deliberately small: "
        "three contracts with clear ownership boundaries and no hidden administrator."
    )
    doc.add_paragraph(
        "The strongest evidence is not a slide claim. It is the live Sepolia state: a "
        "buyer received 100 SVT for 0.01 ETH, proceeds entered the treasury, two distinct "
        "owners confirmed a transfer, and the treasury executed only after the threshold "
        "was met. Etherscan shows the matching source and ABI for all three contracts."
    )
    doc.add_paragraph(
        "Before submission, the group still needs to attach its real public repository "
        "URL and identity metadata. Those administrative fields do not change the "
        "technical result, but they are required by D1, D2, R6, and R7."
    )

    doc.add_heading("References", level=1)
    references = [
        "Ethereum Foundation. (2026). Ethereum developer tutorials. "
        "https://ethereum.org/developers/tutorials/",
        "Ethereum Foundation. (2026). ERC-20 token standard. "
        "https://ethereum.org/developers/docs/standards/tokens/erc-20/",
        "Etherscan. (2026). Ethereum Sepolia block explorer. https://sepolia.etherscan.io/",
        "Nomic Foundation. (2026). Hardhat documentation. https://hardhat.org/docs",
        "OpenZeppelin. (2026). OpenZeppelin Contracts 5.x. "
        "https://docs.openzeppelin.com/contracts/5.x/",
        "Solidity Team. (2024). Solidity 0.8.24 documentation. "
        "https://docs.soliditylang.org/en/v0.8.24/",
        "Trail of Bits. (2026). Slither static analysis. "
        "https://github.com/crytic/slither",
    ]
    for reference in references:
        paragraph = doc.add_paragraph()
        paragraph.paragraph_format.left_indent = Inches(0.3)
        paragraph.paragraph_format.first_line_indent = Inches(-0.3)
        paragraph.paragraph_format.space_after = Pt(5)
        run = paragraph.add_run(reference)
        run.font.name = "Aptos"
        run.font.size = Pt(9.5)

    doc.add_heading("Appendix A. Deployment Addresses", level=1)
    appendix = doc.add_table(rows=1, cols=3)
    appendix.alignment = WD_TABLE_ALIGNMENT.CENTER
    headers = appendix.rows[0].cells
    headers[0].text = "Contract"
    headers[1].text = "Verified address"
    headers[2].text = "Deployment transaction"
    records = [
        (
            "SafeVendorToken",
            TOKEN_ADDRESS,
            "0x230cc3be5f5ead3886ce1ff5ccdc842cbe4831ce455db8ca9715cca849ab34a7",
        ),
        (
            "MultiSigTreasury",
            TREASURY_ADDRESS,
            "0xa1c8b8abc284f6849720e9973048c1ad111610139ccbfcf161af242291dbad4e",
        ),
        (
            "TokenVendor",
            VENDOR_ADDRESS,
            "0xfdf11edf7d8f415c5635191f043155b69b456644599b438b074d50a11dfa8f7e",
        ),
    ]
    for name, address, tx_hash in records:
        cells = appendix.add_row().cells
        cells[0].text = name
        cells[1].text = ""
        cells[2].text = tx_hash
        add_hyperlink(
            cells[1].paragraphs[0],
            address,
            f"https://sepolia.etherscan.io/address/{address}#code",
        )
    style_table(appendix, widths=[1.35, 2.65, 2.5], font_size=7.5)


def main():
    make_architecture_diagram(ARCH_PATH)
    doc = Document()
    configure_document(doc)
    add_cover(doc)
    add_section_1(doc)
    add_section_2(doc)
    add_section_3(doc)
    add_section_4(doc)
    add_section_5(doc)
    add_section_6(doc)
    add_section_7(doc)
    doc.core_properties.title = "SafeVendor Project Report"
    doc.core_properties.subject = "CDS528 Blockchain DeFi Smart Contract Development"
    doc.core_properties.author = "CDS528 SafeVendor Group"
    doc.core_properties.keywords = "DeFi, ERC-20, multisig, Sepolia, smart contracts"
    doc.save(DOCX_PATH)
    print(DOCX_PATH)


if __name__ == "__main__":
    main()
