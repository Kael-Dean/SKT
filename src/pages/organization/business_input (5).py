from __future__ import annotations

from typing import List, Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, condecimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from Database import SessionLocal
from auth import get_current_user_id
from models import (
    BusinessPlan,
    Units,
    UnitCosts,
    UnitEarnings,
    BranchCosts,
    BranchEarnings,
    AuditLog,
    OrganizationBusinessCost,
    OrganizationBusinessEarning,
    MonthlyUnitEarnings
)

router = APIRouter(prefix="/business-plan", tags=["business-plan-values"])


# ----------------- deps -----------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ----------------- schemas -----------------
Money = condecimal(max_digits=14, decimal_places=3, ge=0)


class UnitAmountIn(BaseModel):
    unit_id: int
    amount: Money = Field(default=Decimal("0"))


class SaveCostRowIn(BaseModel):
    branch_id: int
    business_cost_id: int
    unit_values: List[UnitAmountIn] = Field(default_factory=list)
    branch_total: Money = Field(default=Decimal("0"))
    comment: Optional[str] = None


class SaveEarningRowIn(BaseModel):
    branch_id: int
    business_earning_id: int
    unit_values: List[UnitAmountIn] = Field(default_factory=list)
    branch_total: Money = Field(default=Decimal("0"))
    comment: Optional[str] = None


class BulkSaveCostsIn(BaseModel):
    rows: List[SaveCostRowIn] = Field(default_factory=list)


class BulkSaveEarningsIn(BaseModel):
    rows: List[SaveEarningRowIn] = Field(default_factory=list)

class MonthlyValuesIn(BaseModel):
    m1_value: Money = Field(default=Decimal("0"))
    m2_value: Money = Field(default=Decimal("0"))
    m3_value: Money = Field(default=Decimal("0"))
    m4_value: Money = Field(default=Decimal("0"))
    m5_value: Money = Field(default=Decimal("0"))
    m6_value: Money = Field(default=Decimal("0"))
    m7_value: Money = Field(default=Decimal("0"))
    m8_value: Money = Field(default=Decimal("0"))
    m9_value: Money = Field(default=Decimal("0"))
    m10_value: Money = Field(default=Decimal("0"))
    m11_value: Money = Field(default=Decimal("0"))
    m12_value: Money = Field(default=Decimal("0"))

    @property
    def total(self) -> Decimal:
        """Dynamically calculates the sum of all 12 months"""
        return sum([
            self.m1_value, self.m2_value, self.m3_value, self.m4_value,
            self.m5_value, self.m6_value, self.m7_value, self.m8_value,
            self.m9_value, self.m10_value, self.m11_value, self.m12_value
        ])

class MonthlyUnitCostRowIn(BaseModel):
    unit_id: int
    b_cost: int
    months: MonthlyValuesIn

class BulkSaveMonthlyCostsIn(BaseModel):
    rows: List[MonthlyUnitCostRowIn] = Field(default_factory=list)

class MonthlyUnitEarningsRowIn(BaseModel):
    unit_id: int
    b_earning: int
    months: MonthlyValuesIn

class BulkSaveMonthlyEarningsIn(BaseModel):
    rows: List[MonthlyUnitEarningsRowIn] = Field(default_factory=list)

# ----------------- helpers -----------------
def _require_plan(db: Session, plan_id: int) -> None:
    ok = db.query(BusinessPlan.id).filter(BusinessPlan.id == plan_id).first()
    if not ok:
        raise HTTPException(status_code=404, detail="BusinessPlan not found")


def _validate_units_belong_to_branch(db: Session, branch_id: int, unit_ids: List[int]) -> None:
    if not unit_ids:
        return
    rows = db.query(Units.id).filter(Units.branch_id == branch_id, Units.id.in_(unit_ids)).all()
    ok_ids = {r[0] for r in rows}
    bad = [uid for uid in unit_ids if uid not in ok_ids]
    if bad:
        raise HTTPException(
            status_code=400,
            detail=f"Some unit_id do not belong to branch_id={branch_id}: {bad}",
        )


def _write_audit(db: Session, *, action: str, plan_id: int, user_id: Optional[int], comment: Optional[str]):
    db.add(AuditLog(
        action=action,
        action_id=str(plan_id),  # ✅ Cast to string matching DB schema
        user_id=user_id,
        comment=comment,
    ))


