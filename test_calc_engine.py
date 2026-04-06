"""
Test Suite — Calculation Engine V1

Validates computed outputs against known Pricing Sheet formula behavior.
Run: python -m pytest test_calc_engine.py -v
"""

import pytest
from decimal import Decimal
from calc_engine import (
    compute_dimensions,
    compute_dimension_string,
    compute_cost_block,
    compute_group_cost_pool,
    compute_labor_block,
    compute_group_labor_pool,
    compute_product_pricing,
    compute_tag_summary,
    compute_option_totals,
    compute_quote,
)


# ──────────────────────────────────────────────────────────────────────
# Dimension Tests
# ──────────────────────────────────────────────────────────────────────

class TestDimensions:
    
    def test_standard_sqft(self):
        """36" x 48" = 12 sq ft"""
        result = compute_dimensions({
            "width": 36, "length": 48, "shape": "Standard",
            "material_type": "Stone", "lumber_thickness": "",
        })
        assert result["sq_ft"] == Decimal("12.0000")
        assert result["bd_ft"] == Decimal("0")
    
    def test_dia_sqft(self):
        """30" DIA = π × (15/12)² = π × 1.5625 ≈ 4.9087"""
        result = compute_dimensions({
            "width": 30, "length": 30, "shape": "DIA",
            "material_type": "Stone", "lumber_thickness": "",
        })
        assert abs(result["sq_ft"] - Decimal("4.9087")) < Decimal("0.001")
    
    def test_hardwood_bdft(self):
        """36x48 at 1.25" thickness: (36×48×1.5/144)×1.3 = 18×1.3 = 23.4"""
        result = compute_dimensions({
            "width": 36, "length": 48, "shape": "Standard",
            "material_type": "Hardwood", "lumber_thickness": '1.25"',
        })
        assert result["sq_ft"] == Decimal("12.0000")
        assert result["bd_ft"] == Decimal("23.4000")
        assert result["raw_thickness"] == Decimal("1.5")
        assert result["quarter_code"] == "6/4"
    
    def test_stone_no_bdft(self):
        """Stone products have no board footage."""
        result = compute_dimensions({
            "width": 36, "length": 48, "shape": "Standard",
            "material_type": "Stone", "lumber_thickness": "",
        })
        assert result["bd_ft"] == Decimal("0")
    
    def test_live_edge_bdft(self):
        """Live Edge uses same BdFt calc as hardwood."""
        result = compute_dimensions({
            "width": 36, "length": 72, "shape": "Standard",
            "material_type": "Live Edge", "lumber_thickness": '2.25"',
        })
        # (36×72×2.5/144)×1.3 = 45×1.3 = 58.5
        assert result["bd_ft"] == Decimal("58.5000")
        assert result["quarter_code"] == "10/4"
    
    def test_zero_dimensions(self):
        result = compute_dimensions({
            "width": 0, "length": 0, "shape": "Standard",
            "material_type": "Hardwood", "lumber_thickness": '1.25"',
        })
        assert result["sq_ft"] == Decimal("0")
        assert result["bd_ft"] == Decimal("0")


class TestDimensionString:
    
    def test_standard(self):
        s = compute_dimension_string({
            "width": 36, "length": 48, "shape": "Standard",
            "height_name": "Dining Height",
        })
        assert s == '36" x 48" - Dining Height'
    
    def test_dia(self):
        s = compute_dimension_string({
            "width": 30, "shape": "DIA",
            "height_name": "Bar Height",
        })
        assert s == '30" DIA - Bar Height'
    
    def test_custom_height(self):
        s = compute_dimension_string({
            "width": 36, "length": 48, "shape": "Standard",
            "height_name": "Custom Height", "height_input": "38",
        })
        assert s == '36" x 48" x 38"H'
    
    def test_custom_shape(self):
        s = compute_dimension_string({
            "width": 36, "length": 48, "shape": "Custom Shape",
            "height_name": "Dining Height", "shape_custom": "Half Pill",
        })
        assert s == '36" x 48" - Dining Height - Half Pill'


