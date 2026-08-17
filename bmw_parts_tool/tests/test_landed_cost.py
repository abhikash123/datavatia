"""Tests for the landed cost math.

Each test builds its own tiny config with round numbers so the expected answer
can be worked out by hand and checked against the code.
"""

from __future__ import annotations

from datetime import date

import pytest

from bmw_parts.config import Config, ConfigError, Sku, rate_warnings
from bmw_parts.landed_cost import air_freight, duties_per_unit, ocean_freight, quote


def make_config(**overrides) -> Config:
    """A config with deliberately simple numbers."""
    raw = {
        "meta": {"staleness_days": 90},
        "freight": {
            "air": {
                "usd_per_lb": 5.00,
                "dim_divisor": 166,
                "min_charge_usd": 0.0,
                "last_verified": "2026-08-01",
                "verified": True,
            },
            "ocean": {
                "usd_per_cubic_ft": 10.00,
                "min_charge_usd": 0.0,
                "last_verified": "2026-08-01",
                "verified": True,
            },
        },
        "customs": {
            "broker_entry_fee_usd": 100.00,
            "last_verified": "2026-08-01",
            "verified": True,
            "bond": {"fee_usd": 50.00, "last_verified": "2026-08-01", "verified": True},
            "section_232": {
                "rate": 0.50,
                "applies_to": ["steel", "aluminum"],
                "last_verified": "2026-08-01",
                "verified": True,
            },
        },
        "hts_codes": {
            "1234.56.7890": {
                "mfn_rate": 0.10,
                "section_301_rate": 0.25,
                "last_verified": "2026-08-01",
                "verified": True,
            },
            "0000.00.0000": {
                "mfn_rate": 0.0,
                "section_301_rate": 0.0,
                "last_verified": "2026-08-01",
                "verified": True,
            },
        },
        "marketplace": {
            "ebay": {
                "final_value_fee_pct": 0.10,
                "per_order_fixed_fee_usd": 0.50,
                "promoted_listings_pct": 0.02,
                "return_allowance_pct": 0.05,
                "last_verified": "2026-08-01",
                "verified": True,
            }
        },
    }
    raw.update(overrides)
    return Config(raw=raw)


def make_sku(**overrides) -> Sku:
    defaults = dict(
        id="test-sku",
        name="Test SKU",
        supplier_unit_cost=100.00,
        moq=10,
        unit_weight_lbs=10.0,
        dims_in=(12.0, 12.0, 12.0),
        freight_mode="air",
        hts_code="1234.56.7890",
        target_sell_price=400.00,
        outbound_shipping_usd=10.00,
        metal="none",
        metal_content_fraction=0.0,
    )
    defaults.update(overrides)
    return Sku(**defaults)


# ---------------------------------------------------------------------------
# Freight
# ---------------------------------------------------------------------------


def test_air_freight_uses_actual_weight_when_heavier():
    # 12x12x12 = 1728 cu in / 166 = 10.41 lb dim weight; actual is 50 lb.
    sku = make_sku(unit_weight_lbs=50.0)
    result = air_freight(sku, make_config(), order_qty=10)
    assert result.per_unit == pytest.approx(50.0 * 5.00)


def test_air_freight_uses_dimensional_weight_when_bulkier():
    # A 2 lb part in a 12x12x12 box bills at 1728/166 = 10.4096 lb.
    sku = make_sku(unit_weight_lbs=2.0)
    result = air_freight(sku, make_config(), order_qty=10)
    expected_dim_weight = 1728 / 166
    assert result.per_unit == pytest.approx(expected_dim_weight * 5.00)
    assert result.per_unit > 2.0 * 5.00


def test_air_freight_minimum_charge_is_spread_over_the_order():
    cfg = make_config()
    cfg.raw["freight"]["air"]["min_charge_usd"] = 1000.0
    # 2 units x 10 lb x $5 = $100 raw, well under the $1000 minimum.
    sku = make_sku(unit_weight_lbs=10.0, dims_in=(1.0, 1.0, 1.0))
    result = air_freight(sku, cfg, order_qty=2)
    assert result.order_total == pytest.approx(1000.0)
    assert result.per_unit == pytest.approx(500.0)
    assert result.hit_minimum is True


