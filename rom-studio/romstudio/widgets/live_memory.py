from PySide6.QtWidgets import QWidget, QVBoxLayout, QTabWidget, QHBoxLayout, QPushButton, QLabel
from PySide6.QtCore import QTimer, Signal, QObject
from .hex_editor import HexEditorWidget
from romcore.emulator import IEmulatorBackend, MemoryDomain
import threading

class MemoryReaderWorker(QObject):
    data_ready = Signal(int, bytes) # index, data
    
    def __init__(self, backend: IEmulatorBackend):
        super().__init__()
        self.backend = backend
        
    def read_async(self, index: int, domain: MemoryDomain, size: int):
        def task():
            if not self.backend.is_connected(): return
            data = self.backend.read_memory(domain, 0, size)
            if data:
                self.data_ready.emit(index, data)
        threading.Thread(target=task, daemon=True).start()

class LiveMemoryWidget(QWidget):
    def __init__(self, backend: IEmulatorBackend):
        super().__init__()
        self.backend = backend
        self.layout = QVBoxLayout(self)
        
        self.toolbar = QHBoxLayout()
        self.btn_refresh = QPushButton("Refresh Live")
        self.btn_refresh.setCheckable(True)
        self.btn_refresh.setChecked(True)
        
        self.lbl_status = QLabel("Disconnected")
        self.toolbar.addWidget(self.btn_refresh)
        self.toolbar.addWidget(self.lbl_status)
        self.toolbar.addStretch()
        self.layout.addLayout(self.toolbar)
        
        self.tabs = QTabWidget()
        self.editors = [
            HexEditorWidget(), # WRAM
            HexEditorWidget(), # VRAM
            HexEditorWidget(), # CGRAM
            HexEditorWidget()  # OAM
        ]
        
        self.tabs.addTab(self.editors[0], "WRAM")
        self.tabs.addTab(self.editors[1], "VRAM")
        self.tabs.addTab(self.editors[2], "CGRAM")
        self.tabs.addTab(self.editors[3], "OAM")
        
        self.layout.addWidget(self.tabs)
        
        self.worker = MemoryReaderWorker(backend)
        self.worker.data_ready.connect(self._on_data_ready)
        
        self.timer = QTimer(self)
        self.timer.timeout.connect(self._on_timer)
        self.timer.start(500) # update every 500ms
        
    def _on_timer(self):
        if not self.backend.is_connected():
            self.lbl_status.setText("Disconnected")
            return
            
        self.lbl_status.setText("Connected to Emulator")
        
        if not self.btn_refresh.isChecked():
            return
            
        index = self.tabs.currentIndex()
        if index == 0:
            domain = MemoryDomain.WRAM
            size = 128 * 1024
        elif index == 1:
            domain = MemoryDomain.VRAM
            size = 64 * 1024
        elif index == 2:
            domain = MemoryDomain.CGRAM
            size = 512
        elif index == 3:
            domain = MemoryDomain.OAM
            size = 544
        else:
            return
            
        self.worker.read_async(index, domain, size)
        
    def _on_data_ready(self, index: int, data: bytes):
        # We need to load data without losing scroll position if possible, 
        # but for HexEditorWidget load_data replaces the model.
        # For a true live view, HexEditorWidget needs a way to update existing model.
        editor = self.editors[index]
        if not hasattr(editor, 'model') or editor.model is None:
            editor.load_data(data)
        else:
            # Update existing data directly to keep scroll
            editor.model.data_bytes = data
            # Just notify that data changed
            editor.model.layoutChanged.emit()
