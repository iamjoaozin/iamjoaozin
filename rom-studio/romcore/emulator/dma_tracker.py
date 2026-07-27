from dataclasses import dataclass
from typing import List
import time

@dataclass
class DMAEntry:
    id: int
    frame: int
    timestamp: float
    channel: int
    mode: int
    source: int
    dest: int
    length: int

class DMATracker:
    """Records and manages the history of DMA transfers."""
    
    def __init__(self):
        self.history: List[DMAEntry] = []
        self._next_id = 1
        
    def add_transfer(self, frame: int, channel: int, mode: int, source: int, dest: int, length: int) -> DMAEntry:
        entry = DMAEntry(
            id=self._next_id,
            frame=frame,
            timestamp=time.time(),
            channel=channel,
            mode=mode,
            source=source,
            dest=dest,
            length=length
        )
        self._next_id += 1
        self.history.append(entry)
        return entry
        
    def clear(self):
        self.history.clear()
        self._next_id = 1