# ──────────────────────────────────────────────────────────────────────
# Unit Cost Block Tests
# ──────────────────────────────────────────────────────────────────────

class TestCostBlock:
    
    def test_fixed_multiplier(self):
        """Simple unit cost: $25 × 3 units = $75 PP"""
        result = compute_cost_block(
            {"cost_per_unit": 25, "multiplier_type": "fixed", "units_per_product": 3},
            {"quantity": 2},
        )
        assert result["cost_pp"] == Decimal("75.0000")
        assert result["cost_pt"] == Decimal("150.0000")
    
    def test_per_base_multiplier(self):
        """Stock base: $255 × 2 bases_per_top = $510 PP"""
        result = compute_cost_block(
            {"cost_per_unit": 255, "multiplier_type": "per_base"},
            {"quantity": 5, "bases_per_top": 2},
        )
        assert result["cost_pp"] == Decimal("510.0000")
        assert result["cost_pt"] == Decimal("2550.0000")
    
    def test_per_sqft_multiplier(self):
        """Stone cost: $15/sqft × 12 sqft = $180 PP"""
        result = compute_cost_block(
            {"cost_per_unit": 15, "multiplier_type": "per_sqft"},
            {"quantity": 3, "sq_ft": Decimal("12")},
        )
        assert result["cost_pp"] == Decimal("180.0000")
        assert result["cost_pt"] == Decimal("540.0000")
    
    def test_per_bdft_multiplier(self):
        """Species cost: $3.50/bdft × 23.4 bdft = $81.90 PP"""
        result = compute_cost_block(
            {"cost_per_unit": Decimal("3.50"), "multiplier_type": "per_bdft"},
            {"quantity": 2, "bd_ft": Decimal("23.4")},
        )
        assert result["cost_pp"] == Decimal("81.9000")
        assert result["cost_pt"] == Decimal("163.8000")
    
    def test_zero_cost(self):
        result = compute_cost_block(
            {"cost_per_unit": 0, "multiplier_type": "fixed", "units_per_product": 1},
            {"quantity": 1},
        )
        assert result["cost_pp"] == Decimal("0.0000")


# ──────────────────────────────────────────────────────────────────────
# Group Cost Pool Tests
# ──────────────────────────────────────────────────────────────────────

class TestGroupCostPool:
    
    def test_distribute_by_units(self):
        """$300 across 2 products (qty 5, qty 3) by units = $37.50/table, $37.50/table"""
        pool = {"total_amount": 300, "distribution_type": "units"}
        members = [
            {"product_id": "A"},
            {"product_id": "B"},
        ]
        products = {
            "A": {"quantity": 5, "sq_ft": Decimal("12")},
            "B": {"quantity": 3, "sq_ft": Decimal("8")},
        }
        result = compute_group_cost_pool(pool, members, products)
        
        # Total metric = 5 + 3 = 8. Rate = 300/8 = 37.50 per unit
        # A: metric=5, cost_pp = 5/5 × 37.50 = 37.50, cost_pt = 37.50 × 5 = 187.50
        # B: metric=3, cost_pp = 3/3 × 37.50 = 37.50, cost_pt = 37.50 × 3 = 112.50
        assert result[0]["cost_pp"] == Decimal("37.5000")
        assert result[0]["cost_pt"] == Decimal("187.5000")
        assert result[1]["cost_pp"] == Decimal("37.5000")
        assert result[1]["cost_pt"] == Decimal("112.5000")
        
        # Total distributed should equal pool amount
        total = sum(r["cost_pt"] for r in result)
        assert total == Decimal("300.0000")
    
    def test_distribute_by_sqft(self):
        """$200 across 2 products by sqft. Product A: 12sqft×2qty, Product B: 8sqft×3qty"""
        pool = {"total_amount": 200, "distribution_type": "sqft"}
        members = [
            {"product_id": "A"},
            {"product_id": "B"},
        ]
        products = {
            "A": {"quantity": 2, "sq_ft": Decimal("12")},
            "B": {"quantity": 3, "sq_ft": Decimal("8")},
        }
        result = compute_group_cost_pool(pool, members, products)
        
        # Total metric = 12×2 + 8×3 = 24 + 24 = 48
        # Rate = 200/48 = 4.1667 per sqft-unit
        # A: metric=24, cost_pp = 24/2 × rate = 12 × 4.1667 = 50.00, cost_pt = 100.00
        # B: metric=24, cost_pp = 24/3 × rate = 8 × 4.1667 = 33.3336, cost_pt = 100.0008
        total = sum(r["cost_pt"] for r in result)
        # Should be very close to 200 (minor rounding)
        assert abs(total - Decimal("200")) < Decimal("0.01")
    
    def test_zero_total(self):
        pool = {"total_amount": 0, "distribution_type": "units"}
        members = [{"product_id": "A"}]
        products = {"A": {"quantity": 1}}
        result = compute_group_cost_pool(pool, members, products)
        assert result[0]["cost_pp"] == Decimal("0")


