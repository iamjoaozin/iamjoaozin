from abc import ABC, abstractmethod
from enum import Enum
from typing import Callable, Any, Optional

class MemoryDomain(Enum):
    ROM = "ROM"
    WRAM = "WRAM"
    VRAM = "VRAM"
    CGRAM = "CGRAM"
    OAM = "OAM"
    CPU = "CPU"

class IEmulatorBackend(ABC):
    """Abstract interface for communicating with a live SNES emulator."""
    
    @abstractmethod
    def connect(self, host: str = "127.0.0.1", port: int = 65816) -> bool:
        """Connects to the emulator backend."""
        pass
        
    @abstractmethod
    def disconnect(self):
        """Disconnects from the emulator."""
        pass
        
    @abstractmethod
    def is_connected(self) -> bool:
        """Returns connection status."""
        pass

    @abstractmethod
    def pause(self):
        """Pauses the emulator."""
        pass
        
    @abstractmethod
    def resume(self):
        """Resumes the emulator."""
        pass

    @abstractmethod
    def read_memory(self, domain: MemoryDomain, address: int, size: int) -> bytes:
        """
        Reads memory from a specific domain. 
        Must block until data is received or throw an exception on timeout.
        """
        pass
        
    @abstractmethod
    def set_dma_callback(self, callback: Callable[[dict], None]):
        """
        Sets the callback to be invoked when a DMA transfer occurs.
        The dict should contain: 'source', 'dest', 'length', 'channel', 'mode'.
        """
        pass
        
    @abstractmethod
    def set_frame_callback(self, callback: Callable[[int], None]):
        """Sets the callback to be invoked at the end of every frame with the frame number."""
        pass
