"""
Pydantic schemas for request/response validation
"""

from schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserLogin,
    TokenResponse
)
from schemas.location import (
    TerritoryCreate,
    TerritoryUpdate,
    TerritoryResponse,
    AreaCreate,
    AreaUpdate,
    AreaResponse,
    BranchCreate,
    BranchUpdate,
    BranchResponse
)
from schemas.inventory import (
    FlavorCreate,
    FlavorUpdate,
    FlavorResponse,
    DailyInventoryCreate,
    DailyInventoryResponse,
    TubReceiptCreate,
    TubReceiptResponse,
    InventoryEntryBulk
)

__all__ = [
    # User
    "UserCreate", "UserUpdate", "UserResponse", "UserLogin", "TokenResponse",
    # Location
    "TerritoryCreate", "TerritoryUpdate", "TerritoryResponse",
    "AreaCreate", "AreaUpdate", "AreaResponse",
    "BranchCreate", "BranchUpdate", "BranchResponse",
    # Inventory
    "FlavorCreate", "FlavorUpdate", "FlavorResponse",
    "DailyInventoryCreate", "DailyInventoryResponse",
    "TubReceiptCreate", "TubReceiptResponse",
    "InventoryEntryBulk"
]
