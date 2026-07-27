from PySide6.QtWidgets import QTableView, QHeaderView, QVBoxLayout, QWidget
from PySide6.QtCore import QAbstractTableModel, Qt, QModelIndex
from PySide6.QtGui import QFont, QColor

class HexTableModel(QAbstractTableModel):
    """Virtual Table Model for rendering millions of bytes instantly."""
    
    def __init__(self, data: bytes):
        super().__init__()
        self._data = data
        self.cols = 16
        self.rows = (len(data) + self.cols - 1) // self.cols
        
    def rowCount(self, parent=QModelIndex()):
        return self.rows
        
    def columnCount(self, parent=QModelIndex()):
        # 16 hex columns + 1 ASCII column
        return self.cols + 1
        
    def data(self, index, role=Qt.ItemDataRole.DisplayRole):
        if not index.isValid():
            return None
            
        row = index.row()
        col = index.column()
        offset = row * self.cols + col
        
        if role == Qt.ItemDataRole.DisplayRole:
            if col < self.cols:
                if offset < len(self._data):
                    return f"{self._data[offset]:02X}"
                return ""
            else:
                # ASCII column
                start = row * self.cols
                end = min(start + self.cols, len(self._data))
                chunk = self._data[start:end]
                # Replace non-printable characters with '.'
                ascii_str = "".join(chr(c) if 32 <= c <= 126 else "." for c in chunk)
                return ascii_str
                
        if role == Qt.ItemDataRole.TextAlignmentRole:
            if col < self.cols:
                return int(Qt.AlignmentFlag.AlignCenter)
            return int(Qt.AlignmentFlag.AlignLeft | Qt.AlignmentFlag.AlignVCenter)
            
        # Example of how we might colorize later based on RomMap
        # if role == Qt.ItemDataRole.BackgroundRole:
        #    return QColor("#2D2D2D")
            
        return None
        
    def headerData(self, section, orientation, role=Qt.ItemDataRole.DisplayRole):
        if role == Qt.ItemDataRole.DisplayRole:
            if orientation == Qt.Orientation.Horizontal:
                if section < self.cols:
                    return f"{section:02X}"
                return "ASCII"
            else:
                return f"{section * self.cols:08X}"
        return None

class HexEditorWidget(QWidget):
    """A highly performant hexadecimal viewer using QTableView virtualization."""
    
    def __init__(self):
        super().__init__()
        self.layout = QVBoxLayout(self)
        self.layout.setContentsMargins(0, 0, 0, 0)
        
        self.table = QTableView()
        # Set a monospaced font
        font = QFont("Consolas", 10)
        font.setStyleHint(QFont.StyleHint.Monospace)
        self.table.setFont(font)
        
        # Optimize rendering
        self.table.verticalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Fixed)
        self.table.verticalHeader().setDefaultSectionSize(20)
        
        self.table.horizontalHeader().setSectionResizeMode(QHeaderView.ResizeMode.Fixed)
        self.table.horizontalHeader().setDefaultSectionSize(25)
        # Make the ASCII column wider
        self.table.horizontalHeader().setStretchLastSection(True)
        
        self.table.setShowGrid(False)
        self.table.setSelectionMode(QTableView.SelectionMode.SingleSelection)
        self.table.setSelectionBehavior(QTableView.SelectionBehavior.SelectItems)
        
        self.layout.addWidget(self.table)
        
    def load_data(self, data: bytes):
        """Loads data into the virtual model."""
        self.model = HexTableModel(data)
        self.table.setModel(self.model)
        
        # Re-adjust ASCII column if necessary
        self.table.setColumnWidth(16, 200)

    def scroll_to_offset(self, offset: int):
        """Scrolls the view to the specified offset."""
        if not hasattr(self, 'model') or self.model is None:
            return
        row = offset // 16
        index = self.model.index(row, 0)
        self.table.scrollTo(index, QTableView.ScrollHint.PositionAtTop)
        self.table.selectRow(row)
