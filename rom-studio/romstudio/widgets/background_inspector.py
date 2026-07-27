from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, 
                               QPushButton, QComboBox, QLabel, QSplitter, QScrollArea)
from PySide6.QtCore import Qt
from PySide6.QtGui import QImage, QPixmap, QPainter, QPen, QColor
import numpy as np

from romcore.emulator.backend import IEmulatorBackend, MemoryDomain
from romcore.bus.event_bus import EventBus
from romcore.bus.events import Event, EventTypes
from romstudio.widgets.tile_viewer import ClickableImageLabel
from romcore.analyzer.tiles import SNESTileDecoder

class BackgroundInspectorWidget(QWidget):
    def __init__(self, backend: IEmulatorBackend, event_bus: EventBus):
        super().__init__()
        self.backend = backend
        self.event_bus = event_bus
        
        layout = QVBoxLayout(self)
        
        # Toolbar
        toolbar = QHBoxLayout()
        self.btn_refresh = QPushButton("Fetch BG")
        self.btn_refresh.clicked.connect(self.refresh_bg)
        toolbar.addWidget(self.btn_refresh)
        
        toolbar.addWidget(QLabel("Layer:"))
        self.cb_layer = QComboBox()
        self.cb_layer.addItems(["BG1", "BG2", "BG3", "BG4"])
        self.cb_layer.currentIndexChanged.connect(self._on_layer_changed)
        toolbar.addWidget(self.cb_layer)
        
        toolbar.addStretch()
        layout.addLayout(toolbar)
        
        splitter = QSplitter(Qt.Orientation.Horizontal)
        layout.addWidget(splitter)
        
        # Image Area
        self.scroll = QScrollArea()
        self.image_label = ClickableImageLabel("No BG Data")
        self.image_label.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)
        self.image_label.clicked.connect(self._on_bg_clicked)
        self.scroll.setWidget(self.image_label)
        self.scroll.setWidgetResizable(True)
        splitter.addWidget(self.scroll)
        
        # Info Panel
        info_panel = QWidget()
        info_layout = QVBoxLayout(info_panel)
        self.lbl_info = QLabel("Select a tile...")
        info_layout.addWidget(self.lbl_info)
        info_layout.addStretch()
        splitter.addWidget(info_panel)
        
        splitter.setSizes([600, 300])
        
        # State
        self.vram = b""
        self.cgram = b""
        self.oam = b""
        self.tilemap = []
        
        self.bg_bases = [0x0000, 0x0000, 0x0000, 0x0000] # Word addresses
        self.bg_char_bases = [0x0000, 0x0000, 0x0000, 0x0000] # Word addresses
        
    def _on_layer_changed(self):
        if self.vram:
            self._render_bg()
            
    def refresh_bg(self):
        if not self.backend.is_connected(): return
        self.btn_refresh.setEnabled(False)
        
        # We need CGRAM for palettes, and VRAM for tilemaps and characters.
        def _on_cgram(cgram_data: bytes):
            self.cgram = cgram_data
            self.backend.read_memory_async(MemoryDomain.VRAM, 0, 65536, _on_vram)
            
        def _on_vram(vram_data: bytes):
            self.vram = vram_data
            self._fetch_registers()
            
        self.backend.read_memory_async(MemoryDomain.CGRAM, 0, 512, _on_cgram)
        from PySide6.QtCore import QTimer
        QTimer.singleShot(2000, lambda: self.btn_refresh.setEnabled(True))
        
    def _fetch_registers(self):
        # We need CPU memory $2105 to $210C for BG settings
        def _on_cpu(cpu_data: bytes):
            # Parse BG maps (2107-210A)
            # Bits 2-7: Base address (in K-words, so * 1024)
            # Bits 0-1: SC Size
            self.bg_bases[0] = (cpu_data[0x2107 - 0x2100] & 0xFC) << 8
            self.bg_bases[1] = (cpu_data[0x2108 - 0x2100] & 0xFC) << 8
            self.bg_bases[2] = (cpu_data[0x2109 - 0x2100] & 0xFC) << 8
            self.bg_bases[3] = (cpu_data[0x210A - 0x2100] & 0xFC) << 8
            
            # Parse Character base (210B-210C)
            bg12 = cpu_data[0x210B - 0x2100]
            self.bg_char_bases[0] = (bg12 & 0x0F) << 12
            self.bg_char_bases[1] = (bg12 & 0xF0) << 8
            
            bg34 = cpu_data[0x210C - 0x2100]
            self.bg_char_bases[2] = (bg34 & 0x0F) << 12
            self.bg_char_bases[3] = (bg34 & 0xF0) << 8
            
            self._render_bg()
            self.btn_refresh.setEnabled(True)
            
        self.backend.read_memory_async(MemoryDomain.CPU, 0x2100, 32, _on_cpu)
        
    def _render_bg(self):
        layer_idx = self.cb_layer.currentIndex()
        base_word = self.bg_bases[layer_idx]
        char_base = self.bg_char_bases[layer_idx]
        
        base_byte = base_word * 2
        char_byte = char_base * 2
        
        # Tilemap is usually 32x32 tiles = 1024 words = 2048 bytes
        if base_byte + 2048 > len(self.vram):
            self.image_label.setText("VRAM too small for BG")
            return
            
        tilemap_data = self.vram[base_byte:base_byte+2048]
        words = np.frombuffer(tilemap_data, dtype=np.uint16)
        
        self.tilemap = []
        for w in words:
            tile = w & 0x03FF
            pal = (w >> 10) & 0x07
            pri = (w >> 13) & 0x01
            fx = (w >> 14) & 0x01
            fy = (w >> 15) & 0x01
            self.tilemap.append({
                "tile": tile, "pal": pal, "pri": pri, "fx": fx, "fy": fy
            })
            
        # Draw placeholder (rendering full BG requires decoding all tiles)
        # We will render a simplified version for now or full if performant
        self.image_label.setText(f"BG{layer_idx+1} Loaded. Tilemap at 0x{base_word:04X}.w, Chars at 0x{char_base:04X}.w")
        
    def _on_bg_clicked(self, x: int, y: int):
        pass # To be implemented
