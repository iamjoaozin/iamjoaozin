from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, 
                               QPushButton, QTableView, QLabel, QSplitter, 
                               QHeaderView, QFormLayout)
from PySide6.QtCore import Qt, QAbstractTableModel
from PySide6.QtGui import QColor

from romcore.emulator.backend import IEmulatorBackend, MemoryDomain
from romcore.bus.event_bus import EventBus
from romcore.bus.events import Event, EventTypes

class SpriteTableModel(QAbstractTableModel):
    def __init__(self, sprites=None):
        super().__init__()
        self.sprites = sprites or []
        self.headers = ["Index", "X", "Y", "Tile", "Tile Addr", "Pal", "Pal Addr", "Pri", "Size", "Flip X", "Flip Y"]
        
    def rowCount(self, parent=None):
        return len(self.sprites)
        
    def columnCount(self, parent=None):
        return len(self.headers)
        
    def data(self, index, role=Qt.ItemDataRole.DisplayRole):
        if not index.isValid() or role != Qt.ItemDataRole.DisplayRole:
            return None
            
        sprite = self.sprites[index.row()]
        col = index.column()
        
        if col == 0: return str(sprite["index"])
        if col == 1: return str(sprite["x"])
        if col == 2: return str(sprite["y"])
        if col == 3: return f"{sprite['tile']:03X}"
        if col == 4: return f"{sprite['tile_addr']:04X}.w"
        if col == 5: return str(sprite["palette"])
        if col == 6: return f"0x{sprite['pal_addr']:02X}"
        if col == 7: return str(sprite["priority"])
        if col == 8: return f"{sprite['width']}x{sprite['height']}"
        if col == 9: return "Yes" if sprite["flip_x"] else "No"
        if col == 10: return "Yes" if sprite["flip_y"] else "No"
        
        return None
        
    def headerData(self, section, orientation, role=Qt.ItemDataRole.DisplayRole):
        if orientation == Qt.Orientation.Horizontal and role == Qt.ItemDataRole.DisplayRole:
            return self.headers[section]
        return None

