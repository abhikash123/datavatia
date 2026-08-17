# BMW Parts Sourcing & Margin Tool

Answers one question: **for a given part, what does it actually cost me to land in
the US, and what do I actually make per unit after tariffs and eBay fees?**

Phase 1 (this version) is the landed-cost and margin engine. Later phases add
market data (Terapeak CSV + eBay Browse API), scoring, and a compliance checker.

---

## Setup (for someone who hasn't used Python much)

You need Python 3.11 or newer. Check with:

```bash
python3 --version
```

If that prints something older than 3.11, install a newer Python from
[python.org](https://www.python.org/downloads/) first.

Then, from a terminal, in this folder (`bmw_parts_tool`):

```bash
# 1. Create a "virtual environment" -- a private folder of Python packages for
#    this project, so it can't break anything else on your computer.
python3 -m venv .venv

# 2. Turn it on. You do this every time you open a new terminal.
source .venv/bin/activate          # macOS / Linux
# .venv\Scripts\activate           # Windows PowerShell

# 3. Install what the tool needs.
pip install -r requirements.txt
```

You'll know the virtual environment is on because your prompt starts with `(.venv)`.

---

## Using it

List the parts currently in `config.yaml`:

```bash
python -m bmw_parts.cli list
```

Full cost breakdown for one part:

```bash
python -m bmw_parts.cli quote b58-charge-pipe
```

Compare everything at a glance:

```bash
python -m bmw_parts.cli quote --all --summary
```

Play with the numbers without editing the config — what if I sell higher and
order more?

```bash
python -m bmw_parts.cli quote b58-charge-pipe --sell-price 189 --qty 40
```

Sample output:

```
LANDED COST PER UNIT
  Supplier cost                                 $45.00
  Freight                                       $41.64
    (air: chargeable 9.25 lb/unit (actual 3.00, dim 9.25 @ /166))
  MFN duty                                       $1.12
  Section 301                                   $11.25
  Section 232 (steel/aluminum)                  $22.50
  Broker entry fee (/20)                         $7.50
  Customs bond (/20)                             $3.00
  TOTAL LANDED COST                            $132.01
```

---

## `config.yaml` is the whole point

**Every rate lives in `config.yaml`. There are no rates in the Python code.**
Tariffs move constantly, so when something changes you edit one line of YAML and
never touch code.

Each rate block carries two fields:

- `last_verified: 2026-08-17` — the day *you* last confirmed the number. Older
  than 90 days (configurable) and the tool warns you it's stale.
- `verified: false` — means "this is a placeholder to get the tool running".
  The tool prints a warning every single time it uses one.

**Everything ships as `verified: false` on purpose.** The seeded duty rates are
plausible for auto parts (2.5% MFN, Section 301 List 3 at 25%) but classification
is legally your responsibility as the importer. Confirm each line with your
customs broker, then flip `verified: true` and set today's date. Until you do,
every quote will be loudly caveated — which is correct.

### Adding a part

Add an entry under `skus:` in `config.yaml`:

```yaml
  - id: my-new-part                 # short name you'll type on the command line
    name: "Human readable name"
    supplier_unit_cost: 45.00       # what Alibaba quoted you, per unit
    moq: 20                         # minimum order quantity
    unit_weight_lbs: 3.0
    dims_in: [24, 8, 8]             # packed length, width, height in inches
    freight_mode: air               # air | ocean
    hts_code: "8708.99.8180"        # must exist under hts_codes: below
    metal: aluminum                 # steel | aluminum | none
    metal_content_fraction: 1.0     # share of value that is that metal, 0.0-1.0
    target_sell_price: 149.00
    outbound_shipping_usd: 12.00    # your cost to ship it to the buyer
```

If the HTS code isn't already in the `hts_codes:` table, the tool refuses to
quote rather than guessing a duty rate. Add the code with rates you've confirmed.

---

## How the numbers are worked out

**Freight**

- *Air* bills on **chargeable weight** — the greater of actual weight and
  dimensional weight (L × W × H ÷ 166). This is why a 3 lb charge pipe in a
  24×8×8 box bills like 9.25 lb.
- *Ocean* is estimated on volume (cubic feet).
- Both have a shipment minimum charge, spread across the order. If your order is
  too small to fill the minimum, the tool says so.

**Duties** are charged on the customs value of the goods — for a normal FOB
purchase, what you paid the supplier, not including international freight.
Confirm that for your terms.

- MFN duty and Section 301 rates both come from the `hts_codes` table, keyed by
  the code you declare.
- **Section 232** (steel/aluminum) only applies when you flag a SKU as `steel`
  or `aluminum`. It's charged on the value of the *declared metal content*, not
  automatically the whole entered value — that's the `metal_content_fraction`
  field. Whether your HTS line is even on the derivative list is a question for
  your broker. Getting this wrong in either direction is expensive.

**Broker entry fee and customs bond** are per-shipment costs, divided across the
order. Small orders carry an ugly amount of this per unit — a 10-unit order of a
$150 entry fee is $15/unit before anything else.

**Break-even units** is how many you must sell to get your cash back: the total
order cost divided by the contribution per sale (sale price minus fees, shipping
and return allowance). Landed cost isn't in that divisor because once the order
is on your shelf, that money is already spent.

**ROI** assumes every unit sells at the target price. It won't. Treat it as a
ceiling, not a forecast — Phase 2 adds real sold-price data to replace the
guessed `target_sell_price` values.

---

## Tests

The landed-cost math is the part where a bug costs real money, so it's tested
line by line against numbers worked out by hand:

```bash
python -m pytest -q
```

---

## Secrets

Copy `.env.example` to `.env` and fill it in. `.env` and the database file are
git-ignored. Nothing in Phase 1 needs credentials; the eBay keys are for Phase 2.

---

## Status

- [x] **Phase 1** — landed cost + margin engine
- [ ] Phase 2 — market data (Terapeak CSV import, eBay Browse API)
- [ ] Phase 3 — scoring and ranking
- [ ] Phase 4 — compliance flags