def test_ocean_freight_prices_on_cubic_feet():
    # 12x12x12 in = 1 cubic foot exactly.
    sku = make_sku(freight_mode="ocean", dims_in=(12.0, 12.0, 12.0))
    result = ocean_freight(sku, make_config(), order_qty=10)
    assert result.per_unit == pytest.approx(10.00)
    assert result.order_total == pytest.approx(100.00)


def test_ocean_freight_ignores_weight():
    heavy = make_sku(freight_mode="ocean", unit_weight_lbs=500.0)
    light = make_sku(freight_mode="ocean", unit_weight_lbs=1.0)
    cfg = make_config()
    assert ocean_freight(heavy, cfg, 10).per_unit == pytest.approx(
        ocean_freight(light, cfg, 10).per_unit
    )


# ---------------------------------------------------------------------------
# Duties
# ---------------------------------------------------------------------------


def test_mfn_and_301_come_from_the_hts_table():
    sku = make_sku(supplier_unit_cost=100.00)
    mfn, sec301, sec232 = duties_per_unit(sku, make_config())
    assert mfn == pytest.approx(10.00)  # 10% of $100
    assert sec301 == pytest.approx(25.00)  # 25% of $100
    assert sec232 == 0.0  # metal: none


def test_section_232_only_applies_to_flagged_metal_skus():
    cfg = make_config()
    plastic = make_sku(metal="none", metal_content_fraction=1.0)
    aluminum = make_sku(metal="aluminum", metal_content_fraction=1.0)
    steel = make_sku(metal="steel", metal_content_fraction=1.0)

    assert duties_per_unit(plastic, cfg)[2] == 0.0
    assert duties_per_unit(aluminum, cfg)[2] == pytest.approx(50.00)  # 50% of $100
    assert duties_per_unit(steel, cfg)[2] == pytest.approx(50.00)


def test_section_232_uses_declared_metal_content_fraction():
    # Only 60% of the customs value is steel -> 50% of $60, not of $100.
    sku = make_sku(metal="steel", metal_content_fraction=0.6)
    assert duties_per_unit(sku, make_config())[2] == pytest.approx(30.00)


def test_duty_rates_are_read_from_config_not_hardcoded():
    cfg = make_config()
    cfg.raw["hts_codes"]["1234.56.7890"]["section_301_rate"] = 0.075
    assert duties_per_unit(make_sku(), cfg)[1] == pytest.approx(7.50)


def test_unknown_hts_code_raises_rather_than_guessing():
    sku = make_sku(hts_code="9999.99.9999")
    with pytest.raises(ConfigError, match="not in config.yaml"):
        duties_per_unit(sku, make_config())


# ---------------------------------------------------------------------------
# Amortized per-shipment costs
# ---------------------------------------------------------------------------


def test_broker_and_bond_are_amortized_over_the_order():
    sku = make_sku(moq=10)
    q = quote(sku, make_config())
    assert q.landed.broker_fee_per_unit == pytest.approx(10.00)  # $100 / 10
    assert q.landed.bond_per_unit == pytest.approx(5.00)  # $50 / 10


def test_larger_orders_dilute_the_per_shipment_fees():
    cfg = make_config()
    small = quote(make_sku(), cfg, order_qty=10)
    large = quote(make_sku(), cfg, order_qty=100)
    assert large.landed.broker_fee_per_unit < small.landed.broker_fee_per_unit
    assert large.landed.total_per_unit < small.landed.total_per_unit


# ---------------------------------------------------------------------------
# The full quote
# ---------------------------------------------------------------------------


def test_full_landed_cost_adds_up_by_hand():
    # supplier            100.00
    # freight  10 lb x $5  50.00   (actual 10 lb beats dim 10.41? no -- dim wins)
    sku = make_sku(unit_weight_lbs=20.0, moq=10)  # actual 20 lb > dim 10.41
    q = quote(sku, make_config())
    expected = (
        100.00  # supplier
        + 100.00  # freight: 20 lb x $5
        + 10.00  # MFN 10%
        + 25.00  # 301 25%
        + 0.00  # 232 (metal: none)
        + 10.00  # broker $100 / 10
        + 5.00  # bond $50 / 10
    )
    assert q.landed.total_per_unit == pytest.approx(expected)
    assert q.landed.order_total == pytest.approx(expected * 10)
    assert q.capital_required == pytest.approx(expected * 10)


