"""Landed cost + margin engine.

This is the part where a bug costs real money, so it is deliberately boring:
plain functions, no I/O, no network, every rate passed in from config.

The money flow it models, per unit:

    supplier cost
  + freight               (air: chargeable weight; ocean: cubic feet)
  + MFN duty              (rate from the HTS table)
  + Section 301           (rate from the HTS table)
  + Section 232           (only if the SKU is flagged steel/aluminum)
  + broker entry fee      (per shipment, spread over the order)
  + customs bond          (per shipment, spread over the order)
  = LANDED COST PER UNIT

    sale price
  - eBay final value fee  (% of sale price)
  - eBay fixed fee        (per order)
  - promoted listings     (% of sale price)
  - outbound shipping     (what it costs you to ship to the buyer)
  - return allowance      (% of sale price, your reserve)
  - landed cost
  = NET PROFIT PER UNIT
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import date

from .config import Config, Sku, rate_warnings

CUBIC_INCHES_PER_CUBIC_FOOT = 1728.0


@dataclass
class FreightResult:
    per_unit: float
    order_total: float
    basis: str  # human-readable explanation, e.g. "chargeable weight 6.9 lb/unit"
    hit_minimum: bool


@dataclass
class LandedCost:
    order_qty: int
    supplier_cost_per_unit: float
    freight_per_unit: float
    mfn_duty_per_unit: float
    section_301_per_unit: float
    section_232_per_unit: float
    broker_fee_per_unit: float
    bond_per_unit: float
    freight_basis: str

    @property
    def duties_per_unit(self) -> float:
        return self.mfn_duty_per_unit + self.section_301_per_unit + self.section_232_per_unit

    @property
    def total_per_unit(self) -> float:
        return (
            self.supplier_cost_per_unit
            + self.freight_per_unit
            + self.duties_per_unit
            + self.broker_fee_per_unit
            + self.bond_per_unit
        )

    @property
    def order_total(self) -> float:
        return self.total_per_unit * self.order_qty


@dataclass
class SellingCosts:
    final_value_fee: float
    fixed_fee: float
    promoted_listings_fee: float
    outbound_shipping: float
    return_allowance: float

    @property
    def total(self) -> float:
        return (
            self.final_value_fee
            + self.fixed_fee
            + self.promoted_listings_fee
            + self.outbound_shipping
            + self.return_allowance
        )


@dataclass
class Quote:
    sku: Sku
    order_qty: int
    sell_price: float
    landed: LandedCost
    selling: SellingCosts
    warnings: list[str] = field(default_factory=list)

    @property
    def net_profit_per_unit(self) -> float:
        return self.sell_price - self.selling.total - self.landed.total_per_unit

    @property
    def net_margin_pct(self) -> float:
        """Net profit as a percentage of the sale price."""
        if self.sell_price == 0:
            return 0.0
        return 100.0 * self.net_profit_per_unit / self.sell_price

    @property
    def capital_required(self) -> float:
        """Cash you must put up to land one MOQ order on your shelf."""
        return self.landed.order_total

    @property
    def contribution_per_unit(self) -> float:
        """Cash back per sale, ignoring the already-spent landed cost.

        Once the inventory is bought and sitting in your garage, this is what
        each additional sale actually puts in your pocket before you have
        recovered the order.
        """
        return self.sell_price - self.selling.total

    @property
    def break_even_units(self) -> int | None:
        """Units you must sell to recover the cash spent on the order.

        None means the unit economics never recover the order -- every sale
        loses money on its own, before inventory cost.
        """
        if self.contribution_per_unit <= 0:
            return None
        return math.ceil(self.capital_required / self.contribution_per_unit)

    @property
    def roi_pct(self) -> float:
        """Return on the order, assuming every unit sells at the target price."""
        if self.capital_required == 0:
            return 0.0
        return 100.0 * (self.net_profit_per_unit * self.order_qty) / self.capital_required


# ---------------------------------------------------------------------------
# Freight
# ---------------------------------------------------------------------------


def air_freight(sku: Sku, cfg: Config, order_qty: int) -> FreightResult:
    """Air freight, priced on chargeable weight.

    Chargeable weight per unit = the GREATER of actual weight and dimensional
    weight (L x W x H / divisor, divisor from config). Airlines bill whichever
    is bigger, which is why a light bulky charge pipe costs more to fly than
    its 3 lb suggests.

    Note this treats each unit as its own box. Real shipments consolidate into
    cartons, which usually makes actual dim weight a bit *lower* than this --
    so the estimate errs on the conservative (expensive) side. Good.
    """
    rates = cfg.freight("air")
    divisor = float(rates["dim_divisor"])
    length, width, height = sku.dims_in
    dim_weight = (length * width * height) / divisor
    chargeable = max(sku.unit_weight_lbs, dim_weight)

    raw_total = chargeable * order_qty * float(rates["usd_per_lb"])
    minimum = float(rates.get("min_charge_usd", 0.0))
    order_total = max(raw_total, minimum)
    hit_minimum = order_total > raw_total

    basis = (
        f"air: chargeable {chargeable:.2f} lb/unit "
        f"(actual {sku.unit_weight_lbs:.2f}, dim {dim_weight:.2f} @ /{divisor:g})"
    )
    return FreightResult(order_total / order_qty, order_total, basis, hit_minimum)


def ocean_freight(sku: Sku, cfg: Config, order_qty: int) -> FreightResult:
    """Ocean LCL freight, estimated on volume (cubic feet)."""
    rates = cfg.freight("ocean")
    length, width, height = sku.dims_in
    cubic_ft = (length * width * height) / CUBIC_INCHES_PER_CUBIC_FOOT

    raw_total = cubic_ft * order_qty * float(rates["usd_per_cubic_ft"])
    minimum = float(rates.get("min_charge_usd", 0.0))
    order_total = max(raw_total, minimum)
    hit_minimum = order_total > raw_total

    basis = f"ocean: {cubic_ft:.3f} cu ft/unit ({cubic_ft * order_qty:.2f} cu ft total)"
    return FreightResult(order_total / order_qty, order_total, basis, hit_minimum)


def freight_for(sku: Sku, cfg: Config, order_qty: int) -> FreightResult:
    return (air_freight if sku.freight_mode == "air" else ocean_freight)(sku, cfg, order_qty)


# ---------------------------------------------------------------------------
# Duties
# ---------------------------------------------------------------------------


def duties_per_unit(sku: Sku, cfg: Config) -> tuple[float, float, float]:
    """(MFN duty, Section 301, Section 232) per unit, in dollars.

    All three are charged on the customs value of the goods. For a normal FOB
    purchase the customs value is what you paid the supplier -- international
    freight is not part of it. Confirm that with your broker for your terms.
    """
    hts = cfg.hts(sku.hts_code)
    customs_value = sku.supplier_unit_cost

    mfn = customs_value * float(hts["mfn_rate"])
    sec_301 = customs_value * float(hts.get("section_301_rate", 0.0))

    # Section 232 (steel / aluminum derivatives).
    #
    # This is charged on the value of the DECLARED METAL CONTENT of the
    # article, not automatically on the whole entered value -- hence
    # metal_content_fraction. Whether your HTS line is on the derivative list
    # at all is a question for your customs broker; the tool only applies it
    # when you have explicitly flagged the SKU as steel or aluminum.
    sec_232 = 0.0
    s232 = cfg.customs.get("section_232") or {}
    applies_to = s232.get("applies_to") or []
    if sku.metal in applies_to:
        metal_value = customs_value * sku.metal_content_fraction
        sec_232 = metal_value * float(s232.get("rate", 0.0))

    return mfn, sec_301, sec_232


# ---------------------------------------------------------------------------
# Selling costs
# ---------------------------------------------------------------------------


def selling_costs(sku: Sku, cfg: Config, sell_price: float) -> SellingCosts:
    fees = cfg.ebay
    return SellingCosts(
        final_value_fee=sell_price * float(fees["final_value_fee_pct"]),
        fixed_fee=float(fees.get("per_order_fixed_fee_usd", 0.0)),
        promoted_listings_fee=sell_price * float(fees.get("promoted_listings_pct", 0.0)),
        outbound_shipping=sku.outbound_shipping_usd,
        return_allowance=sell_price * float(fees.get("return_allowance_pct", 0.0)),
    )


# ---------------------------------------------------------------------------
# The whole quote
# ---------------------------------------------------------------------------


def quote(
    sku: Sku,
    cfg: Config,
    order_qty: int | None = None,
    sell_price: float | None = None,
    today: date | None = None,
) -> Quote:
    """Full landed-cost + margin breakdown for one SKU.

    order_qty defaults to the SKU's MOQ; sell_price defaults to its target.
    """
    order_qty = order_qty or sku.moq
    if order_qty < 1:
        raise ValueError("order_qty must be at least 1")
    sell_price = sku.target_sell_price if sell_price is None else sell_price

    freight = freight_for(sku, cfg, order_qty)
    mfn, sec_301, sec_232 = duties_per_unit(sku, cfg)

    customs_cfg = cfg.customs
    broker_fee = float(customs_cfg.get("broker_entry_fee_usd", 0.0))
    bond_fee = float((customs_cfg.get("bond") or {}).get("fee_usd", 0.0))

    landed = LandedCost(
        order_qty=order_qty,
        supplier_cost_per_unit=sku.supplier_unit_cost,
        freight_per_unit=freight.per_unit,
        mfn_duty_per_unit=mfn,
        section_301_per_unit=sec_301,
        section_232_per_unit=sec_232,
        # Both of these are per-shipment costs, so they get spread across the
        # order. Small orders carry a nasty amount of this per unit.
        broker_fee_per_unit=broker_fee / order_qty,
        bond_per_unit=bond_fee / order_qty,
        freight_basis=freight.basis,
    )

    q = Quote(
        sku=sku,
        order_qty=order_qty,
        sell_price=sell_price,
        landed=landed,
        selling=selling_costs(sku, cfg, sell_price),
    )
    q.warnings = collect_warnings(q, cfg, freight, today=today)
    return q


def collect_warnings(
    q: Quote, cfg: Config, freight: FreightResult, today: date | None = None
) -> list[str]:
    """Everything the user should eyeball before trusting the number."""
    days = cfg.staleness_days
    out: list[str] = []

    out += rate_warnings(f"freight.{q.sku.freight_mode}", cfg.freight(q.sku.freight_mode), days, today)
    out += rate_warnings(f"hts_codes.{q.sku.hts_code}", cfg.hts(q.sku.hts_code), days, today)
    out += rate_warnings("customs", cfg.customs, days, today)
    out += rate_warnings("customs.bond", cfg.customs.get("bond") or {}, days, today)
    out += rate_warnings("marketplace.ebay", cfg.ebay, days, today)

    if q.landed.section_232_per_unit > 0:
        out += rate_warnings("customs.section_232", cfg.customs.get("section_232") or {}, days, today)
        out.append(
            f"Section 232 applied to {q.sku.metal} content "
            f"({q.sku.metal_content_fraction:.0%} of customs value) -- "
            "CONFIRM applicability and declared metal value with your customs broker"
        )

    if freight.hit_minimum:
        out.append(
            f"Freight hit the shipment minimum -- this order is too small to fill "
            f"the minimum charge, so freight per unit is inflated"
        )

    if q.net_profit_per_unit <= 0:
        out.append("NEGATIVE MARGIN: this SKU loses money at the target sell price")
    elif q.net_margin_pct < 15:
        out.append(f"Thin margin ({q.net_margin_pct:.1f}%) -- little room for error")

    return out
