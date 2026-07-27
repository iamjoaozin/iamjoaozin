import numpy as np
from typing import List, Tuple

class MemoryComparator:
    """
    Compares arbitrary memory dumps against the ROM or WRAM to find correlations.
    """
    def __init__(self, data: bytes):
        self.data = data
        
    def compare_dump(self, dump_data: bytes, min_score: float = 0.5) -> List[Tuple[int, float]]:
        """
        Compares a dump against the data.
        Returns a sorted list of tuples (offset, similarity_score).
        """
        # Using exact search for performance in v0.3
        matches = self.find_exact_match(dump_data)
        return [(m, 1.0) for m in matches]
        
    def find_exact_match(self, pattern: bytes) -> List[int]:
        matches = []
        start = 0
        while True:
            idx = self.data.find(pattern, start)
            if idx == -1:
                break
            matches.append(idx)
            start = idx + 1
        return matches