class SpriteInspectorWidget(QWidget):
    def __init__(self, backend: IEmulatorBackend, event_bus: EventBus):
        super().__init__()
        self.backend = backend
        self.event_bus = event_bus
        
        layout = QVBoxLayout(self)
        
        # Toolbar
        toolbar = QHBoxLayout()
        self.btn_refresh = QPushButton("Fetch OAM")
        self.btn_refresh.clicked.connect(self.refresh_oam)
        toolbar.addWidget(self.btn_refresh)
        toolbar.addStretch()
        layout.addLayout(toolbar)
        
        splitter = QSplitter(Qt.Orientation.Horizontal)
        layout.addWidget(splitter)
        
        # Table View
        self.table_view = QTableView()
        self.table_model = SpriteTableModel()
        self.table_view.setModel(self.table_model)
        self.table_view.setSelectionBehavior(QTableView.SelectionBehavior.SelectRows)
        self.table_view.setSelectionMode(QTableView.SelectionMode.SingleSelection)
        self.table_view.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.ResizeToContents)
        
        self.table_view.selectionModel().selectionChanged.connect(self._on_selection_changed)
        splitter.addWidget(self.table_view)
        
        # Info Panel
        info_panel = QWidget()
        info_layout = QFormLayout(info_panel)
        
        self.lbl_idx = QLabel("-")
        self.lbl_x = QLabel("-")
        self.lbl_y = QLabel("-")
        self.lbl_size = QLabel("-")
        self.lbl_tile = QLabel("-")
        self.lbl_tile_addr = QLabel("-")
        self.lbl_pal = QLabel("-")
        self.lbl_pal_addr = QLabel("-")
        self.lbl_pri = QLabel("-")
        self.lbl_flip_x = QLabel("-")
        self.lbl_flip_y = QLabel("-")
        
        info_layout.addRow("Sprite Index:", self.lbl_idx)
        info_layout.addRow("X:", self.lbl_x)
        info_layout.addRow("Y:", self.lbl_y)
        info_layout.addRow("Size:", self.lbl_size)
        info_layout.addRow("Tile Index:", self.lbl_tile)
        info_layout.addRow("Tile Address:", self.lbl_tile_addr)
        info_layout.addRow("Palette Index:", self.lbl_pal)
        info_layout.addRow("Palette Address:", self.lbl_pal_addr)
        info_layout.addRow("Priority:", self.lbl_pri)
        info_layout.addRow("Flip X:", self.lbl_flip_x)
        info_layout.addRow("Flip Y:", self.lbl_flip_y)
        
        from romstudio.widgets.tile_viewer import ClickableImageLabel
        self.lbl_preview = ClickableImageLabel("Loading preview...")
        self.lbl_preview.setMinimumSize(64, 64)
        info_layout.addRow("Preview:", self.lbl_preview)
        
        splitter.addWidget(info_panel)
        splitter.setSizes([600, 300])
        
        self.sprites = []
        self._current_sprite = None
        
    def refresh_oam(self):
        if not self.backend.is_connected():
            return
            
        self.btn_refresh.setEnabled(False)
        
        def _on_oam_read(oam_data: bytes):
            self.sprites = self._parse_oam(oam_data)
            self.table_model.sprites = self.sprites
            self.table_model.layoutChanged.emit()
            self.btn_refresh.setEnabled(True)
            
        # OAM is 544 bytes
        self.backend.read_memory_async(MemoryDomain.OAM, 0, 544, _on_oam_read)
        
        # Timeout safeguard
        from PySide6.QtCore import QTimer
        QTimer.singleShot(2000, lambda: self.btn_refresh.setEnabled(True))
        
    def _parse_oam(self, oam_data: bytes) -> list:
        if len(oam_data) < 544:
            return []
            
        sprites = []
        # First 512 bytes: 128 sprites, 4 bytes each
        # Last 32 bytes: high X bit and Size bit for 128 sprites (2 bits per sprite)
        
        for i in range(128):
            base = i * 4
            x = oam_data[base]
            y = oam_data[base+1]
            tile = oam_data[base+2]
            attrs = oam_data[base+3]
            
            # High bits from the last 32 bytes
            high_byte_idx = 512 + (i // 4)
            high_shift = (i % 4) * 2
            high_bits = (oam_data[high_byte_idx] >> high_shift) & 0x03
            
            high_x = high_bits & 0x01
            size_bit = (high_bits >> 1) & 0x01
            
            x = x | (high_x << 8)
            # Treat X as signed 9-bit
            if x > 255: x = x - 512
            
            pal = (attrs >> 1) & 0x07
            pri = (attrs >> 4) & 0x03
            flip_x = (attrs & 0x40) != 0
            flip_y = (attrs & 0x80) != 0
            
            # SNES object sizes are defined by OBSEL register, but we simplify for now
            # Assume 8x8 or 16x16
            width = 16 if size_bit else 8
            height = 16 if size_bit else 8
            
            # Tile address is tricky because it depends on OBSEL base.
            # We'll just provide the raw tile index for now, assuming base 0.
            # Sprite tiles are 4BPP (32 bytes each), but in 16x16 mode, it's a 2x2 grid.
            tile_addr = tile * 32
            
            sprites.append({
                "index": i,
                "x": x,
                "y": y,
                "width": width,
                "height": height,
                "tile": tile,
                "tile_addr": tile_addr,
                "palette": pal,
                "pal_addr": 128 + (pal * 16),
                "priority": pri,
                "flip_x": flip_x,
                "flip_y": flip_y
            })
            
        return sprites

    def _on_selection_changed(self, selected, deselected):
        indexes = selected.indexes()
        if not indexes:
            return
            
        idx = indexes[0].row()
        sprite = self.sprites[idx]
        
        self.lbl_idx.setText(str(sprite["index"]))
        self.lbl_x.setText(str(sprite["x"]))
        self.lbl_y.setText(str(sprite["y"]))
        self.lbl_size.setText(f"{sprite['width']}x{sprite['height']}")
        self.lbl_tile.setText(f"{sprite['tile']:03X}")
        self.lbl_tile_addr.setText(f"0x{sprite['tile_addr']:04X}")
        self.lbl_pal.setText(str(sprite["palette"]))
        self.lbl_pal_addr.setText(f"0x{sprite['pal_addr']:02X}")
        self.lbl_pri.setText(str(sprite["priority"]))
        self.lbl_flip_x.setText("Yes" if sprite["flip_x"] else "No")
        self.lbl_flip_y.setText("Yes" if sprite["flip_y"] else "No")
        
        self._current_sprite = sprite
        self.lbl_preview.setText("Loading...")
        
        payload = {
            "sprite_index": sprite["index"],
            "tile_address": sprite["tile_addr"],
            "palette": sprite["palette"]
        }
        self.event_bus.publish_async(Event(type=EventTypes.SPRITE_SELECTED, payload=payload))
        
        self._fetch_preview(sprite)
        
    def _fetch_preview(self, sprite):
        if not self.backend.is_connected(): return
        
        # Palettes for OAM start at CGRAM word 128 (byte 256).
        # Each palette has 16 colors (32 bytes).
        pal_byte_addr = 256 + (sprite["palette"] * 32)
        
        def _on_cgram(cgram_data: bytes):
            # Calculate bytes needed for the sprite
            num_tiles = 1 if sprite["width"] == 8 else 4
            tile_idx = sprite["tile"]
            
            # Fetch entire 16x16 area in VRAM which spans 2 rows of 16 tiles if width=16
            # It's easier to just fetch 2 rows of tiles = 32 tiles = 1024 bytes
            # VRAM addr of the start of this block
            vram_base = (tile_idx // 16) * 16 * 32
            
            def _on_vram(vram_data: bytes):
                self._render_preview(sprite, cgram_data, vram_data, vram_base)
                
            self.backend.read_memory_async(MemoryDomain.VRAM, vram_base, 1024, _on_vram)
            
        self.backend.read_memory_async(MemoryDomain.CGRAM, pal_byte_addr, 32, _on_cgram)
        
    def _render_preview(self, sprite, cgram_data: bytes, vram_data: bytes, vram_base: int):
        from romcore.analyzer.tiles import SNESTileDecoder
        from PySide6.QtGui import QImage, QPixmap
        import numpy as np
        
        if len(cgram_data) < 32 or len(vram_data) < 32:
            self.lbl_preview.setText("No data")
            return
            
        # Parse palette
        words = np.frombuffer(cgram_data[:32], dtype=np.uint16)
        r = ((words & 0x1F) << 3).astype(np.uint32)
        g = (((words >> 5) & 0x1F) << 3).astype(np.uint32)
        b = (((words >> 10) & 0x1F) << 3).astype(np.uint32)
        palette = (0xFF000000 | (r << 16) | (g << 8) | b)
        palette[0] = 0x00000000 # Transparent color
        
        # Determine tiles
        w = sprite["width"]
        h = sprite["height"]
        base_t = sprite["tile"]
        
        if w == 8 and h == 8:
            tiles = [base_t]
            grid_w, grid_h = 1, 1
        else:
            tiles = [base_t, base_t + 1, base_t + 16, base_t + 17]
            grid_w, grid_h = 2, 2
            
        # Decode tiles
        img = QImage(w, h, QImage.Format.Format_ARGB32)
        img.fill(0)
        
        for idx, t in enumerate(tiles):
            # t is absolute tile index. We fetched 1024 bytes starting from vram_base.
            t_offset = (t * 32) - vram_base
            if t_offset < 0 or t_offset + 32 > len(vram_data):
                continue
                
            tile_data = vram_data[t_offset:t_offset+32]
            decoded = SNESTileDecoder.decode_4bpp(tile_data, cgram_data) # wait, decode_4bpp expects 512 byte cgram?
            # Actually, decode_4bpp expects full CGRAM. Let's do it manually for this tile.
            
            # Manual decode 4BPP
            td = np.frombuffer(tile_data, dtype=np.uint8).reshape((1, 32))
            plane0 = td[:, 0:16:2, np.newaxis]
            plane1 = td[:, 1:16:2, np.newaxis]
            plane2 = td[:, 16:32:2, np.newaxis]
            plane3 = td[:, 17:32:2, np.newaxis]
            
            masks = np.array([128, 64, 32, 16, 8, 4, 2, 1], dtype=np.uint8)
            b0 = (plane0 & masks) != 0
            b1 = (plane1 & masks) != 0
            b2 = (plane2 & masks) != 0
            b3 = (plane3 & masks) != 0
            
            indices = b0.astype(np.uint8) | (b1.astype(np.uint8) << 1) | (b2.astype(np.uint8) << 2) | (b3.astype(np.uint8) << 3)
            pixels = indices[0] # 8x8 array
            
            # Draw to QImage
            dx = (idx % grid_w) * 8
            dy = (idx // grid_w) * 8
            
            for y in range(8):
                for x in range(8):
                    color_idx = pixels[y, x]
                    if color_idx > 0:
                        img.setPixelColor(dx + x, dy + y, QColor.fromRgba(int(palette[color_idx])))
                        
        # Handle flips
        if sprite["flip_x"] or sprite["flip_y"]:
            img = img.mirrored(sprite["flip_x"], sprite["flip_y"])
            
        pixmap = QPixmap.fromImage(img).scaled(w * 4, h * 4, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.FastTransformation)
        self.lbl_preview.setPixmap(pixmap)
