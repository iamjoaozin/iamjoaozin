from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, Any, List, Optional

class RegionType(Enum):
    CODE = "Code"
    DATA = "Data"
    GRAPHICS = "Graphics"
    TEXT = "Text"
    POINTERS = "Pointers"
    PALETTE = "Palette"
    COMPRESSED = "Compressed"
    UNKNOWN = "Unknown"

@dataclass
class Region:
    """Intermediate Representation (IR) of a specific ROM region."""
    id: str
    start: int
    end: int
    bank: int
    region_type: RegionType
    entropy: float = 0.0
    confidence: float = 0.0
    tags: set[str] = field(default_factory=set)
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def size(self) -> int:
        return self.end - self.start

@dataclass
class RomMap:
    """The central data model representing the completely parsed and analyzed ROM structure."""
    regions: Dict[str, Region] = field(default_factory=dict)
    
    def add_region(self, region: Region):
        """Adds or updates a region in the ROM Map."""
        self.regions[region.id] = region
        
    def get_region(self, region_id: str) -> Optional[Region]:
        """Retrieves a specific region by its ID."""
        return self.regions.get(region_id)
        
    def get_regions_by_type(self, region_type: RegionType) -> List[Region]:
        """Returns all regions of a specific type."""
        return [r for r in self.regions.values() if r.region_type == region_type]
        
    def get_region_at(self, offset: int) -> Optional[Region]:
        """Finds the region containing the given physical offset."""
        # Simple linear search for alpha. Can be optimized with binary search or interval tree later.
        for r in self.regions.values():
            if r.start <= offset < r.end:
                return r
        return None
    
    def get_regions_in_range(self, start: int, end: int) -> List[Region]:
        """Finds regions that intersect with a given address range."""
        return [
            r for r in self.regions.values() 
            if (r.start < end and r.end > start)
        ]