def _recalc_org_costs(db: Session, plan_id: int, cost_ids: List[int]):
    """ Instantly calculate and update the total cost across ALL branches in the organization """
    if not cost_ids: return

    sums = (
        db.query(BranchCosts.b_costs, func.sum(BranchCosts.amount).label("total"))
        .filter(BranchCosts.plan_id == plan_id, BranchCosts.b_costs.in_(cost_ids))
        .group_by(BranchCosts.b_costs)
        .all()
    )

    upsert_data = [{"plan_id": plan_id, "b_costs": r.b_costs, "total_amount": r.total} for r in sums]

    if upsert_data:
        stmt = pg_insert(OrganizationBusinessCost).values(upsert_data)
        stmt = stmt.on_conflict_do_update(
            index_elements=["plan_id", "b_costs"],
            set_={"total_amount": stmt.excluded.total_amount}
        )
        db.execute(stmt)


def _recalc_org_earnings(db: Session, plan_id: int, earning_ids: List[int]):
    """ Instantly calculate and update the total earnings across ALL branches in the organization """
    if not earning_ids: return

    sums = (
        db.query(BranchEarnings.b_earnings, func.sum(BranchEarnings.amount).label("total"))
        .filter(BranchEarnings.plan_id == plan_id, BranchEarnings.b_earnings.in_(earning_ids))
        .group_by(BranchEarnings.b_earnings)
        .all()
    )

    upsert_data = [{"plan_id": plan_id, "b_earnings": r.b_earnings, "total_amount": r.total} for r in sums]

    if upsert_data:
        stmt = pg_insert(OrganizationBusinessEarning).values(upsert_data)
        stmt = stmt.on_conflict_do_update(
            index_elements=["plan_id", "b_earnings"],
            set_={"total_amount": stmt.excluded.total_amount}
        )
        db.execute(stmt)


# =========================================================
# GET: LOAD COST VALUES (unit cells + branch totals)
# =========================================================
@router.get("/{plan_id}/costs")
def get_costs_values(
        plan_id: int,
        branch_id: int = Query(...),
        db: Session = Depends(get_db),
):
    _require_plan(db, plan_id)

    unit_rows = (
        db.query(UnitCosts)
        .join(Units, Units.id == UnitCosts.unit_id)
        .filter(UnitCosts.plan_id == plan_id)
        .filter(Units.branch_id == branch_id)
        .all()
    )
    branch_rows = (
        db.query(BranchCosts)
        .filter(BranchCosts.plan_id == plan_id)
        .filter(BranchCosts.branch_id == branch_id)
        .all()
    )

    return {
        "plan_id": plan_id,
        "branch_id": branch_id,
        "unit_costs": [
            {
                "unit_id": r.unit_id,
                "business_cost_id": r.business_cost,
                "amount": float(r.amount or 0),
            }
            for r in unit_rows
        ],
        "branch_costs": [
            {
                "business_cost_id": r.b_costs,
                "amount": float(r.amount or 0),
                "comment": r.comment,
            }
            for r in branch_rows
        ],
    }


# =========================================================
# POST: COSTS bulk upsert unit values + branch totals
# =========================================================
@router.post("/{plan_id}/costs/bulk", status_code=status.HTTP_200_OK)
def upsert_costs_bulk(
        plan_id: int,
        body: BulkSaveCostsIn,
        db: Session = Depends(get_db),
        user_id: int = Depends(get_current_user_id),
):
    _require_plan(db, plan_id)

    unit_costs_payload = []
    branch_costs_payload = []
    updated_cost_ids = set()

    for row in body.rows:
        unit_ids = [u.unit_id for u in row.unit_values]
        _validate_units_belong_to_branch(db, row.branch_id, unit_ids)

        updated_cost_ids.add(row.business_cost_id)

        # Prepare unit payloads
        for u in row.unit_values:
            unit_costs_payload.append({
                "plan_id": plan_id,
                "unit_id": u.unit_id,
                "business_cost": row.business_cost_id,
                "amount": u.amount,
                "created_by": user_id,
                "comment": row.comment,
            })

        # Prepare branch payloads
        branch_costs_payload.append({
            "plan_id": plan_id,
            "branch_id": row.branch_id,
            "b_costs": row.business_cost_id,
            "amount": row.branch_total,
            "created_by": user_id,
            "comment": row.comment,
        })

    # Bulk Upsert Unit Costs
    if unit_costs_payload:
        stmt = pg_insert(UnitCosts).values(unit_costs_payload)
        stmt = stmt.on_conflict_do_update(
            index_elements=["plan_id", "unit_id", "business_cost"],
            set_={
                "amount": stmt.excluded.amount,
                "created_by": stmt.excluded.created_by,
                "comment": stmt.excluded.comment,
                "created_date": func.now(),
            }
        )
        db.execute(stmt)

    # Bulk Upsert Branch Costs
    if branch_costs_payload:
        stmt2 = pg_insert(BranchCosts).values(branch_costs_payload)
        stmt2 = stmt2.on_conflict_do_update(
            index_elements=["plan_id", "branch_id", "b_costs"],
            set_={
                "amount": stmt2.excluded.amount,
                "created_by": stmt2.excluded.created_by,
                "comment": stmt2.excluded.comment,
                "created_date": func.now(),
            }
        )
        db.execute(stmt2)

    # 🚀 Pre-calculate the Organization rollup
    _recalc_org_costs(db, plan_id, list(updated_cost_ids))

    _write_audit(
        db,
        action="BUSINESSPLAN_COSTS_UPSERT",
        plan_id=plan_id,
        user_id=user_id,
        comment=f"bulk rows={len(body.rows)} unit_cells={len(unit_costs_payload)}",
    )

    db.commit()
    return {
        "ok": True,
        "plan_id": plan_id,
        "rows": len(body.rows),
        "unit_cells_upserted": len(unit_costs_payload),
        "branch_totals_upserted": len(branch_costs_payload),
    }


