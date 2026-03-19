from __future__ import annotations

from typing import List, Optional
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field, condecimal, conint
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from Database import SessionLocal
from models import BusinessPlan, Units, AuxCosts, UnitAux, AuditLog, BranchAux, MonthlyUnitAux
from auth import get_current_user_id as get_current_user_id

router = APIRouter(prefix="/business-plan", tags=["unit-aux-costs"])
#reload

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


Money = condecimal(max_digits=14, decimal_places=3, ge=0)


class UnitAuxCellIn(BaseModel):
    unit_id: conint(gt=0)
    aux_id: conint(gt=0)
    amount: Money = Field(default=Decimal("0"))
    comment: Optional[str] = None


class UnitAuxBulkIn(BaseModel):
    branch_id: Optional[int] = None
    cells: List[UnitAuxCellIn] = Field(default_factory=list)

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

class MonthlyUnitAuxRowIn(BaseModel):
    unit_id: int
    b_aux: int
    months: MonthlyValuesIn

class BulkSaveMonthlyAuxIn(BaseModel):
    rows: List[MonthlyUnitAuxRowIn] = Field(default_factory=list)

def _require_plan(db: Session, plan_id: int) -> None:
    ok = db.query(BusinessPlan.id).filter(BusinessPlan.id == plan_id).first()
    if not ok:
        raise HTTPException(status_code=404, detail="BusinessPlan not found")


def _validate_units_exist_and_optional_branch(db: Session, unit_ids: List[int], branch_id: Optional[int]) -> None:
    if not unit_ids:
        return

    q = db.query(Units.id, Units.branch_id).filter(Units.id.in_(unit_ids)).all()
    found = {r[0]: r[1] for r in q}

    missing = [uid for uid in unit_ids if uid not in found]
    if missing:
        raise HTTPException(status_code=422, detail={"msg": "Some unit_id not found", "missing_unit_ids": missing})

    if branch_id is not None:
        bad = [uid for uid, b in found.items() if b != branch_id]
        if bad:
            raise HTTPException(
                status_code=400,
                detail=f"Some unit_id do not belong to branch_id={branch_id}: {bad}",
            )


def _validate_aux_exist(db: Session, aux_ids: List[int]) -> None:
    if not aux_ids:
        return

    rows = db.query(AuxCosts.id).filter(AuxCosts.id.in_(aux_ids)).all()
    ok = {r[0] for r in rows}
    missing = [aid for aid in aux_ids if aid not in ok]
    if missing:
        raise HTTPException(status_code=422, detail={"msg": "Some aux_id not found", "missing_aux_ids": missing})


def _audit(db: Session, *, user_id: Optional[int], plan_id: int, inserted: int, updated: int):
    db.add(AuditLog(
        action="UNITAUX_UPSERT_BULK",
        action_id=str(plan_id),
        user_id=user_id,
        comment=f"inserted={inserted} updated={updated}",
    ))


def _recalc_branch_aux(db: Session, plan_id: int, branch_id: int, aux_ids: List[int], user_id: int):
    if not aux_ids:
        return
    sums = (
        db.query(UnitAux.aux_id, func.sum(UnitAux.amount).label("total"))
        .join(Units, Units.id == UnitAux.unit_id)
        .filter(UnitAux.plan_id == plan_id, Units.branch_id == branch_id, UnitAux.aux_id.in_(aux_ids))
        .group_by(UnitAux.aux_id)
        .all()
    )

    upsert_data = []
    for row in sums:
        upsert_data.append({
            "plan_id": plan_id,
            "branch_id": branch_id,
            "aux_id": row.aux_id,
            "amount": row.total,
            "created_by": user_id,
            "date_time": func.now()
        })

    if upsert_data:
        stmt = pg_insert(BranchAux).values(upsert_data)
        stmt = stmt.on_conflict_do_update(
            index_elements=["plan_id", "branch_id", "aux_id"],
            set_={
                "amount": stmt.excluded.amount,
                "date_time": func.now(),
                "created_by": stmt.excluded.created_by
            }
        )
        db.execute(stmt)


@router.get("/{plan_id}/aux-costs")
def get_unit_aux_values(
        plan_id: int,
        branch_id: int = Query(...),
        db: Session = Depends(get_db),
):
    _require_plan(db, plan_id)
    rows = (
        db.query(UnitAux)
        .join(Units, Units.id == UnitAux.unit_id)
        .filter(UnitAux.plan_id == plan_id)
        .filter(Units.branch_id == branch_id)
        .all()
    )
    return [
        {
            "unit_id": r.unit_id,
            "aux_id": r.aux_id,
            "amount": float(r.amount or 0),
            "comment": r.comment,
        }
        for r in rows
    ]


