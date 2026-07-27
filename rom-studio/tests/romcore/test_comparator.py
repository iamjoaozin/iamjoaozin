import pytest
import numpy as np
from romcore.analyzer.comparator import MemoryComparator
from romcore.models.rom import RomData
from unittest.mock import MagicMock

def test_memory_comparator():
    # Build dummy ROM data: 4096 bytes of 0x00
    rom_data = bytearray(b'\x00' * 4096)
    
    # Inject a specific pattern at offset 2048
    pattern = bytearray([0xDE, 0xAD, 0xBE, 0xEF, 0x12, 0x34])
    rom_data[2048:2048+6] = pattern
    
    # Add a partial match at offset 1024
    partial_pattern = bytearray([0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x00])
    rom_data[1024:1024+6] = partial_pattern
    
    rom = MagicMock(spec=RomData)
    rom.mmap = rom_data
    
    comparator = MemoryComparator(rom)
    
    # We dump exactly the pattern
    dump = pattern
    results = comparator.compare_dump(dump, min_score=0.5)
    
    # We should have two results:
    # 1. Exact match at 2048 (score 1.0)
    # 2. Partial match at 1024 (score 4/6 = 0.66)
    
    assert len(results) == 2
    
    res1, score1 = results[0]
    assert res1 == 2048
    assert score1 == 1.0
    
    res2, score2 = results[1]
    assert res2 == 1024
    assert round(score2, 2) == 0.67