class MonthlyUnitCosts:
    pass


@router.post("/{plan_id}/costs/monthly", status_code=status.HTTP_200_OK)
def upsert_monthly_costs(
        plan_id: int,
        body: BulkSaveMonthlyCostsIn,
        db: Session = Depends(get_db),
        user_id: int = Depends(get_current_user_id),
):
    _require_plan(db, plan_id)

    if not body.rows:
        return {"ok": True, "upserted": 0}

    # 1. Fetch existing Yearly Values to validate against
    unit_ids = list({row.unit_id for row in body.rows})
    b_cost_ids = list({row.b_cost for row in body.rows})

    yearly_records = (
        db.query(UnitCosts.unit_id, UnitCosts.business_cost, UnitCosts.amount)
        .filter(UnitCosts.plan_id == plan_id)
        .filter(UnitCosts.unit_id.in_(unit_ids))
        .filter(UnitCosts.business_cost.in_(b_cost_ids))
        .all()
    )

    # Create a quick lookup dictionary: {(unit_id, b_cost): yearly_amount}
    yearly_map = {(r.unit_id, r.business_cost): r.amount for r in yearly_records}

    upsert_payload = []

    # 2. Validation Loop
    for row in body.rows:
        lookup_key = (row.unit_id, row.b_cost)
        yearly_val = yearly_map.get(lookup_key)

        # Rule 1: Reject if yearly value is absent
        if yearly_val is None:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot save monthly data: No yearly data keyed for unit_id={row.unit_id}, b_cost={row.b_cost}"
            )

        # Rule 2: Reject if monthly sum does not match yearly value
        monthly_total = row.months.total
        if monthly_total != yearly_val:
            raise HTTPException(
                status_code=400,
                detail=f"Monthly sum ({monthly_total}) does not match yearly value ({yearly_val}) for unit_id={row.unit_id}"
            )

        # Prepare payload if validation passes
        upsert_payload.append({
            "plan_id": plan_id,
            "unit_id": row.unit_id,
            "b_cost": row.b_cost,
            "m1_value": row.months.m1_value,
            "m2_value": row.months.m2_value,
            "m3_value": row.months.m3_value,
            "m4_value": row.months.m4_value,
            "m5_value": row.months.m5_value,
            "m6_value": row.months.m6_value,
            "m7_value": row.months.m7_value,
            "m8_value": row.months.m8_value,
            "m9_value": row.months.m9_value,
            "m10_value": row.months.m10_value,
            "m11_value": row.months.m11_value,
            "m12_value": row.months.m12_value,
            "total_yearly_value": monthly_total
        })

    # 3. Bulk Upsert using PostgreSQL ON CONFLICT
    if upsert_payload:
        stmt = pg_insert(MonthlyUnitCosts).values(upsert_payload)
        stmt = stmt.on_conflict_do_update(
            index_elements=["plan_id", "unit_id", "b_cost"],  # Matches uq_monthly_unit_costs
            set_={
                "m1_value": stmt.excluded.m1_value,
                "m2_value": stmt.excluded.m2_value,
                "m3_value": stmt.excluded.m3_value,
                "m4_value": stmt.excluded.m4_value,
                "m5_value": stmt.excluded.m5_value,
                "m6_value": stmt.excluded.m6_value,
                "m7_value": stmt.excluded.m7_value,
                "m8_value": stmt.excluded.m8_value,
                "m9_value": stmt.excluded.m9_value,
                "m10_value": stmt.excluded.m10_value,
                "m11_value": stmt.excluded.m11_value,
                "m12_value": stmt.excluded.m12_value,
                "total_yearly_value": stmt.excluded.total_yearly_value,
            }
        )
        db.execute(stmt)

    # Optional: Log the audit
    _write_audit(
        db,
        action="MONTHLY_COSTS_UPSERT",
        plan_id=plan_id,
        user_id=user_id,
        comment=f"upserted {len(upsert_payload)} monthly rows",
    )

    db.commit()
    return {
        "ok": True,
        "plan_id": plan_id,
        "monthly_rows_upserted": len(upsert_payload)
    }

