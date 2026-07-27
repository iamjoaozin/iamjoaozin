from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, 
                               QPushButton, QComboBox, QLabel)
from PySide6.QtCore import Qt

from romcore.emulator.backend import IEmulatorBackend, MemoryDomain
from romstudio.widgets.tile_viewer import TileViewerWidget
from romcore.analyzer.tiles import SNESTileDecoder

class VRAMInspectorWidget(QWidget):
    def __init__(self, backend: IEmulatorBackend):
        super().__init__()
        self.backend = backend
        
        layout = QVBoxLayout(self)
        
        # Toolbar
        toolbar = QHBoxLayout()
        self.btn_refresh = QPushButton("Fetch VRAM")
        self.btn_refresh.clicked.connect(self.refresh_vram)
        toolbar.addWidget(self.btn_refresh)
        
        toolbar.addWidget(QLabel("Palette:"))
        self.cb_palette = QComboBox()
        for i in range(8):
            self.cb_palette.addItem(f"BG Palette {i}")
        for i in range(8):
            self.cb_palette.addItem(f"OBJ Palette {i}")
        self.cb_palette.currentIndexChanged.connect(self.refresh_vram)
        toolbar.addWidget(self.cb_palette)
        
        toolbar.addWidget(QLabel("Format:"))
        self.cb_bpp = QComboBox()
        self.cb_bpp.addItems(["2 BPP", "4 BPP", "8 BPP"])
        self.cb_bpp.setCurrentIndex(1)
        self.cb_bpp.currentIndexChanged.connect(self.refresh_vram)
        toolbar.addWidget(self.cb_bpp)
        
        toolbar.addStretch()
        layout.addLayout(toolbar)
        
        self.tile_viewer = TileViewerWidget()
        layout.addWidget(self.tile_viewer)
        
    def refresh_vram(self):
        if not self.backend.is_connected():
            return
            
        bpp = 4 if "4" in self.cb_bpp.currentText() else 2
        palette_idx = self.cb_palette.currentIndex()
        if palette_idx >= 8:
            base_color = 128 + ((palette_idx - 8) * 16)
        else:
            base_color = palette_idx * 16
            
        def _on_cgram_read(cgram_data: bytes):
            colors = SNESTileDecoder.decode_cgram(cgram_data)
            
            sub_palette = colors[base_color:base_color+16]
            full_palette = [0] * 256
            for i in range(16):
                if i < len(sub_palette):
                    full_palette[i] = int(sub_palette[i])
                
            pal_name = self.cb_palette.currentText()
            self.tile_viewer.set_palette(full_palette, pal_name)
            
            def _on_vram_read(vram_data: bytes):
                self.tile_viewer.load_data(vram_data, bpp=bpp)
                self.btn_refresh.setEnabled(True)
                
            self.backend.read_memory_async(MemoryDomain.VRAM, 0, 65536, _on_vram_read)
            
        self.btn_refresh.setEnabled(False)
        self.backend.read_memory_async(MemoryDomain.CGRAM, 0, 512, _on_cgram_read)
        from PySide6.QtCore import QTimer
        QTimer.singleShot(2000, lambda: self.btn_refresh.setEnabled(True))
        
    def on_sprite_selected(self, event):
        payload = event.payload
        tile_address = payload.get("tile_address")
        palette = payload.get("palette")
        
        # Select the OBJ Palette (starts at index 8 in the combo box)
        obj_pal_index = 8 + palette
        self.cb_palette.setCurrentIndex(obj_pal_index)
        
        # Highlight the tile in the viewer
        word_address = tile_address // 2
        self.tile_viewer.highlight_tile(word_address)