# ──────────────────────────────────────────────────────────────────────
# Labor Block Tests
# ──────────────────────────────────────────────────────────────────────

class TestLaborBlock:
    
    def test_unit_hours(self):
        """Direct hour input: 0.5 hours per table"""
        result = compute_labor_block(
            {"block_type": "unit", "hours_per_unit": Decimal("0.5"), "is_active": True},
            {"quantity": 4},
        )
        assert result["hours_pp"] == Decimal("0.5000")
        assert result["hours_pt"] == Decimal("2.0000")
    
    def test_rate_block_single_product(self):
        """Rate block: 12 sqft at 60 sqft/hr = 0.2 hours"""
        result = compute_labor_block(
            {"block_type": "rate", "rate_value": 60, "metric_source": "top_sqft", "is_active": True},
            {"quantity": 2, "sq_ft": Decimal("12")},
        )
        # 12 / 60 = 0.2 hours PP
        assert result["hours_pp"] == Decimal("0.2000")
        assert result["hours_pt"] == Decimal("0.4000")
    
    def test_inactive_block(self):
        result = compute_labor_block(
            {"block_type": "unit", "hours_per_unit": 5, "is_active": False},
            {"quantity": 1},
        )
        assert result["hours_pp"] == Decimal("0")
    
    def test_rate_block_zero_rate(self):
        result = compute_labor_block(
            {"block_type": "rate", "rate_value": 0, "metric_source": "top_sqft", "is_active": True},
            {"quantity": 1, "sq_ft": Decimal("12")},
        )
        assert result["hours_pp"] == Decimal("0")


# ──────────────────────────────────────────────────────────────────────
# Product Pricing Assembly Tests
# ──────────────────────────────────────────────────────────────────────

