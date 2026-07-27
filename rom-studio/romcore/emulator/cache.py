from typing import Dict
from romcore.emulator.backend import MemoryDomain

class MemoryCache:
    def __init__(self):
        self.caches: Dict[MemoryDomain, bytearray] = {
            MemoryDomain.VRAM: bytearray(65536),
            MemoryDomain.WRAM: bytearray(131072),
            MemoryDomain.CGRAM: bytearray(512),
            MemoryDomain.OAM: bytearray(544)
        }
        self.dirty: Dict[MemoryDomain, bool] = {
            MemoryDomain.VRAM: True,
            MemoryDomain.WRAM: True,
            MemoryDomain.CGRAM: True,
            MemoryDomain.OAM: True
        }
        
    def update(self, domain: MemoryDomain, offset: int, data: bytes):
        if domain in self.caches:
            cache = self.caches[domain]
            end = min(offset + len(data), len(cache))
            cache[offset:end] = data[:end-offset]
            self.dirty[domain] = False
            
    def read(self, domain: MemoryDomain, offset: int, size: int) -> bytes:
        if domain in self.caches:
            cache = self.caches[domain]
            return bytes(cache[offset:offset+size])
        return b""
        
    def mark_dirty(self, domain: MemoryDomain):
        self.dirty[domain] = True
        
    def is_dirty(self, domain: MemoryDomain) -> bool:
        return self.dirty.get(domain, True)
