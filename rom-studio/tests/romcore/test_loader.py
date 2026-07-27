import pytest
import os
import tempfile
from romcore.analyzer import SNESLoader
from romcore.models.rom import RomType

def test_snes_loader():
    with tempfile.NamedTemporaryFile(delete=False) as f:
        # Create a dummy 32KB file (minimum for a valid SNES ROM header at 0x7FC0)
        dummy_lorom = bytearray(b'\x00' * 0x8000)
        # Title (21 bytes)
        dummy_lorom[0x7FC0:0x7FD5] = b'SUPER SF2            '
        # Map mode (1 byte) 
        dummy_lorom[0x7FD5] = 0x20 # FastROM LoROM
        # ROM Size (1 byte)
        dummy_lorom[0x7FD7] = 0x0A # 1024KB
        # SRAM Size (1 byte)
        dummy_lorom[0x7FD8] = 0x00
        # Inverse Checksum
        dummy_lorom[0x7FDC:0x7FDE] = b'\x34\x12'
        # Checksum (0xFFFF ^ 0x1234 = 0xEDCB)
        dummy_lorom[0x7FDE:0x7FE0] = b'\xCB\xED'
        
        f.write(dummy_lorom)
        temp_path = f.name
        
    try:
        rom = SNESLoader.load(temp_path)
        assert rom.info.title == "SUPER SF2"
        assert rom.info.is_fastrom is True
        assert rom.info.has_copier_header is False
        assert rom.info.rom_type == RomType.SNES_LOROM
        assert rom.info.checksum == 0xEDCB
        
        rom.close()
    finally:
        os.remove(temp_path)
