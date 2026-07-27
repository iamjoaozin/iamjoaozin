from PySide6.QtWidgets import QMainWindow, QDockWidget
from PySide6.QtCore import Qt
from typing import Dict, Any

class DockManager:
    """Abstraction over QDockWidget for layout management."""
    def __init__(self, main_window: QMainWindow):
        self.main_window = main_window
        self.docks: Dict[str, QDockWidget] = {}
        
    def add_dock(self, name: str, title: str, widget: Any, area=Qt.DockWidgetArea.RightDockWidgetArea) -> QDockWidget:
        """Creates and adds a new dock widget to the main window."""
        dock = QDockWidget(title, self.main_window)
        dock.setWidget(widget)
        dock.setObjectName(name)
        self.main_window.addDockWidget(area, dock)
        self.docks[name] = dock
        return dock
        
    def remove_dock(self, name: str):
        """Removes a dock from the main window."""
        if name in self.docks:
            dock = self.docks.pop(name)
            self.main_window.removeDockWidget(dock)
            dock.deleteLater()
