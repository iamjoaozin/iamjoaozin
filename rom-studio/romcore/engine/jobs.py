from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Any, Optional, Dict, Tuple

class JobStatus(Enum):
    PENDING = "Pending"
    RUNNING = "Running"
    PAUSED = "Paused"
    COMPLETED = "Completed"
    FAILED = "Failed"
    CANCELLED = "Cancelled"

@dataclass
class Job:
    """Represents a discrete task executed by the Engine."""
    id: str
    name: str
    target: Callable
    args: Tuple = field(default_factory=tuple)
    kwargs: Dict[str, Any] = field(default_factory=dict)
    
    # State tracking
    status: JobStatus = JobStatus.PENDING
    progress: float = 0.0
    result: Any = None
    error: Optional[Exception] = None
