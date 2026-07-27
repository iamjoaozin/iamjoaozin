import os
import time
from abc import ABC, abstractmethod
from typing import Optional, List

class ITransport(ABC):
    @abstractmethod
    def connect(self) -> bool:
        pass
        
    @abstractmethod
    def disconnect(self):
        pass
        
    @abstractmethod
    def is_connected(self) -> bool:
        pass
        
    @abstractmethod
    def send(self, data: bytes):
        pass
        
    @abstractmethod
    def receive(self, length: int = -1) -> bytes:
        pass

class FileTransport(ITransport):
    """
    A file-based transport acting like a socket.
    Uses an inbox/outbox file approach.
    """
    def __init__(self, ipc_dir: str):
        self.ipc_dir = ipc_dir
        self.tx_file = os.path.join(ipc_dir, "rom_cmd.txt")
        self.rx_file = os.path.join(ipc_dir, "rom_resp.bin")
        self._connected = False
        
    def connect(self) -> bool:
        if not os.path.exists(self.ipc_dir):
            return False
            
        for f in [self.tx_file, self.rx_file]:
            if os.path.exists(f):
                try: os.remove(f)
                except: pass
                
        self._connected = True
        return True
        
    def disconnect(self):
        self._connected = False
        
    def is_connected(self) -> bool:
        return self._connected
        
    def send(self, data: bytes):
        if not self._connected: return
        
        # Write to temp file then atomic rename
        tmp = self.tx_file + ".tmp"
        try:
            with open(tmp, "wb") as f:
                f.write(data)
            if os.path.exists(self.tx_file):
                os.remove(self.tx_file)
            os.rename(tmp, self.tx_file)
        except:
            pass
            
    def receive(self, length: int = -1) -> bytes:
        if not self._connected: return b""
        
        if not os.path.exists(self.rx_file):
            return b""
            
        try:
            with open(self.rx_file, "rb") as f:
                data = f.read()
            os.remove(self.rx_file)
            return data
        except:
            return b""
