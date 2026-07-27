from PySide6.QtWidgets import QWidget, QVBoxLayout, QTableView, QHBoxLayout, QPushButton, QLineEdit
from PySide6.QtCore import QAbstractTableModel, Qt, QModelIndex, QTimer
from romcore.emulator.dma_tracker import DMATracker

class DMATableModel(QAbstractTableModel):
    def __init__(self, tracker: DMATracker):
        super().__init__()
        self.tracker = tracker
        self.headers = ["ID", "Frame", "Channel", "Mode", "Source", "Dest", "Length"]

    def rowCount(self, parent=QModelIndex()):
        return len(self.tracker.history)

    def columnCount(self, parent=QModelIndex()):
        return len(self.headers)

    def headerData(self, section, orientation, role):
        if role == Qt.ItemDataRole.DisplayRole and orientation == Qt.Orientation.Horizontal:
            return self.headers[section]
        return None

    def data(self, index, role):
        if not index.isValid() or role != Qt.ItemDataRole.DisplayRole:
            return None
            
        entry = self.tracker.history[index.row()]
        col = index.column()
        
        if col == 0: return str(entry.id)
        if col == 1: return str(entry.frame)
        if col == 2: return str(entry.channel)
        if col == 3: return f"0x{entry.mode:02X}"
        if col == 4: return f"0x{entry.source:06X}"
        if col == 5: return f"0x{entry.dest:04X}"
        if col == 6: return f"0x{entry.length:04X}"
        return None
        
    def refresh(self):
        self.layoutChanged.emit()

class DMATrackerWidget(QWidget):
    def __init__(self, tracker: DMATracker):
        super().__init__()
        self.tracker = tracker
        self.layout = QVBoxLayout(self)
        
        self.toolbar = QHBoxLayout()
        self.btn_clear = QPushButton("Clear")
        
        self.toolbar.addWidget(self.btn_clear)
        self.toolbar.addStretch()
        self.layout.addLayout(self.toolbar)
        
        self.table = QTableView()
        self.model = DMATableModel(self.tracker)
        self.table.setModel(self.model)
        
        self.table.verticalHeader().hide()
        self.table.horizontalHeader().setStretchLastSection(True)
        self.table.setSelectionBehavior(QTableView.SelectionBehavior.SelectRows)
        
        self.layout.addWidget(self.table)
        
        self.btn_clear.clicked.connect(self._clear)
        
        # Refresh table smoothly
        self.timer = QTimer(self)
        self.timer.timeout.connect(self.refresh)
        self.timer.start(500)
        
        self._last_count = 0
        
    def _clear(self):
        self.model.beginResetModel()
        self.tracker.clear()
        self._last_count = 0
        self.model.endResetModel()
        
    def refresh(self):
        current_count = len(self.tracker.history)
        if current_count != self._last_count:
            self.model.refresh()
            self.table.scrollToBottom()
            self._last_count = current_count