@router.put("/{plan_id}/aux-costs/bulk", status_code=status.HTTP_200_OK)
def upsert_unit_aux_bulk(
        plan_id: int,
        body: UnitAuxBulkIn,
        db: Session = Depends(get_db),
        user_id: int = Depends(get_current_user_id),
):
    _require_plan(db, plan_id)

    if not body.cells:
        return {"ok": True, "plan_id": plan_id, "inserted": 0, "updated": 0}

    unit_ids = sorted({c.unit_id for c in body.cells})
    aux_ids = sorted({c.aux_id for c in body.cells})

    _validate_units_exist_and_optional_branch(db, unit_ids, body.branch_id)
    _validate_aux_exist(db, aux_ids)

    existing = (
        db.query(UnitAux.unit_id, UnitAux.aux_id)
        .filter(UnitAux.plan_id == plan_id)
        .filter(UnitAux.unit_id.in_(unit_ids))
        .filter(UnitAux.aux_id.in_(aux_ids))
        .all()
    )
    existing_set = {(u, a) for (u, a) in existing}

    inserted = 0
    updated = 0
    values_to_upsert = []

    for c in body.cells:
        key = (int(c.unit_id), int(c.aux_id))
        if key in existing_set:
            updated += 1
        else:
            inserted += 1
            existing_set.add(key)

        values_to_upsert.append({
            "plan_id": plan_id,
            "unit_id": c.unit_id,
            "aux_id": c.aux_id,
            "amount": c.amount,
            "created_by": user_id,
            "comment": c.comment,
        })

    if values_to_upsert:
        stmt = pg_insert(UnitAux).values(values_to_upsert)
        stmt = stmt.on_conflict_do_update(
            index_elements=["plan_id", "unit_id", "aux_id"],
            set_={
                "amount": stmt.excluded.amount,
                "created_by": stmt.excluded.created_by,
                "comment": stmt.excluded.comment,
                "date_time": func.now(),
            },
        )
        db.execute(stmt)

    _audit(db, user_id=user_id, plan_id=plan_id, inserted=inserted, updated=updated)

    # 🚀 Update the new rollup table
    branches = db.query(Units.branch_id).filter(Units.id.in_(unit_ids)).distinct().all()
    branch_ids = [r[0] for r in branches if r[0] is not None]
    for bid in branch_ids:
        _recalc_branch_aux(db, plan_id, bid, aux_ids, user_id)

    db.commit()
    return {
        "ok": True,
        "plan_id": plan_id,
        "branch_id": body.branch_id,
        "inserted": inserted,
        "updated": updated,
        "cells": len(body.cells),
    }

@router.post("/{plan_id}/earnings/monthly", status_code=status.HTTP_200_OK)
def upsert_monthly_earnings(
        plan_id: int,
        body: BulkSaveMonthlyAuxIn,
        db: Session = Depends(get_db),
        user_id: int = Depends(get_current_user_id),
):
    _require_plan(db, plan_id)

    if not body.rows:
        return {"ok": True, "upserted": 0}

    # 1. Fetch existing Yearly Values to validate against
    unit_ids = list({row.unit_id for row in body.rows})
    b_aux_ids = list({row.b_aux for row in body.rows})

    yearly_records = (
        db.query(UnitAux.unit_id, UnitAux.aux_id, UnitAux.amount)
        .filter(UnitAux.plan_id == plan_id)
        .filter(UnitAux.unit_id.in_(unit_ids))
        .filter(UnitAux.business_aux.in_(b_aux_ids))
        .all()
    )

    # Create a quick lookup dictionary: {(unit_id, b_aux): yearly_amount}
    yearly_map = {(r.unit_id, r.aux_id): r.amount for r in yearly_records}

    upsert_payload = []

    # 2. Validation Loop
    for row in body.rows:
        lookup_key = (row.unit_id, row.b_aux)
        yearly_val = yearly_map.get(lookup_key)

        # Rule 1: Reject if yearly value is absent
        if yearly_val is None:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot save monthly data: No yearly data keyed for unit_id={row.unit_id}, b_earning={row.b_aux}"
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
            "b_aux": row.b_aux,
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
        stmt = pg_insert(MonthlyUnitAux).values(upsert_payload)
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
    _audit(
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