class TestProductPricing:
    
    def test_simple_hardwood_table(self):
        """
        A basic hardwood table:
        - Species cost: $81.90 PP (23.4 bdft × $3.50/bdft)
        - Hardwood margin: 5%
        - Stock base: $255 PP, margin 25%
        - 2 hours at $155/hr
        - Qty 2, no rep, no adjustment
        """
        product = {
            "quantity": 2,
            "hourly_rate": 155,
            "final_adjustment_rate": 1,
            "hardwood_margin_rate": Decimal("0.05"),
            "stock_base_margin_rate": Decimal("0.25"),
        }
        cost_blocks = [
            {"cost_category": "species", "cost_pp": Decimal("81.90")},
            {"cost_category": "stock_base", "cost_pp": Decimal("255.00")},
        ]
        labor_blocks = [
            {"labor_center": "LC101", "hours_pp": Decimal("0.8")},
            {"labor_center": "LC105", "hours_pp": Decimal("1.2")},
        ]
        quote = {"has_rep": False, "rep_rate": Decimal("0.08")}
        
        result = compute_product_pricing(product, cost_blocks, [], labor_blocks, [], quote)
        
        # Species: 81.90 × 1.05 = 85.995
        # Stock base: 255 × 1.25 = 318.75
        # Material price: 85.995 + 318.75 = 404.745 ≈ 404.75
        assert result["total_material_cost"] == Decimal("336.90")
        
        # Hours: 2.0 × 155 = 310
        assert result["hours_price"] == Decimal("310.00")
        assert result["total_hours_pp"] == Decimal("2.0000")
        
        # No rep, no adjustment
        assert result["final_price_pp"] == result["price_pp"]
        assert result["sale_price_pp"] == result["final_price_pp"]
        assert result["sale_price_total"] == result["sale_price_pp"] * 2
    
    def test_with_rep_and_adjustment(self):
        """Test rep commission and final adjustment rate."""
        product = {
            "quantity": 1,
            "hourly_rate": 155,
            "final_adjustment_rate": Decimal("1.2"),
            "unit_cost_margin_rate": Decimal("0.05"),
        }
        cost_blocks = [
            {"cost_category": "unit_cost", "cost_pp": Decimal("100.00")},
        ]
        labor_blocks = [
            {"labor_center": "LC105", "hours_pp": Decimal("1.0")},
        ]
        quote = {"has_rep": True, "rep_rate": Decimal("0.08")}
        
        result = compute_product_pricing(product, cost_blocks, [], labor_blocks, [], quote)
        
        # Material: 100 × 1.05 = 105
        # Hours: 1 × 155 = 155
        # Price: 105 + 155 = 260
        assert result["price_pp"] == Decimal("260.00")
        
        # Adjusted: 260 × 1.2 = 312
        assert result["final_price_pp"] == Decimal("312.00")
        
        # With rep: 312 × 1.08 = 336.96
        assert result["sale_price_pp"] == Decimal("336.96")


# ──────────────────────────────────────────────────────────────────────
# Tag Summary Tests
# ──────────────────────────────────────────────────────────────────────

class TestTagSummary:
    
    def test_basic_tag_grouping(self):
        tags = {"t1": "Top", "t2": "Base"}
        cost_blocks = [
            {"tag_id": "t1", "cost_pp": Decimal("100"), "cost_pt": Decimal("200")},
            {"tag_id": "t2", "cost_pp": Decimal("255"), "cost_pt": Decimal("510")},
        ]
        labor_blocks = [
            {"tag_id": "t1", "hours_pp": Decimal("1.5"), "hours_pt": Decimal("3.0")},
        ]
        result = compute_tag_summary(cost_blocks, labor_blocks, [], [], tags)
        
        assert result["Top"]["cost_pp"] == Decimal("100")
        assert result["Top"]["hours_pp"] == Decimal("1.5")
        assert result["Base"]["cost_pp"] == Decimal("255")
        assert result["Base"]["hours_pp"] == Decimal("0")
    
    def test_untagged(self):
        tags = {}
        cost_blocks = [
            {"tag_id": None, "cost_pp": Decimal("50"), "cost_pt": Decimal("50")},
        ]
        result = compute_tag_summary(cost_blocks, [], [], [], tags)
        assert "Untagged" in result


# ──────────────────────────────────────────────────────────────────────
# Full Quote Integration Test
# ──────────────────────────────────────────────────────────────────────

