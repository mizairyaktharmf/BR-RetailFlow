"""
Cake Inventory router
Handles cake stock management, sales, receipts, and low-stock alerts
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import date, datetime

from utils.database import get_db
from utils.security import get_current_user, require_role
from models.user import User, UserRole
from models.location import Branch, Area
from models.cake import CakeProduct, CakeStock, CakeStockLog, CakeStockChangeType, CakeAlertConfig
from schemas.cake import (
    CakeProductCreate, CakeProductUpdate, CakeProductResponse,
    CakeStockResponse,
    CakeStockSaleBulk, CakeStockReceiveBulk,
    CakeStockAdjustment, CakeStockInitBulk,
    CakeStockLogResponse,
    CakeAlertConfigCreate, CakeAlertConfigBulk, CakeAlertConfigResponse,
    LowStockAlert, LowStockAlertList,
)

router = APIRouter()


# ============== HELPER FUNCTIONS ==============

def verify_branch_access(current_user: User, branch: Branch):
    """Check if user has access to a branch"""
    if current_user.role == UserRole.STAFF:
        if branch.id != current_user.branch_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.ADMIN:
        if branch.area_id != current_user.area_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == UserRole.SUPER_ADMIN:
        if branch.area.territory_id != current_user.territory_id:
            raise HTTPException(status_code=403, detail="Access denied")


def get_effective_threshold(db: Session, branch_id: int, cake_product_id: int, default: int) -> int:
    """Get alert threshold: branch-specific config or product default"""
    config = db.query(CakeAlertConfig).filter(
        and_(
            CakeAlertConfig.branch_id == branch_id,
            CakeAlertConfig.cake_product_id == cake_product_id,
            CakeAlertConfig.is_enabled == True
        )
    ).first()
    return config.threshold if config else default


# ============== CAKE PRODUCTS ==============

@router.get("/cake-products", response_model=List[CakeProductResponse])
async def list_cake_products(
    category: Optional[str] = None,
    active_only: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all cake products"""
    query = db.query(CakeProduct)
    if active_only:
        query = query.filter(CakeProduct.is_active == True)
    if category:
        query = query.filter(CakeProduct.category == category)
    return query.order_by(CakeProduct.name).all()


