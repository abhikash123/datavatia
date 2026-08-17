"""Load and validate config.yaml.

Everything the tool knows about rates comes from here. The point of this module
is that the rest of the code never has a number written into it -- it asks the
config for a rate, and it gets back both the number and a note about whether
that number is trustworthy (verified? stale?).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any

import yaml

# Where config.yaml lives by default: the project folder, one level up from
# this package.
DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config.yaml"


class ConfigError(ValueError):
    """Raised when config.yaml is missing something the tool needs."""


@dataclass(frozen=True)
class Sku:
    """One part you are considering buying."""

    id: str
    name: str
    supplier_unit_cost: float
    moq: int
    unit_weight_lbs: float
    dims_in: tuple[float, float, float]
    freight_mode: str  # "air" or "ocean"
    hts_code: str
    target_sell_price: float
    outbound_shipping_usd: float
    metal: str = "none"  # "steel" | "aluminum" | "none"
    metal_content_fraction: float = 0.0

    def __post_init__(self) -> None:
        if self.freight_mode not in ("air", "ocean"):
            raise ConfigError(
                f"SKU {self.id!r}: freight_mode must be 'air' or 'ocean', "
                f"got {self.freight_mode!r}"
            )
        if self.moq < 1:
            raise ConfigError(f"SKU {self.id!r}: moq must be at least 1")
        if len(self.dims_in) != 3:
            raise ConfigError(f"SKU {self.id!r}: dims_in must be [L, W, H]")
        if not 0.0 <= self.metal_content_fraction <= 1.0:
            raise ConfigError(
                f"SKU {self.id!r}: metal_content_fraction must be between 0 and 1"
            )


@dataclass
class Config:
    """The parsed config.yaml, with helpers for looking rates up safely."""

    raw: dict[str, Any]
    path: Path | None = None
    # Filled in as rates get used, so the caller can report on them.
    _rate_notes: list[str] = field(default_factory=list)

    # -- loading ------------------------------------------------------------

    @classmethod
    def load(cls, path: str | Path | None = None) -> "Config":
        p = Path(path) if path else DEFAULT_CONFIG_PATH
        if not p.exists():
            raise ConfigError(f"Config file not found: {p}")
        with p.open("r", encoding="utf-8") as fh:
            raw = yaml.safe_load(fh) or {}
        for section in ("meta", "freight", "customs", "hts_codes", "marketplace"):
            if section not in raw:
                raise ConfigError(f"config.yaml is missing the '{section}' section")
        return cls(raw=raw, path=p)

    # -- lookups ------------------------------------------------------------

    @property
    def staleness_days(self) -> int:
        return int(self.raw["meta"].get("staleness_days", 90))

    def freight(self, mode: str) -> dict[str, Any]:
        try:
            return self.raw["freight"][mode]
        except KeyError as exc:
            raise ConfigError(f"No freight rates configured for mode {mode!r}") from exc

    def hts(self, code: str) -> dict[str, Any]:
        """Look up an HTS code. Refuses to guess if it isn't in the table."""
        table = self.raw.get("hts_codes") or {}
        if code not in table:
            known = ", ".join(sorted(table)) or "(none)"
            raise ConfigError(
                f"HTS code {code!r} is not in config.yaml. Add it under 'hts_codes' "
                f"with rates you have confirmed with your broker. Known codes: {known}"
            )
        return table[code]

    @property
    def customs(self) -> dict[str, Any]:
        return self.raw["customs"]

    @property
    def ebay(self) -> dict[str, Any]:
        return self.raw["marketplace"]["ebay"]

    def skus(self) -> list[Sku]:
        out: list[Sku] = []
        for entry in self.raw.get("skus") or []:
            dims = entry.get("dims_in") or [0, 0, 0]
            out.append(
                Sku(
                    id=entry["id"],
                    name=entry.get("name", entry["id"]),
                    supplier_unit_cost=float(entry["supplier_unit_cost"]),
                    moq=int(entry["moq"]),
                    unit_weight_lbs=float(entry["unit_weight_lbs"]),
                    dims_in=(float(dims[0]), float(dims[1]), float(dims[2])),
                    freight_mode=str(entry["freight_mode"]),
                    hts_code=str(entry["hts_code"]),
                    target_sell_price=float(entry["target_sell_price"]),
                    outbound_shipping_usd=float(entry.get("outbound_shipping_usd", 0.0)),
                    metal=str(entry.get("metal", "none")),
                    metal_content_fraction=float(entry.get("metal_content_fraction", 0.0)),
                )
            )
        return out

    def sku(self, sku_id: str) -> Sku:
        for s in self.skus():
            if s.id == sku_id:
                return s
        known = ", ".join(s.id for s in self.skus()) or "(none)"
        raise ConfigError(f"No SKU with id {sku_id!r}. Known SKUs: {known}")


def rate_warnings(
    label: str,
    block: dict[str, Any],
    staleness_days: int,
    today: date | None = None,
) -> list[str]:
    """Return warnings about a rate block: unverified, stale, or undated.

    `label` is a human-readable name for the block, e.g. "freight.air".
    """
    today = today or date.today()
    warnings: list[str] = []

    if not block.get("verified", False):
        warnings.append(
            f"{label}: rate is marked verified: false -- it is a placeholder, confirm it"
        )

    last = block.get("last_verified")
    if last is None:
        warnings.append(f"{label}: no last_verified date set")
        return warnings

    if isinstance(last, str):
        try:
            last = date.fromisoformat(last)
        except ValueError:
            warnings.append(f"{label}: last_verified {last!r} is not a YYYY-MM-DD date")
            return warnings

    age = (today - last).days
    if age > staleness_days:
        warnings.append(
            f"{label}: rate last verified {last.isoformat()} ({age} days ago) -- re-check it"
        )
    return warnings
