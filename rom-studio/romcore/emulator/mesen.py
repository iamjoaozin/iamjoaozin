import socket
import struct
import threading
from typing import Callable, Any, Optional
from .backend import IEmulatorBackend, MemoryDomain

class MesenLuaBackend(IEmulatorBackend):
    """Implementation of IEmulatorBackend that connects to the Mesen 2 Lua TCP script."""
    
    def __init__(self):
        self.sock: Optional[socket.socket] = None
        self._connected = False
        self._lock = threading.Lock()
        
        self.dma_callback: Optional[Callable[[dict], None]] = None
        self.frame_callback: Optional[Callable[[int], None]] = None
        
        self._recv_thread: Optional[threading.Thread] = None
        self._pending_reads = {}
        self._read_event = threading.Event()
        
    def connect(self, host: str = "127.0.0.1", port: int = 65816) -> bool:
        try:
            self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.sock.connect((host, port))
            self._connected = True
            
            self._recv_thread = threading.Thread(target=self._recv_loop, daemon=True)
            self._recv_thread.start()
            return True
        except Exception:
            return False
            
    def disconnect(self):
        self._connected = False
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass
        self.sock = None
        
    def is_connected(self) -> bool:
        return self._connected
        
    def pause(self):
        self._send_packet(0x01, b'')
        
    def resume(self):
        self._send_packet(0x02, b'')
        
    def _send_packet(self, opcode: int, payload: bytes):
        if not self._connected or not self.sock: return
        try:
            header = struct.pack('<BI', opcode, len(payload))
            with self._lock:
                self.sock.sendall(header + payload)
        except Exception:
            self.disconnect()
            
    def read_memory(self, domain: MemoryDomain, address: int, size: int) -> bytes:
        if not self._connected: return b''
        
        domain_id = 0
        if domain == MemoryDomain.VRAM: domain_id = 1
        elif domain == MemoryDomain.CGRAM: domain_id = 2
        elif domain == MemoryDomain.OAM: domain_id = 3
        
        payload = struct.pack('<BII', domain_id, address, size)
        
        self._read_event.clear()
        self._send_packet(0x03, payload)
        
        # Wait for response (timeout 2s)
        if self._read_event.wait(2.0):
            res = self._pending_reads.get('last')
            return res if res else b''
        return b''
        
    def set_dma_callback(self, callback: Callable[[dict], None]):
        self.dma_callback = callback
        
    def set_frame_callback(self, callback: Callable[[int], None]):
        self.frame_callback = callback
        
    def _recv_loop(self):
        while self._connected and self.sock:
            try:
                header = self._recv_exact(5)
                if not header: break
                
                opcode, length = struct.unpack('<BI', header)
                payload = self._recv_exact(length) if length > 0 else b''
                
                if opcode == 0x83: # READ_MEMORY_RESPONSE
                    self._pending_reads['last'] = payload
                    self._read_event.set()
                    
                elif opcode == 0x84: # EVENT_FRAME
                    if self.frame_callback and len(payload) == 4:
                        frame, = struct.unpack('<I', payload)
                        self.frame_callback(frame)
                        
                elif opcode == 0x85: # EVENT_DMA
                    if self.dma_callback and len(payload) == 12:
                        src, dest, length, ch, mode = struct.unpack('<IHIBB', payload)
                        self.dma_callback({
                            'source': src,
                            'dest': dest,
                            'length': length,
                            'channel': ch,
                            'mode': mode
                        })
            except Exception:
                break
        self.disconnect()
        
    def _recv_exact(self, size: int) -> bytes:
        data = bytearray()
        while len(data) < size:
            try:
                chunk = self.sock.recv(size - len(data))
                if not chunk: return b''
                data.extend(chunk)
            except Exception:
                return b''
        return bytes(data)