def test_selling_costs_add_up_by_hand():
    sku = make_sku(target_sell_price=400.00, outbound_shipping_usd=10.00)
    q = quote(sku, make_config())
    s = q.selling
    assert s.final_value_fee == pytest.approx(40.00)  # 10% of 400
    assert s.fixed_fee == pytest.approx(0.50)
    assert s.promoted_listings_fee == pytest.approx(8.00)  # 2% of 400
    assert s.outbound_shipping == pytest.approx(10.00)
    assert s.return_allowance == pytest.approx(20.00)  # 5% of 400
    assert s.total == pytest.approx(78.50)


def test_net_profit_and_margin():
    sku = make_sku(unit_weight_lbs=20.0, moq=10, target_sell_price=400.00)
    q = quote(sku, make_config())
    # landed 250.00 (above), selling 78.50 (above)
    assert q.net_profit_per_unit == pytest.approx(400.00 - 78.50 - 250.00)
    assert q.net_margin_pct == pytest.approx(100 * 71.50 / 400.00)


def test_roi_on_the_order():
    sku = make_sku(unit_weight_lbs=20.0, moq=10, target_sell_price=400.00)
    q = quote(sku, make_config())
    # $71.50 profit x 10 units on $2,500 of capital
    assert q.roi_pct == pytest.approx(100 * (71.50 * 10) / 2500.00)


def test_break_even_units_rounds_up():
    sku = make_sku(unit_weight_lbs=20.0, moq=10, target_sell_price=400.00)
    q = quote(sku, make_config())
    # capital 2500, contribution per sale = 400 - 78.50 = 321.50
    # 2500 / 321.50 = 7.77 -> 8 units
    assert q.contribution_per_unit == pytest.approx(321.50)
    assert q.break_even_units == 8


def test_break_even_is_none_when_every_sale_loses_money():
    # Sell price so low the fees alone eat it.
    sku = make_sku(target_sell_price=10.00, outbound_shipping_usd=20.00)
    q = quote(sku, make_config())
    assert q.contribution_per_unit < 0
    assert q.break_even_units is None


def test_negative_margin_is_flagged():
    sku = make_sku(target_sell_price=50.00)
    q = quote(sku, make_config())
    assert q.net_profit_per_unit < 0
    assert any("NEGATIVE MARGIN" in w for w in q.warnings)


def test_sell_price_and_qty_overrides():
    cfg = make_config()
    base = quote(make_sku(), cfg)
    override = quote(make_sku(), cfg, order_qty=50, sell_price=500.00)
    assert override.order_qty == 50
    assert override.sell_price == 500.00
    assert override.net_profit_per_unit > base.net_profit_per_unit


def test_zero_duty_hts_code_produces_no_duty():
    sku = make_sku(hts_code="0000.00.0000")
    q = quote(sku, make_config())
    assert q.landed.duties_per_unit == pytest.approx(0.0)


# ---------------------------------------------------------------------------
# Config guard rails
# ---------------------------------------------------------------------------


def test_stale_rate_produces_a_warning():
    block = {"last_verified": "2026-01-01", "verified": True}
    warnings = rate_warnings("test.block", block, 90, today=date(2026, 8, 17))
    assert any("re-check" in w for w in warnings)


def test_fresh_verified_rate_produces_no_warning():
    block = {"last_verified": "2026-08-01", "verified": True}
    assert rate_warnings("test.block", block, 90, today=date(2026, 8, 17)) == []


def test_unverified_rate_produces_a_warning():
    block = {"last_verified": "2026-08-01", "verified": False}
    warnings = rate_warnings("test.block", block, 90, today=date(2026, 8, 17))
    assert any("placeholder" in w for w in warnings)


def test_bad_freight_mode_is_rejected():
    with pytest.raises(ConfigError, match="freight_mode"):
        make_sku(freight_mode="teleport")


def test_shipped_config_loads_and_quotes_every_sku():
    """The real config.yaml must parse and every seeded SKU must price."""
    cfg = Config.load()
    skus = cfg.skus()
    assert len(skus) == 5
    for sku in skus:
        q = quote(sku, cfg)
        assert q.landed.total_per_unit > sku.supplier_unit_cost
        # Everything ships unverified, so every quote should say so.
        assert any("placeholder" in w for w in q.warnings)
