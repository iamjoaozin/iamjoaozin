import numpy as np
from ..models.rom import RomData, RomType

class SNESLoader:
    """Parses and validates SNES ROMs (.smc, .sfc)."""
    
    @staticmethod
    def load(path: str) -> RomData:
        rom = RomData(path)
        rom.load()
        
        # Detect copier header
        file_size = rom.info.size_bytes
        has_copier_header = (file_size % 1024 == 512)
        header_offset = 512 if has_copier_header else 0
        
        rom.info.has_copier_header = has_copier_header
        rom.info.header_offset = header_offset
        rom.info.banks = (file_size - header_offset) // 0x8000
        
        # SNES Header candidates
        # LoROM header is at 0x7FC0
        # HiROM header is at 0xFFC0
        lorom_header = header_offset + 0x7FC0
        hirom_header = header_offset + 0xFFC0
        
        # Calculate checksum for entire ROM (excluding SMC header)
        calculated_checksum = SNESLoader._calculate_checksum(rom, header_offset)
        rom.info.calculated_checksum = calculated_checksum
        
        # Simple heuristic to determine LoROM vs HiROM based on checksum
        score_lorom = SNESLoader._score_header(rom, lorom_header)
        score_hirom = SNESLoader._score_header(rom, hirom_header)
        
        # Check ExHiROM (header at 0x40FFC0)
        exhirom_header = header_offset + 0x40FFC0
        score_exhirom = SNESLoader._score_header(rom, exhirom_header) if file_size > 0x400000 else -1
        
        if score_exhirom > score_lorom and score_exhirom > score_hirom:
            target_header = exhirom_header
            rom.info.rom_type = RomType.SNES_EXHIROM
        elif score_hirom > score_lorom:
            target_header = hirom_header
            rom.info.rom_type = RomType.SNES_HIROM
        else:
            target_header = lorom_header
            rom.info.rom_type = RomType.SNES_LOROM
        
        # Read header details
        try:
            # Title is 21 bytes
            title_bytes = rom.read_bytes(target_header, 21)
            rom.info.title = title_bytes.decode('ascii', errors='ignore').strip()
            
            # Map Mode is byte 0x15 in header
            map_mode = rom.read_bytes(target_header + 0x15, 1)[0]
            # Bit 5 (0x20) specifies FastROM
            rom.info.is_fastrom = bool(map_mode & 0x20)
            
            # SRAM Size is byte 0x18
            sram_byte = rom.read_bytes(target_header + 0x18, 1)[0]
            rom.info.sram_size = (1 << sram_byte) if sram_byte > 0 else 0
            
            # Checksum
            checksum_bytes = rom.read_bytes(target_header + 0x1E, 2)
            rom.info.checksum = int.from_bytes(checksum_bytes, byteorder='little')
        except ValueError:
            pass # Out of bounds / invalid ROM
            
        return rom

    @staticmethod
    def _score_header(rom: RomData, offset: int) -> int:
        """Scores a header to see if it's valid based on Checksum + Inverse Checksum == 0xFFFF"""
        try:
            if offset + 0x20 > rom.info.size_bytes:
                return -1
            inv = int.from_bytes(rom.read_bytes(offset + 0x1C, 2), 'little')
            chk = int.from_bytes(rom.read_bytes(offset + 0x1E, 2), 'little')
            if (inv ^ chk) == 0xFFFF:
                return 10
            return 0
        except ValueError:
            return -1
            
    @staticmethod
    def _calculate_checksum(rom: RomData, offset: int) -> int:
        """Calculates actual ROM checksum using fast NumPy operations."""
        if not rom.mmap:
            return 0
        data = np.frombuffer(rom.mmap, dtype=np.uint8, offset=offset)
        # Full accurate SNES checksum involves mirroring for non-power-of-2 ROMs,
        # but a simple sum works for most standard dumps and early analysis.
        total_sum = int(np.sum(data))
        return total_sum & 0xFFFF