@router.post("/cake-products", response_model=CakeProductResponse, status_code=status.HTTP_201_CREATED)
async def create_cake_product(
    data: CakeProductCreate,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    """Create a cake product (supreme_admin only)"""
    existing = db.query(CakeProduct).filter(
        (CakeProduct.name == data.name) | (CakeProduct.code == data.code)
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Cake product with this name or code already exists")

    product = CakeProduct(**data.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.put("/cake-products/{product_id}", response_model=CakeProductResponse)
async def update_cake_product(
    product_id: int,
    data: CakeProductUpdate,
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    """Update a cake product"""
    product = db.query(CakeProduct).filter(CakeProduct.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Cake product not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


@router.post("/cake-products/bulk", response_model=List[CakeProductResponse], status_code=status.HTTP_201_CREATED)
async def bulk_create_cake_products(
    products: List[CakeProductCreate],
    current_user: User = Depends(require_role([UserRole.SUPREME_ADMIN])),
    db: Session = Depends(get_db)
):
    """Bulk create cake products"""
    created = []
    for data in products:
        existing = db.query(CakeProduct).filter(
            (CakeProduct.name == data.name) | (CakeProduct.code == data.code)
        ).first()
        if existing:
            continue
        product = CakeProduct(**data.model_dump())
        db.add(product)
        created.append(product)

    db.commit()
    for p in created:
        db.refresh(p)
    return created


# ============== CAKE STOCK ==============

@router.get("/cake-stock/{branch_id}", response_model=List[CakeStockResponse])
async def get_cake_stock(
    branch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current cake stock for a branch"""
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    verify_branch_access(current_user, branch)

    stocks = db.query(CakeStock).filter(CakeStock.branch_id == branch_id).all()

    result = []
    for stock in stocks:
        product = stock.cake_product
        threshold = get_effective_threshold(db, branch_id, product.id, product.default_alert_threshold)
        response = CakeStockResponse(
            id=stock.id,
            branch_id=stock.branch_id,
            cake_product_id=stock.cake_product_id,
            current_quantity=stock.current_quantity,
            last_updated_at=stock.last_updated_at,
            cake_name=product.name,
            cake_code=product.code,
            category=product.category,
            alert_threshold=threshold,
            is_low_stock=stock.current_quantity <= threshold,
        )
        result.append(response)

    return result


@router.post("/cake-stock/init", response_model=List[CakeStockResponse], status_code=status.HTTP_201_CREATED)
async def init_cake_stock(
    data: CakeStockInitBulk,
    current_user: User = Depends(require_role([UserRole.STAFF])),
    db: Session = Depends(get_db)
):
    """Initial stock upload for a branch"""
    if data.branch_id != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Can only set stock for your branch")

    created = []
    for item in data.items:
        product = db.query(CakeProduct).filter(CakeProduct.id == item.cake_product_id).first()
        if not product:
            continue

        existing = db.query(CakeStock).filter(
            and_(CakeStock.branch_id == data.branch_id, CakeStock.cake_product_id == item.cake_product_id)
        ).first()

        if existing:
            qty_before = existing.current_quantity
            existing.current_quantity = item.quantity
            existing.last_updated_by_id = current_user.id
            stock = existing
        else:
            qty_before = 0
            stock = CakeStock(
                branch_id=data.branch_id,
                cake_product_id=item.cake_product_id,
                current_quantity=item.quantity,
                last_updated_by_id=current_user.id,
            )
            db.add(stock)

        log = CakeStockLog(
            branch_id=data.branch_id,
            cake_product_id=item.cake_product_id,
            change_type=CakeStockChangeType.INITIAL,
            quantity_change=item.quantity - qty_before,
            quantity_before=qty_before,
            quantity_after=item.quantity,
            notes="Initial stock upload",
            recorded_by_id=current_user.id,
        )
        db.add(log)
        created.append((stock, product))

    db.commit()

    result = []
    for stock, product in created:
        db.refresh(stock)
        threshold = get_effective_threshold(db, data.branch_id, product.id, product.default_alert_threshold)
        result.append(CakeStockResponse(
            id=stock.id,
            branch_id=stock.branch_id,
            cake_product_id=stock.cake_product_id,
            current_quantity=stock.current_quantity,
            last_updated_at=stock.last_updated_at,
            cake_name=product.name,
            cake_code=product.code,
            category=product.category,
            alert_threshold=threshold,
            is_low_stock=stock.current_quantity <= threshold,
        ))

    return result


@router.post("/cake-stock/sale", response_model=List[CakeStockResponse])
async def record_cake_sale(
    data: CakeStockSaleBulk,
    current_user: User = Depends(require_role([UserRole.STAFF])),
    db: Session = Depends(get_db)
):
    """Record cake sale(s) - decrements stock"""
    if data.branch_id != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Can only record sales for your branch")

    updated = []
    for item in data.items:
        stock = db.query(CakeStock).filter(
            and_(CakeStock.branch_id == data.branch_id, CakeStock.cake_product_id == item.cake_product_id)
        ).first()

        if not stock:
            raise HTTPException(
                status_code=400,
                detail=f"No stock record for cake product {item.cake_product_id}. Please initialize stock first."
            )

        if stock.current_quantity < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {stock.cake_product.name}. Available: {stock.current_quantity}, Requested: {item.quantity}"
            )

        qty_before = stock.current_quantity
        stock.current_quantity -= item.quantity
        stock.last_updated_by_id = current_user.id

        log = CakeStockLog(
            branch_id=data.branch_id,
            cake_product_id=item.cake_product_id,
            change_type=CakeStockChangeType.SALE,
            quantity_change=-item.quantity,
            quantity_before=qty_before,
            quantity_after=stock.current_quantity,
            notes=item.notes,
            recorded_by_id=current_user.id,
        )
        db.add(log)
        updated.append(stock)

    db.commit()

    result = []
    for stock in updated:
        db.refresh(stock)
        product = stock.cake_product
        threshold = get_effective_threshold(db, data.branch_id, product.id, product.default_alert_threshold)
        result.append(CakeStockResponse(
            id=stock.id,
            branch_id=stock.branch_id,
            cake_product_id=stock.cake_product_id,
            current_quantity=stock.current_quantity,
            last_updated_at=stock.last_updated_at,
            cake_name=product.name,
            cake_code=product.code,
            category=product.category,
            alert_threshold=threshold,
            is_low_stock=stock.current_quantity <= threshold,
        ))

    return result


@router.post("/cake-stock/receive", response_model=List[CakeStockResponse])
async def receive_cakes(
    data: CakeStockReceiveBulk,
    current_user: User = Depends(require_role([UserRole.STAFF])),
    db: Session = Depends(get_db)
):
    """Record receiving cakes from warehouse - increments stock"""
    if data.branch_id != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Can only record receipts for your branch")

    updated = []
    for item in data.items:
        product = db.query(CakeProduct).filter(CakeProduct.id == item.cake_product_id).first()
        if not product:
            continue

        stock = db.query(CakeStock).filter(
            and_(CakeStock.branch_id == data.branch_id, CakeStock.cake_product_id == item.cake_product_id)
        ).first()

        if stock:
            qty_before = stock.current_quantity
            stock.current_quantity += item.quantity
            stock.last_updated_by_id = current_user.id
        else:
            qty_before = 0
            stock = CakeStock(
                branch_id=data.branch_id,
                cake_product_id=item.cake_product_id,
                current_quantity=item.quantity,
                last_updated_by_id=current_user.id,
            )
            db.add(stock)

        log = CakeStockLog(
            branch_id=data.branch_id,
            cake_product_id=item.cake_product_id,
            change_type=CakeStockChangeType.RECEIVED,
            quantity_change=item.quantity,
            quantity_before=qty_before,
            quantity_after=qty_before + item.quantity,
            reference_number=data.reference_number,
            notes=item.notes,
            recorded_by_id=current_user.id,
        )
        db.add(log)
        updated.append((stock, product))

    db.commit()

    result = []
    for stock, product in updated:
        db.refresh(stock)
        threshold = get_effective_threshold(db, data.branch_id, product.id, product.default_alert_threshold)
        result.append(CakeStockResponse(
            id=stock.id,
            branch_id=stock.branch_id,
            cake_product_id=stock.cake_product_id,
            current_quantity=stock.current_quantity,
            last_updated_at=stock.last_updated_at,
            cake_name=product.name,
            cake_code=product.code,
            category=product.category,
            alert_threshold=threshold,
            is_low_stock=stock.current_quantity <= threshold,
        ))

    return result


@router.post("/cake-stock/adjust", response_model=CakeStockResponse)
async def adjust_cake_stock(
    data: CakeStockAdjustment,
    current_user: User = Depends(require_role([UserRole.STAFF])),
    db: Session = Depends(get_db)
):
    """Manual stock adjustment (set absolute quantity)"""
    if data.branch_id != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Can only adjust stock for your branch")

    product = db.query(CakeProduct).filter(CakeProduct.id == data.cake_product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Cake product not found")

    stock = db.query(CakeStock).filter(
        and_(CakeStock.branch_id == data.branch_id, CakeStock.cake_product_id == data.cake_product_id)
    ).first()

    if stock:
        qty_before = stock.current_quantity
        stock.current_quantity = data.new_quantity
        stock.last_updated_by_id = current_user.id
    else:
        qty_before = 0
        stock = CakeStock(
            branch_id=data.branch_id,
            cake_product_id=data.cake_product_id,
            current_quantity=data.new_quantity,
            last_updated_by_id=current_user.id,
        )
        db.add(stock)

    log = CakeStockLog(
        branch_id=data.branch_id,
        cake_product_id=data.cake_product_id,
        change_type=CakeStockChangeType.ADJUSTMENT,
        quantity_change=data.new_quantity - qty_before,
        quantity_before=qty_before,
        quantity_after=data.new_quantity,
        notes=data.notes or "Manual adjustment",
        recorded_by_id=current_user.id,
    )
    db.add(log)
    db.commit()
    db.refresh(stock)

    threshold = get_effective_threshold(db, data.branch_id, product.id, product.default_alert_threshold)
    return CakeStockResponse(
        id=stock.id,
        branch_id=stock.branch_id,
        cake_product_id=stock.cake_product_id,
        current_quantity=stock.current_quantity,
        last_updated_at=stock.last_updated_at,
        cake_name=product.name,
        cake_code=product.code,
        category=product.category,
        alert_threshold=threshold,
        is_low_stock=stock.current_quantity <= threshold,
    )


# ============== STOCK LOGS ==============

@router.get("/cake-stock/logs/{branch_id}", response_model=List[CakeStockLogResponse])
async def get_stock_logs(
    branch_id: int,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    cake_product_id: Optional[int] = None,
    change_type: Optional[CakeStockChangeType] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get stock change history for a branch"""
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    verify_branch_access(current_user, branch)

    query = db.query(CakeStockLog).filter(CakeStockLog.branch_id == branch_id)

    if date_from:
        query = query.filter(CakeStockLog.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to:
        query = query.filter(CakeStockLog.created_at <= datetime.combine(date_to, datetime.max.time()))
    if cake_product_id:
        query = query.filter(CakeStockLog.cake_product_id == cake_product_id)
    if change_type:
        query = query.filter(CakeStockLog.change_type == change_type)

    logs = query.order_by(CakeStockLog.created_at.desc()).limit(200).all()

    result = []
    for log in logs:
        response = CakeStockLogResponse.model_validate(log)
        response.recorded_by_name = log.recorded_by.full_name if log.recorded_by else None
        response.cake_name = log.cake_product.name if log.cake_product else None
        result.append(response)

    return result


# ============== LOW STOCK ALERTS ==============

@router.get("/cake-stock/alerts", response_model=LowStockAlertList)
async def get_low_stock_alerts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all low-stock cake alerts based on user's role scope"""
    # Determine branch scope based on role
    if current_user.role == UserRole.STAFF:
        branch_ids = [current_user.branch_id]
    elif current_user.role == UserRole.ADMIN:
        branches = db.query(Branch).filter(Branch.area_id == current_user.area_id).all()
        branch_ids = [b.id for b in branches]
    elif current_user.role == UserRole.SUPER_ADMIN:
        areas = db.query(Area).filter(Area.territory_id == current_user.territory_id).all()
        area_ids = [a.id for a in areas]
        branches = db.query(Branch).filter(Branch.area_id.in_(area_ids)).all()
        branch_ids = [b.id for b in branches]
    else:
        branches = db.query(Branch).filter(Branch.is_active == True).all()
        branch_ids = [b.id for b in branches]

    stocks = db.query(CakeStock).filter(CakeStock.branch_id.in_(branch_ids)).all()

    alerts = []
    critical_count = 0
    warning_count = 0

    for stock in stocks:
        product = stock.cake_product
        if not product or not product.is_active:
            continue

        threshold = get_effective_threshold(db, stock.branch_id, product.id, product.default_alert_threshold)

        if stock.current_quantity <= threshold:
            severity = "critical" if stock.current_quantity == 0 else "warning"
            if severity == "critical":
                critical_count += 1
            else:
                warning_count += 1

            branch = stock.branch
            alerts.append(LowStockAlert(
                cake_product_id=product.id,
                cake_name=product.name,
                cake_code=product.code,
                branch_id=stock.branch_id,
                branch_name=branch.name if branch else "Unknown",
                current_quantity=stock.current_quantity,
                threshold=threshold,
                severity=severity,
            ))

    alerts.sort(key=lambda a: (0 if a.severity == "critical" else 1, a.current_quantity))

    return LowStockAlertList(
        alerts=alerts,
        total_count=len(alerts),
        critical_count=critical_count,
        warning_count=warning_count,
    )


# ============== ALERT CONFIGURATION ==============

@router.get("/cake-stock/alerts/config/{branch_id}", response_model=List[CakeAlertConfigResponse])
async def get_alert_configs(
    branch_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get alert configurations for a branch"""
    branch = db.query(Branch).filter(Branch.id == branch_id).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    verify_branch_access(current_user, branch)

    configs = db.query(CakeAlertConfig).filter(CakeAlertConfig.branch_id == branch_id).all()

    result = []
    for config in configs:
        response = CakeAlertConfigResponse.model_validate(config)
        response.cake_name = config.cake_product.name if config.cake_product else None
        result.append(response)

    return result


@router.post("/cake-stock/alerts/config", response_model=CakeAlertConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_or_update_alert_config(
    data: CakeAlertConfigCreate,
    current_user: User = Depends(require_role([UserRole.STAFF])),
    db: Session = Depends(get_db)
):
    """Create or update a single alert configuration"""
    if data.branch_id != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Can only configure alerts for your branch")

    product = db.query(CakeProduct).filter(CakeProduct.id == data.cake_product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Cake product not found")

    existing = db.query(CakeAlertConfig).filter(
        and_(CakeAlertConfig.branch_id == data.branch_id, CakeAlertConfig.cake_product_id == data.cake_product_id)
    ).first()

    if existing:
        existing.threshold = data.threshold
        existing.is_enabled = data.is_enabled
        existing.configured_by_id = current_user.id
        config = existing
    else:
        config = CakeAlertConfig(
            branch_id=data.branch_id,
            cake_product_id=data.cake_product_id,
            threshold=data.threshold,
            is_enabled=data.is_enabled,
            configured_by_id=current_user.id,
        )
        db.add(config)

    db.commit()
    db.refresh(config)

    response = CakeAlertConfigResponse.model_validate(config)
    response.cake_name = product.name
    return response


@router.post("/cake-stock/alerts/config/bulk", response_model=List[CakeAlertConfigResponse])
async def bulk_update_alert_configs(
    data: CakeAlertConfigBulk,
    current_user: User = Depends(require_role([UserRole.STAFF])),
    db: Session = Depends(get_db)
):
    """Bulk update alert configurations for a branch"""
    if data.branch_id != current_user.branch_id:
        raise HTTPException(status_code=403, detail="Can only configure alerts for your branch")

    updated = []
    for item in data.configs:
        product = db.query(CakeProduct).filter(CakeProduct.id == item.cake_product_id).first()
        if not product:
            continue

        existing = db.query(CakeAlertConfig).filter(
            and_(CakeAlertConfig.branch_id == data.branch_id, CakeAlertConfig.cake_product_id == item.cake_product_id)
        ).first()

        if existing:
            existing.threshold = item.threshold
            existing.is_enabled = item.is_enabled
            existing.configured_by_id = current_user.id
            config = existing
        else:
            config = CakeAlertConfig(
                branch_id=data.branch_id,
                cake_product_id=item.cake_product_id,
                threshold=item.threshold,
                is_enabled=item.is_enabled,
                configured_by_id=current_user.id,
            )
            db.add(config)

        updated.append((config, product))

    db.commit()

    result = []
    for config, product in updated:
        db.refresh(config)
        response = CakeAlertConfigResponse.model_validate(config)
        response.cake_name = product.name
        result.append(response)

    return result