class TestFullQuote:
    
    def test_two_product_quote_with_group_pool(self):
        """
        Real-world-ish scenario:
        - 2 hardwood dining tables (qty 5 each)
        - Each has species cost + stock base
        - Shared shipping pool of $300 distributed by units
        - Basic labor hours
        """
        quote_data = {
            "quote": {
                "has_rep": True,
                "rep_rate": "0.08",
            },
            "tags": {"t1": "Top", "t2": "Base", "t3": "Shipping"},
            "options": [
                {
                    "id": "opt1",
                    "name": "Standard",
                    "products": [
                        {
                            "id": "p1",
                            "quantity": 5,
                            "width": 36,
                            "length": 48,
                            "shape": "Standard",
                            "material_type": "Hardwood",
                            "lumber_thickness": '1.25"',
                            "bases_per_top": 1,
                            "hourly_rate": 155,
                            "final_adjustment_rate": 1,
                            "hardwood_margin_rate": "0.05",
                            "stock_base_margin_rate": "0.25",
                            "stock_base_ship_margin_rate": "0.05",
                            "cost_blocks": [
                                {
                                    "cost_category": "species",
                                    "cost_per_unit": "3.50",
                                    "multiplier_type": "per_bdft",
                                    "tag_id": "t1",
                                },
                                {
                                    "cost_category": "stock_base",
                                    "cost_per_unit": "255",
                                    "multiplier_type": "per_base",
                                    "tag_id": "t2",
                                },
                            ],
                            "labor_blocks": [
                                {
                                    "block_type": "unit",
                                    "labor_center": "LC105",
                                    "hours_per_unit": "1.5",
                                    "is_active": True,
                                    "tag_id": "t1",
                                },
                                {
                                    "block_type": "unit",
                                    "labor_center": "LC110",
                                    "hours_per_unit": "0.5",
                                    "is_active": True,
                                    "tag_id": "t1",
                                },
                            ],
                        },
                        {
                            "id": "p2",
                            "quantity": 5,
                            "width": 30,
                            "length": 60,
                            "shape": "Standard",
                            "material_type": "Hardwood",
                            "lumber_thickness": '1.25"',
                            "bases_per_top": 1,
                            "hourly_rate": 155,
                            "final_adjustment_rate": 1,
                            "hardwood_margin_rate": "0.05",
                            "stock_base_margin_rate": "0.25",
                            "stock_base_ship_margin_rate": "0.05",
                            "cost_blocks": [
                                {
                                    "cost_category": "species",
                                    "cost_per_unit": "3.50",
                                    "multiplier_type": "per_bdft",
                                    "tag_id": "t1",
                                },
                                {
                                    "cost_category": "stock_base",
                                    "cost_per_unit": "255",
                                    "multiplier_type": "per_base",
                                    "tag_id": "t2",
                                },
                            ],
                            "labor_blocks": [
                                {
                                    "block_type": "unit",
                                    "labor_center": "LC105",
                                    "hours_per_unit": "2.0",
                                    "is_active": True,
                                    "tag_id": "t1",
                                },
                            ],
                        },
                    ],
                },
            ],
            "group_cost_pools": [
                {
                    "total_amount": "300",
                    "distribution_type": "units",
                    "cost_category": "stock_base_shipping",
                    "on_qty_change": "redistribute",
                    "tag_id": "t3",
                    "members": [
                        {"product_id": "p1"},
                        {"product_id": "p2"},
                    ],
                },
            ],
            "group_labor_pools": [],
        }
        
        result = compute_quote(quote_data)
        
        # Verify dimensions were computed
        p1 = result["options"][0]["products"][0]
        p2 = result["options"][0]["products"][1]
        
        assert p1["sq_ft"] == Decimal("12.0000")
        assert p1["bd_ft"] == Decimal("23.4000")
        
        # p2: 30×60 at 1.25" → (30×60×1.5/144)×1.3 = 18.75×1.3 = 24.375
        assert p2["bd_ft"] == Decimal("24.3750")
        
        # Verify cost blocks were computed
        p1_species = p1["cost_blocks"][0]
        assert p1_species["cost_pp"] == Decimal("81.9000")  # 23.4 × 3.50
        
        p1_base = p1["cost_blocks"][1]
        assert p1_base["cost_pp"] == Decimal("255.0000")   # 255 × 1 base
        
        # Verify group pool was distributed
        pool_members = result["group_cost_pools"][0]["members"]
        # Both have qty 5, distributed by units → $300 / 10 = $30/unit each
        assert pool_members[0]["cost_pp"] == Decimal("30.0000")
        assert pool_members[1]["cost_pp"] == Decimal("30.0000")
        
        # Verify final pricing exists
        assert p1["sale_price_pp"] > 0
        assert p1["sale_price_total"] > 0
        assert p2["sale_price_pp"] > 0
        
        # Verify option totals
        opt = result["options"][0]
        assert opt["total_price"] > 0
        assert opt["total_hours"] > 0
        
        # Verify tag summary exists
        assert "Top" in p1["tag_summary"]
        assert "Base" in p1["tag_summary"]
        
        # Verify quote totals
        assert result["quote"]["total_price"] == opt["total_price"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
