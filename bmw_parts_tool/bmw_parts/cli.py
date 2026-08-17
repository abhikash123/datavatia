"""Command line interface.

    python -m bmw_parts.cli list
    python -m bmw_parts.cli quote b58-charge-pipe
    python -m bmw_parts.cli quote --all
    python -m bmw_parts.cli quote b58-charge-pipe --sell-price 129 --qty 40
"""

from __future__ import annotations

import argparse
import sys

from .config import Config, ConfigError
from .landed_cost import Quote, quote


def money(x: float) -> str:
    return f"${x:,.2f}"


def line(label: str, value: str, indent: int = 0) -> str:
    pad = " " * indent
    return f"{pad}{label:<38}{value:>14}"


def render(q: Quote) -> str:
    """Human-readable breakdown for one SKU."""
    s = q.sku
    landed = q.landed
    sell = q.selling
    out: list[str] = []

    out.append("=" * 54)
    out.append(f"{s.name}  [{s.id}]")
    out.append(
        f"HTS {s.hts_code} | {s.freight_mode} | {s.unit_weight_lbs:g} lb | "
        f"{s.dims_in[0]:g}x{s.dims_in[1]:g}x{s.dims_in[2]:g} in | metal: {s.metal}"
    )
    out.append(f"Order quantity: {q.order_qty}   Sell price: {money(q.sell_price)}")
    out.append("=" * 54)

    out.append("LANDED COST PER UNIT")
    out.append(line("Supplier cost", money(landed.supplier_cost_per_unit), 2))
    out.append(line("Freight", money(landed.freight_per_unit), 2))
    out.append(f"    ({landed.freight_basis})")
    out.append(line("MFN duty", money(landed.mfn_duty_per_unit), 2))
    out.append(line("Section 301", money(landed.section_301_per_unit), 2))
    out.append(line("Section 232 (steel/aluminum)", money(landed.section_232_per_unit), 2))
    out.append(line(f"Broker entry fee (/{q.order_qty})", money(landed.broker_fee_per_unit), 2))
    out.append(line(f"Customs bond (/{q.order_qty})", money(landed.bond_per_unit), 2))
    out.append(line("TOTAL LANDED COST", money(landed.total_per_unit), 2))
    out.append("")

    out.append("SELLING COSTS PER UNIT")
    out.append(line("eBay final value fee", money(sell.final_value_fee), 2))
    out.append(line("eBay fixed fee", money(sell.fixed_fee), 2))
    out.append(line("Promoted listings", money(sell.promoted_listings_fee), 2))
    out.append(line("Outbound shipping", money(sell.outbound_shipping), 2))
    out.append(line("Return allowance", money(sell.return_allowance), 2))
    out.append(line("TOTAL SELLING COSTS", money(sell.total), 2))
    out.append("")

    out.append("RESULT")
    out.append(line("Sell price", money(q.sell_price), 2))
    out.append(line("Net profit per unit", money(q.net_profit_per_unit), 2))
    out.append(line("Net margin", f"{q.net_margin_pct:.1f}%", 2))
    out.append(line(f"Capital required ({q.order_qty} units)", money(q.capital_required), 2))
    out.append(line("Contribution per sale", money(q.contribution_per_unit), 2))
    be = q.break_even_units
    out.append(
        line(
            "Break-even units",
            "never" if be is None else f"{be} of {q.order_qty}",
            2,
        )
    )
    out.append(line("ROI if all units sell", f"{q.roi_pct:.1f}%", 2))

    if q.warnings:
        out.append("")
        out.append("WARNINGS")
        for w in q.warnings:
            out.append(f"  ! {w}")
    out.append("")
    return "\n".join(out)


def render_summary(quotes: list[Quote]) -> str:
    """One-line-per-SKU comparison table."""
    header = (
        f"{'SKU':<32}{'Landed':>10}{'Sell':>10}{'Profit':>10}"
        f"{'Margin':>9}{'Capital':>11}{'ROI':>8}{'BE':>6}"
    )
    rows = [header, "-" * len(header)]
    for q in sorted(quotes, key=lambda x: x.net_margin_pct, reverse=True):
        be = q.break_even_units
        rows.append(
            f"{q.sku.id[:31]:<32}"
            f"{q.landed.total_per_unit:>10,.2f}"
            f"{q.sell_price:>10,.2f}"
            f"{q.net_profit_per_unit:>10,.2f}"
            f"{q.net_margin_pct:>8.1f}%"
            f"{q.capital_required:>11,.2f}"
            f"{q.roi_pct:>7.1f}%"
            f"{('--' if be is None else be):>6}"
        )
    return "\n".join(rows)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="bmw-parts", description="BMW parts landed cost & margin calculator"
    )
    parser.add_argument("--config", help="path to config.yaml (default: project config.yaml)")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="list the SKUs in config.yaml")

    q = sub.add_parser("quote", help="full cost breakdown for a SKU")
    q.add_argument("sku_id", nargs="?", help="SKU id from config.yaml")
    q.add_argument("--all", action="store_true", help="quote every SKU")
    q.add_argument("--qty", type=int, help="order quantity (default: the SKU's MOQ)")
    q.add_argument("--sell-price", type=float, help="override the target sell price")
    q.add_argument("--summary", action="store_true", help="one-line-per-SKU table only")

    args = parser.parse_args(argv)

    try:
        cfg = Config.load(args.config)
    except ConfigError as exc:
        print(f"Config error: {exc}", file=sys.stderr)
        return 2

    if args.command == "list":
        for s in cfg.skus():
            print(f"{s.id:<32} {s.name}  (MOQ {s.moq}, {money(s.supplier_unit_cost)}/unit)")
        return 0

    try:
        if args.all:
            skus = cfg.skus()
        elif args.sku_id:
            skus = [cfg.sku(args.sku_id)]
        else:
            print("Give a SKU id or --all (try: list)", file=sys.stderr)
            return 2

        quotes = [
            quote(s, cfg, order_qty=args.qty, sell_price=args.sell_price) for s in skus
        ]
    except ConfigError as exc:
        print(f"Config error: {exc}", file=sys.stderr)
        return 2

    if args.summary:
        print(render_summary(quotes))
    else:
        for item in quotes:
            print(render(item))
        if len(quotes) > 1:
            print(render_summary(quotes))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
