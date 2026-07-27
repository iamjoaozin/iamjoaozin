import threading
import time
import struct
from typing import Callable, Optional, Dict
from romcore.emulator.backend import IEmulatorBackend, MemoryDomain
from romcore.emulator.transport import ITransport
from romcore.emulator.protocol import Message
from romcore.emulator.cache import MemoryCache

class AsyncEmulatorBackend(IEmulatorBackend):
    def __init__(self, transport: ITransport):
        self.transport = transport
        self.cache = MemoryCache()
        self.dma_callback: Optional[Callable] = None
        self._thread: Optional[threading.Thread] = None
        self._running = False
        
        self._req_id = 1
        self._callbacks: Dict[int, Callable] = {}
        self._lock = threading.Lock()
        
    def connect(self) -> bool:
        if self.transport.connect():
            self._running = True
            self._thread = threading.Thread(target=self._worker, daemon=True)
            self._thread.start()
            return True
        return False
        
    def disconnect(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=1.0)
        self.transport.disconnect()
        
    def is_connected(self) -> bool:
        return self.transport.is_connected()
        
    def pause(self):
        msg = Message(self._next_req_id(), 0x01, b"")
        self.transport.send(msg.serialize())
        
    def resume(self):
        msg = Message(self._next_req_id(), 0x02, b"")
        self.transport.send(msg.serialize())
        
    def read_memory(self, domain: MemoryDomain, address: int, size: int) -> bytes:
        # Legacy synchronous fallback using cache
        # For production UI, use read_memory_async
        return self.cache.read(domain, address, size)
        
    def read_memory_async(self, domain: MemoryDomain, address: int, size: int, callback: Callable):
        req_id = self._next_req_id()
        with self._lock:
            self._callbacks[req_id] = {"cb": callback, "time": time.time()}
            
        domain_val = 0
        if domain == MemoryDomain.VRAM: domain_val = 1
        elif domain == MemoryDomain.CGRAM: domain_val = 2
        elif domain == MemoryDomain.OAM: domain_val = 3
        elif domain == MemoryDomain.CPU: domain_val = 4
            
        payload = struct.pack("<B I I", domain_val, address, size)
        msg = Message(req_id, 0x03, payload)
        self.transport.send(msg.serialize())
        
    def set_dma_callback(self, callback: Callable):
        self.dma_callback = callback
        
    def set_frame_callback(self, callback: Callable):
        pass # Async backend uses threaded poll instead
        
    def poll_events(self):
        pass # Not used in AsyncBackend, threading handles it
        
    def _next_req_id(self) -> int:
        with self._lock:
            self._req_id += 1
            return self._req_id
            
    def _worker(self):
        while self._running:
            data = self.transport.receive()
            if data:
                self._handle_data(data)
            time.sleep(0.01) # Poll interval
            
    def _handle_data(self, data: bytes):
        msg = Message.deserialize(data)
        if not msg: return
        
        if msg.opcode == 0x83: # Read Response
            # The payload starts with Domain(1), Address(4), Size(4) then Data
            if len(msg.payload) >= 9:
                domain_val, addr, size = struct.unpack("<B I I", msg.payload[:9])
                domain = MemoryDomain.ROM
                if domain_val == 1: domain = MemoryDomain.VRAM
                elif domain_val == 2: domain = MemoryDomain.CGRAM
                elif domain_val == 3: domain = MemoryDomain.OAM
                elif domain_val == 4: domain = MemoryDomain.CPU
                
                mem_data = msg.payload[9:9+size]
                
                self.cache.update(domain, addr, mem_data)
                
                cb_dict = None
                with self._lock:
                    cb_dict = self._callbacks.pop(msg.req_id, None)
                if cb_dict and "cb" in cb_dict:
                    cb_dict["cb"](mem_data)
                    
        elif msg.opcode == 0x85: # DMA Event
            # Source(4), Dest(2), Length(4), Channel(1), Mode(1)
            if len(msg.payload) == 12 and self.dma_callback:
                src, dest, length, ch, mode = struct.unpack("<I H I B B", msg.payload)
                self.dma_callback({
                    "source": src,
                    "dest": dest,
                    "length": length,
                    "channel": ch,
                    "mode": mode
                })
