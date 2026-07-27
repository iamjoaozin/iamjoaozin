from PySide6.QtWidgets import QWidget, QVBoxLayout, QGraphicsView, QGraphicsScene, QComboBox, QHBoxLayout
from PySide6.QtGui import QColor, QBrush, QPen, QPainter
from PySide6.QtCore import Qt, Signal
from romcore.models.rom_map import RomMap, RegionType

class HeatmapView(QGraphicsView):
    offset_selected = Signal(int)
    
    def mousePressEvent(self, event):
        item = self.itemAt(event.position().toPoint())
        if item:
            offset = item.data(0)
            if offset is not None:
                self.offset_selected.emit(offset)
        super().mousePressEvent(event)

class HeatmapWidget(QWidget):
    """Visualizes the ROM as a grid of colored blocks."""
    
    offset_selected = Signal(int)
    
    def __init__(self):
        super().__init__()
        self.layout = QVBoxLayout(self)
        self.layout.setContentsMargins(0, 0, 0, 0)
        
        # Controls
        controls = QHBoxLayout()
        self.mode_combo = QComboBox()
        self.mode_combo.addItems(["Entropy", "Region Type"])
        controls.addWidget(self.mode_combo)
        controls.addStretch()
        self.layout.addLayout(controls)
        
        # View
        self.scene = QGraphicsScene()
        self.view = HeatmapView(self.scene)
        self.view.setRenderHint(QPainter.RenderHint.Antialiasing, False)
        self.view.offset_selected.connect(self.offset_selected.emit)
        
        self.layout.addWidget(self.view)
        
        self.block_size = 16
        self.rom_map = None
        self.rom_size = 0
        
        self.mode_combo.currentTextChanged.connect(self._re_render)
        
    def load_map(self, rom_map: RomMap, rom_size: int):
        self.rom_map = rom_map
        self.rom_size = rom_size
        self._re_render()
        
    def _re_render(self):
        if not self.rom_map:
            return
            
        self.scene.clear()
        mode = self.mode_combo.currentText().lower()
        
        # Calculate grid
        blocks_per_row = 64
        
        regions = list(self.rom_map.regions.values())
        for region in regions:
            chunk_size = region.size
            if chunk_size <= 0: continue
            
            # Simple assumption that regions are chunk-aligned for now
            chunk_idx = region.start // 4096
            row = chunk_idx // blocks_per_row
            col = chunk_idx % blocks_per_row
            
            x = col * self.block_size
            y = row * self.block_size
            
            color = self._get_color(region, mode)
            rect = self.scene.addRect(x, y, self.block_size, self.block_size, QPen(Qt.PenStyle.NoPen), QBrush(color))
            rect.setData(0, region.start)
            
    def _get_color(self, region, mode: str) -> QColor:
        if mode == "entropy":
            intensity = min(int((region.entropy / 8.0) * 255), 255)
            # Heat scale: Blue (low) to Red (high)
            return QColor(intensity, 0, 255 - intensity)
        else:
            if region.region_type == RegionType.CODE: return QColor("#3498db")
            if region.region_type == RegionType.DATA: return QColor("#2ecc71")
            if region.region_type == RegionType.COMPRESSED: return QColor("#e74c3c")
            if region.region_type == RegionType.UNKNOWN: return QColor("#95a5a6")
            return QColor("white")
