import os
import time
from typing import Optional, Callable
from romcore.emulator.backend import IEmulatorBackend, MemoryDomain

class FileMesenBackend(IEmulatorBackend):
    def __init__(self, ipc_dir: str):
        self.ipc_dir = ipc_dir
        self.cmd_file = os.path.join(ipc_dir, "rom_cmd.txt")
        self.resp_file = os.path.join(ipc_dir, "rom_resp.bin")
        self.dma_file = os.path.join(ipc_dir, "dma_log.txt")
        self.dma_callback: Optional[Callable] = None
        self._connected = False
        self._last_dma_size = 0
        
    def connect(self) -> bool:
        # Check if dir exists
        if not os.path.exists(self.ipc_dir):
            return False
            
        # Clean up old files
        for f in [self.cmd_file, self.resp_file, self.dma_file]:
            if os.path.exists(f):
                try:
                    os.remove(f)
                except:
                    pass
                    
        self._connected = True
        return True
        
    def disconnect(self):
        self._connected = False
        
    def is_connected(self) -> bool:
        return self._connected
        
    def pause(self):
        self._write_cmd("PAUSE")
        
    def resume(self):
        self._write_cmd("RESUME")
        
    def read_memory(self, domain: MemoryDomain, address: int, size: int) -> bytes:
        if not self._connected:
            return b""
            
        # Clear old response
        if os.path.exists(self.resp_file):
            try:
                os.remove(self.resp_file)
            except:
                pass
                
        cmd = f"READ {domain.value} {address} {size}"
        self._write_cmd(cmd)
        
        # Wait for response (timeout 2s)
        start = time.time()
        while time.time() - start < 2.0:
            if os.path.exists(self.resp_file):
                try:
                    with open(self.resp_file, "rb") as f:
                        data = f.read()
                    if len(data) == size:
                        os.remove(self.resp_file)
                        return data
                except:
                    pass
            time.sleep(0.01)
            
        return b""
        
    def set_dma_callback(self, callback: Callable):
        self.dma_callback = callback
        
    def set_frame_callback(self, callback: Callable):
        pass # We don't have a reliable frame sync in FileBridge yet, so we ignore it or just call it from poll_events
        
    def poll_events(self):
        # Called by LiveMemoryWidget or a QTimer in main to process DMA events
        if not self._connected or not self.dma_callback:
            return
            
        if not os.path.exists(self.dma_file):
            return
            
        try:
            size = os.path.getsize(self.dma_file)
            if size > self._last_dma_size:
                with open(self.dma_file, "r") as f:
                    f.seek(self._last_dma_size)
                    lines = f.readlines()
                    self._last_dma_size = size
                    
                for line in lines:
                    line = line.strip()
                    if not line: continue
                    parts = line.split(",")
                    if len(parts) == 5:
                        self.dma_callback({
                            "source": int(parts[0]),
                            "dest": int(parts[1]),
                            "length": int(parts[2]),
                            "channel": int(parts[3]),
                            "mode": int(parts[4])
                        })
        except:
            pass
            
    def _write_cmd(self, cmd: str):
        tmp = self.cmd_file + ".tmp"
        try:
            with open(tmp, "w") as f:
                f.write(cmd + "\n")
            if os.path.exists(self.cmd_file):
                os.remove(self.cmd_file)
            os.rename(tmp, self.cmd_file)
        except:
            pass
