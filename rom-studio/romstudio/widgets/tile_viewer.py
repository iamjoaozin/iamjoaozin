import numpy as np
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QLabel, QScrollArea, 
                               QHBoxLayout, QSpinBox, QPushButton, QComboBox, QLineEdit, QFormLayout)
from PySide6.QtGui import QImage, QPixmap, qRgb, QPainter, QPen, QMouseEvent, QColor
from PySide6.QtCore import Qt, Signal

from romcore.analyzer.tiles import SNESTileDecoder

class ClickableImageLabel(QLabel):
    clicked = Signal(int, int) # x, y

    def mousePressEvent(self, ev: QMouseEvent):
        if ev.button() == Qt.MouseButton.LeftButton:
            self.clicked.emit(ev.pos().x(), ev.pos().y())
        super().mousePressEvent(ev)

class TileViewerWidget(QWidget):
    """Displays ROM data as decoded SNES tiles."""
    
    tile_selected = Signal(dict) # payload for event bus

    def __init__(self):
        super().__init__()
        self.layout = QVBoxLayout(self)
        
        # Controls
        controls = QHBoxLayout()
        
        # Base Address
        controls.addWidget(QLabel("Base Address:"))
        self.base_addr_input = QLineEdit("0000")
        self.base_addr_input.setMaximumWidth(80)
        controls.addWidget(self.base_addr_input)
        
        # Width
        self.width_spinner = QSpinBox()
        self.width_spinner.setRange(1, 128)
        self.width_spinner.setValue(16)
        controls.addWidget(QLabel("Width:"))
        controls.addWidget(self.width_spinner)
        
        # Zoom
        self.zoom_combo = QComboBox()
        self.zoom_combo.addItems(["100%", "200%", "300%", "400%", "800%"])
        self.zoom_combo.setCurrentIndex(1) # Default 200%
        controls.addWidget(QLabel("Zoom:"))
        controls.addWidget(self.zoom_combo)
        
        self.btn_refresh = QPushButton("Refresh")
        controls.addWidget(self.btn_refresh)
        controls.addStretch()
        
        self.layout.addLayout(controls)
        
        # Main Area (Split into Image and Info)
        main_layout = QHBoxLayout()
        
        # Image Area
        self.scroll = QScrollArea()
        self.image_cache = None
        self.palette_colors = None # List of 256 uint32 colors
        
        self.image_label = ClickableImageLabel("No Data")
        self.image_label.setAlignment(Qt.AlignmentFlag.AlignTop | Qt.AlignmentFlag.AlignLeft)
        self.image_label.clicked.connect(self._on_image_clicked)
        
        self.scroll.setWidget(self.image_label)
        self.scroll.setWidgetResizable(True)
        main_layout.addWidget(self.scroll, stretch=3)
        
        # Info Panel
        info_panel = QWidget()
        info_layout = QFormLayout(info_panel)
        
        self.lbl_idx = QLabel("-")
        self.lbl_word = QLabel("-")
        self.lbl_byte = QLabel("-")
        self.lbl_pal = QLabel("-")
        self.lbl_coord = QLabel("-")
        
        info_layout.addRow("Tile Index:", self.lbl_idx)
        info_layout.addRow("Word Addr:", self.lbl_word)
        info_layout.addRow("Byte Addr:", self.lbl_byte)
        info_layout.addRow("Palette:", self.lbl_pal)
        info_layout.addRow("Grid (X,Y):", self.lbl_coord)
        
        main_layout.addWidget(info_panel, stretch=1)
        self.layout.addLayout(main_layout)
        
        # Internal state
        self.raw_data = None
        self.bpp = 4
        self.indices = None
        self.palette = None
        self._pixels_ref = None
        
        self.selected_tile_idx = -1
        self.current_zoom = 2.0
        
        self.btn_refresh.clicked.connect(self._recalculate)
        self.width_spinner.valueChanged.connect(self._recalculate)
        self.zoom_combo.currentIndexChanged.connect(self._on_zoom_changed)
        
    def set_palette(self, colors: List[int], pal_name: str = ""):
        """Sets a list of 256 uint32 ARGB colors."""
        if len(colors) == 256:
            self.palette_colors = colors
            self.image_cache = None
            self.current_palette_name = pal_name
            self._update_image()
            
    def get_base_address(self) -> int:
        try:
            return int(self.base_addr_input.text().strip(), 16)
        except ValueError:
            return 0
            
    def _on_zoom_changed(self):
        txt = self.zoom_combo.currentText().replace("%", "")
        self.current_zoom = int(txt) / 100.0
        self._update_image()
        
    def load_data(self, data: bytes, bpp: int = 4, palette: np.ndarray = None):
        """Loads raw bytes."""
        self.raw_data = data
        self.bpp = bpp
        self.current_palette_name = "Custom"
        
        # Default grayscale palette if none provided
        if palette is None:
            palette = np.array([0xFF000000 | (i*17 << 16) | (i*17 << 8) | (i*17) for i in range(16)], dtype=np.uint32)
        self.palette = palette
        
        self._recalculate()
        
    def _recalculate(self):
        if not self.raw_data: return
        
        base_addr = self.get_base_address() * 2 # Convert Word Address from input to Byte offset
        
        if base_addr >= len(self.raw_data):
            self.indices = None
            self._update_image()
            return
            
        data_slice = self.raw_data[base_addr:]
        
        if self.bpp == 2:
            num_tiles = len(data_slice) // 16
            arr = np.frombuffer(data_slice, dtype=np.uint8)
            self.indices = SNESTileDecoder.decode_2bpp(arr, num_tiles)
        elif self.bpp == 4:
            num_tiles = len(data_slice) // 32
            arr = np.frombuffer(data_slice, dtype=np.uint8)
            self.indices = SNESTileDecoder.decode_4bpp(arr, num_tiles)
        else:
            self.indices = None
            
        self._update_image()
        
    def _update_image(self):
        if self.indices is None:
            self.image_label.setText("No Tiles")
            return
            
        num_tiles = self.indices.shape[0]
        if num_tiles == 0:
            self.image_label.setText("No Tiles")
            return
            
        tiles_per_row = self.width_spinner.value()
        rows = (num_tiles + tiles_per_row - 1) // tiles_per_row
        
        img_w = tiles_per_row * 8
        img_h = rows * 8
        full_img_indices = np.zeros((img_h, img_w), dtype=np.uint8)
        
        for i in range(num_tiles):
            row = (i // tiles_per_row) * 8
            col = (i % tiles_per_row) * 8
            full_img_indices[row:row+8, col:col+8] = self.indices[i]
            
        safe_indices = np.clip(full_img_indices, 0, len(self.palette)-1)
        pixels = self.palette[safe_indices]
        
        contiguous_pixels = np.ascontiguousarray(pixels)
        self._pixels_ref = contiguous_pixels
        
        self.img = QImage(img_w, img_h, QImage.Format.Format_Indexed8)
        self.img.setColorCount(256)
        
        if self.palette_colors:
            for i in range(256):
                self.img.setColor(i, self.palette_colors[i])
        else:
            for i in range(256):
                self.img.setColor(i, qRgb(i, i, i))

        qimg = QImage(
            self._pixels_ref.data, 
            img_w, 
            img_h, 
            img_w * 4, 
            QImage.Format.Format_ARGB32
        )
        
        pixmap = QPixmap.fromImage(qimg)
        scaled_w = int(img_w * self.current_zoom)
        scaled_h = int(img_h * self.current_zoom)
        
        pixmap = pixmap.scaled(scaled_w, scaled_h, Qt.AspectRatioMode.KeepAspectRatio, Qt.TransformationMode.FastTransformation)
        
        # Draw selection rectangle if any
        if self.selected_tile_idx != -1 and self.selected_tile_idx < num_tiles:
            painter = QPainter(pixmap)
            pen = QPen(QColor(255, 0, 0))
            pen.setWidth(2)
            painter.setPen(pen)
            
            row = self.selected_tile_idx // tiles_per_row
            col = self.selected_tile_idx % tiles_per_row
            
            tile_size = int(8 * self.current_zoom)
            painter.drawRect(col * tile_size, row * tile_size, tile_size, tile_size)
            painter.end()
            
        self.image_label.setPixmap(pixmap)
        
    def _on_image_clicked(self, x: int, y: int):
        if self.indices is None: return
        
        tiles_per_row = self.width_spinner.value()
        
        tile_size = 8 * self.current_zoom
        col = int(x // tile_size)
        row = int(y // tile_size)
        
        if col >= tiles_per_row: return
        
        idx = row * tiles_per_row + col
        num_tiles = self.indices.shape[0]
        
        if idx >= num_tiles: return
        
        self.selected_tile_idx = idx
        self._update_image()
        
        # Word Addr = Base + (Col * 0x10) + (Row * 0x100)
        base_word = self.get_base_address()
        word_addr = base_word + (col * 0x10) + (row * 0x100)
        byte_addr = word_addr * 2
        
        self.lbl_idx.setText(str(idx))
        self.lbl_word.setText(f"{word_addr:04X}.w")
        self.lbl_byte.setText(f"{byte_addr:04X}")
        self.lbl_pal.setText(getattr(self, 'current_palette_name', "Custom"))
        self.lbl_coord.setText(f"({col}, {row})")
        
        payload = {
            "tile_index": idx,
            "word_address": word_addr,
            "byte_address": byte_addr,
            "coordinates": (col, row),
            "palette": getattr(self, 'current_palette_name', "Custom")
        }
        self.tile_selected.emit(payload)

    def highlight_tile(self, word_address: int):
        # We need to find the tile index based on the word address
        base_word = self.get_base_address()
        offset_word = word_address - base_word
        if offset_word < 0:
            return
            
        # Address format: col * 0x10 + row * 0x100
        # This means:
        row = offset_word // 0x100
        rem = offset_word % 0x100
        col = rem // 0x10
        
        tiles_per_row = self.width_spinner.value()
        if col >= tiles_per_row: return
        
        idx = row * tiles_per_row + col
        if self.indices is not None and idx < self.indices.shape[0]:
            self.selected_tile_idx = idx
            self._update_image()
            
            byte_addr = word_address * 2
            self.lbl_idx.setText(str(idx))
            self.lbl_word.setText(f"{word_address:04X}.w")
            self.lbl_byte.setText(f"{byte_addr:04X}")
            self.lbl_coord.setText(f"({col}, {row})")
