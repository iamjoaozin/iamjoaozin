from romcore.emulator.backend import IEmulatorBackend, MemoryDomain
from romcore.emulator.dma_tracker import DMATracker
from romcore.analyzer.comparator import MemoryComparator
from romcore.models.correlation import GraphicCorrelationResult, ConfidenceScore

class GraphicCorrelator:
    """
    Traces a graphic from screen/VRAM back to its source in WRAM and ROM.
    """
    def __init__(self, backend: IEmulatorBackend, dma_tracker: DMATracker, rom_comparator: MemoryComparator):
        self.backend = backend
        self.dma_tracker = dma_tracker
        self.rom_comparator = rom_comparator
        
    def correlate_vram(self, vram_addr: int, size: int = 32) -> GraphicCorrelationResult:
        res = GraphicCorrelationResult(vram_addr=vram_addr)
        
        # 1. Check DMA Tracker for the source of this VRAM
        dma_match = None
        for transfer in reversed(self.dma_tracker.history):
            dest_start = transfer.dest * 2 # word to byte addr
            dest_end = dest_start + transfer.length
            
            # If the vram address falls inside this DMA transfer
            if dest_start <= vram_addr < dest_end:
                dma_match = transfer
                break
                
        if dma_match:
            res.dma_entry = vars(dma_match) # Convert to dict if needed for UI, or just keep as object? Model accepts dict.
            res.confidence.dma_match = 40
            
            # WRAM Source
            offset_in_transfer = vram_addr - (dma_match.dest * 2)
            wram_src = dma_match.source + offset_in_transfer
            res.wram_addr = wram_src
            res.confidence.wram_match = 25
            
            # Fetch WRAM from cache/backend to match in ROM
            # Using 32 bytes for a 4bpp tile
            # This is synchronous fallback for the correlator engine itself. In prod UI, cache is used.
            wram_data = self.backend.read_memory(MemoryDomain.WRAM, wram_src, size)
            if wram_data:
                matches = self.rom_comparator.compare_dump(wram_data)
                if matches:
                    res.rom_offset = matches[0][0]
                    res.confidence.rom_match = 25
                    res.confidence.tile_consistency = 10
                    res.compression_state = "Uncompressed"
                    res.status = "Found in ROM"
                    res.reason = "Exact match through DMA"
                else:
                    res.compression_state = "Compressed"
                    res.status = "Found in WRAM"
                    res.reason = "Origin: WRAM. Source: 0x%06X. Compressed asset, ROM not directly recoverable." % dma_match.source
            else:
                res.status = "WRAM Read Failed"
                res.reason = "Could not verify ROM origin."
        else:
            # 2. Brute-force fallback
            vram_data = self.backend.read_memory(MemoryDomain.VRAM, vram_addr, size)
            if vram_data:
                matches = self.rom_comparator.compare_dump(vram_data)
                if matches:
                    res.rom_offset = matches[0][0]
                    res.confidence.rom_match = 25
                    res.confidence.tile_consistency = 10
                    res.status = "Found in ROM"
                    res.reason = "No DMA trace. Brute-force match."
                    res.compression_state = "Uncompressed"
                else:
                    res.status = "Unknown Origin"
                    res.reason = "No DMA trace. Not found in ROM. Possibly procedural or highly compressed."
            else:
                res.status = "Unknown Origin"
                res.reason = "Could not read VRAM."
                
        return res
