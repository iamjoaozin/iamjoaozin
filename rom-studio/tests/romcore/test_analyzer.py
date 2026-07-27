import pytest
import os
import tempfile
import numpy as np
from romcore.analyzer import RomAnalyzer
from romcore.models.rom import RomData, RomInfo, RomType
from romcore.models.rom_map import RegionType

def test_rom_analyzer():
    with tempfile.NamedTemporaryFile(delete=False) as f:
        # Create a dummy 8KB file
        # 4KB of zeros (UNKNOWN / Empty)
        # 4KB of random bytes (COMPRESSED / High entropy)
        part1 = bytearray(b'\x00' * 4096)
        part2 = np.random.randint(0, 256, 4096, dtype=np.uint8).tobytes()
        f.write(part1 + part2)
        temp_path = f.name
        
    try:
        rom = RomData(temp_path)
        rom.load()
        rom.info = RomInfo(
            rom_type=RomType.SNES_LOROM,
            size_bytes=8192,
            header_offset=0
        )
        
        analyzer = RomAnalyzer(rom, chunk_size=4096)
        rom_map = analyzer.analyze()
        
        regions = list(rom_map.regions.values())
        assert len(regions) == 2
        
        r1 = regions[0]
        assert r1.start == 0
        assert r1.end == 4096
        assert r1.region_type == RegionType.UNKNOWN
        assert r1.entropy == 0.0
        
        r2 = regions[1]
        assert r2.start == 4096
        assert r2.end == 8192
        assert r2.region_type == RegionType.COMPRESSED
        assert r2.entropy > 7.5
        
        rom.close()
    finally:
        os.remove(temp_path)