# =========================================================
# GET: LOAD EARNING VALUES (unit cells + branch totals)
# =========================================================
@router.get("/{plan_id}/earnings")
def get_earnings_values(
        plan_id: int,
        branch_id: int = Query(...),
        db: Session = Depends(get_db),
):
    _require_plan(db, plan_id)

    unit_rows = (
        db.query(UnitEarnings)
        .join(Units, Units.id == UnitEarnings.unit_id)
        .filter(UnitEarnings.plan_id == plan_id)
        .filter(Units.branch_id == branch_id)
        .all()
    )
    branch_rows = (
        db.query(BranchEarnings)
        .filter(BranchEarnings.plan_id == plan_id)
        .filter(BranchEarnings.branch_id == branch_id)
        .all()
    )

    return {
        "plan_id": plan_id,
        "branch_id": branch_id,
        "unit_earnings": [
            {
                "unit_id": r.unit_id,
                "business_earning_id": r.business_earning,
                "amount": float(r.amount or 0),
            }
            for r in unit_rows
        ],
        "branch_earnings": [
            {
                "business_earning_id": r.b_earnings,
                "amount": float(r.amount or 0),
                "comment": r.comment,
            }
            for r in branch_rows
        ],
    }


# =========================================================
# POST: EARNINGS bulk upsert unit values + branch totals
# =========================================================
@router.post("/{plan_id}/earnings/bulk", status_code=status.HTTP_200_OK)
def upsert_earnings_bulk(
        plan_id: int,
        body: BulkSaveEarningsIn,
        db: Session = Depends(get_db),
        user_id: int = Depends(get_current_user_id),
):
    _require_plan(db, plan_id)

    unit_earn_payload = []
    branch_earn_payload = []
    updated_earning_ids = set()

    for row in body.rows:
        unit_ids = [u.unit_id for u in row.unit_values]
        _validate_units_belong_to_branch(db, row.branch_id, unit_ids)

        updated_earning_ids.add(row.business_earning_id)

        for u in row.unit_values:
            unit_earn_payload.append({
                "plan_id": plan_id,
                "unit_id": u.unit_id,
                "business_earning": row.business_earning_id,
                "amount": u.amount,
                "created_by": user_id,
                "comment": row.comment,
            })

        branch_earn_payload.append({
            "plan_id": plan_id,
            "branch_id": row.branch_id,
            "b_earnings": row.business_earning_id,
            "amount": row.branch_total,
            "created_by": user_id,
            "comment": row.comment,
        })

    # Bulk Upsert Unit Earnings
    if unit_earn_payload:
        stmt = pg_insert(UnitEarnings).values(unit_earn_payload)
        stmt = stmt.on_conflict_do_update(
            index_elements=["plan_id", "unit_id", "business_earning"],
            set_={
                "amount": stmt.excluded.amount,
                "created_by": stmt.excluded.created_by,
                "comment": stmt.excluded.comment,
                "created_date": func.now(),
            }
        )
        db.execute(stmt)

    # Bulk Upsert Branch Earnings
    if branch_earn_payload:
        stmt2 = pg_insert(BranchEarnings).values(branch_earn_payload)
        stmt2 = stmt2.on_conflict_do_update(
            index_elements=["plan_id", "branch_id", "b_earnings"],
            set_={
                "amount": stmt2.excluded.amount,
                "created_by": stmt2.excluded.created_by,
                "comment": stmt2.excluded.comment,
                "created_date": func.now(),
            }
        )
        db.execute(stmt2)

    # 🚀 Pre-calculate the Organization rollup
    _recalc_org_earnings(db, plan_id, list(updated_earning_ids))

    _write_audit(
        db,
        action="BUSINESSPLAN_EARNINGS_UPSERT",
        plan_id=plan_id,
        user_id=user_id,
        comment=f"bulk rows={len(body.rows)} unit_cells={len(unit_earn_payload)}",
    )

    db.commit()
    return {
        "ok": True,
        "plan_id": plan_id,
        "rows": len(body.rows),
        "unit_cells_upserted": len(unit_earn_payload),
        "branch_totals_upserted": len(branch_earn_payload),
    }


@router.post("/{plan_id}/earnings/monthly", status_code=status.HTTP_200_OK)
def upsert_monthly_earnings(
        plan_id: int,
        body: BulkSaveMonthlyEarningsIn,
        db: Session = Depends(get_db),
        user_id: int = Depends(get_current_user_id),
):
    _require_plan(db, plan_id)

    if not body.rows:
        return {"ok": True, "upserted": 0}

    # 1. Fetch existing Yearly Values to validate against
    unit_ids = list({row.unit_id for row in body.rows})
    b_earning_ids = list({row.b_earning for row in body.rows})

    yearly_records = (
        db.query(UnitEarnings.unit_id, UnitEarnings.business_earning, UnitEarnings.amount)
        .filter(UnitEarnings.plan_id == plan_id)
        .filter(UnitEarnings.unit_id.in_(unit_ids))
        .filter(UnitEarnings.business_cost.in_(b_earning_ids))
        .all()
    )

    # Create a quick lookup dictionary: {(unit_id, b_earning): yearly_amount}
    yearly_map = {(r.unit_id, r.business_earning): r.amount for r in yearly_records}

    upsert_payload = []

    # 2. Validation Loop
    for row in body.rows:
        lookup_key = (row.unit_id, row.b_earning)
        yearly_val = yearly_map.get(lookup_key)

        # Rule 1: Reject if yearly value is absent
        if yearly_val is None:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot save monthly data: No yearly data keyed for unit_id={row.unit_id}, b_earning={row.b_earning}"
            )

        # Rule 2: Reject if monthly sum does not match yearly value
        monthly_total = row.months.total
        if monthly_total != yearly_val:
            raise HTTPException(
                status_code=400,
                detail=f"Monthly sum ({monthly_total}) does not match yearly value ({yearly_val}) for unit_id={row.unit_id}"
            )

        # Prepare payload if validation passes
        upsert_payload.append({
            "plan_id": plan_id,
            "unit_id": row.unit_id,
            "b_earning": row.b_earning,
            "m1_value": row.months.m1_value,
            "m2_value": row.months.m2_value,
            "m3_value": row.months.m3_value,
            "m4_value": row.months.m4_value,
            "m5_value": row.months.m5_value,
            "m6_value": row.months.m6_value,
            "m7_value": row.months.m7_value,
            "m8_value": row.months.m8_value,
            "m9_value": row.months.m9_value,
            "m10_value": row.months.m10_value,
            "m11_value": row.months.m11_value,
            "m12_value": row.months.m12_value,
            "total_yearly_value": monthly_total
        })

    # 3. Bulk Upsert using PostgreSQL ON CONFLICT
    if upsert_payload:
        stmt = pg_insert(MonthlyUnitEarnings).values(upsert_payload)
        stmt = stmt.on_conflict_do_update(
            index_elements=["plan_id", "unit_id", "b_cost"],  # Matches uq_monthly_unit_costs
            set_={
                "m1_value": stmt.excluded.m1_value,
                "m2_value": stmt.excluded.m2_value,
                "m3_value": stmt.excluded.m3_value,
                "m4_value": stmt.excluded.m4_value,
                "m5_value": stmt.excluded.m5_value,
                "m6_value": stmt.excluded.m6_value,
                "m7_value": stmt.excluded.m7_value,
                "m8_value": stmt.excluded.m8_value,
                "m9_value": stmt.excluded.m9_value,
                "m10_value": stmt.excluded.m10_value,
                "m11_value": stmt.excluded.m11_value,
                "m12_value": stmt.excluded.m12_value,
                "total_yearly_value": stmt.excluded.total_yearly_value,
            }
        )
        db.execute(stmt)

    # Optional: Log the audit
    _write_audit(
        db,
        action="MONTHLY_COSTS_UPSERT",
        plan_id=plan_id,
        user_id=user_id,
        comment=f"upserted {len(upsert_payload)} monthly rows",
    )

    db.commit()
    return {
        "ok": True,
        "plan_id": plan_id,
        "monthly_rows_upserted": len(upsert_payload)
    }