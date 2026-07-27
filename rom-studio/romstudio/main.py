import sys
from pathlib import Path
from PySide6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                               QHBoxLayout, QTabWidget, QSplitter, QFileDialog, QMessageBox)
from PySide6.QtCore import Qt

from romcore.bus.event_bus import EventBus
from romcore.bus.events import Event, EventTypes
from romstudio.widgets.hex_editor import HexEditorWidget
from romstudio.widgets.heatmap import HeatmapWidget
from romstudio.widgets.live_memory import LiveMemoryWidget
from romstudio.widgets.vram_inspector import VRAMInspectorWidget
from romstudio.widgets.sprite_inspector import SpriteInspectorWidget
from romstudio.widgets.background_inspector import BackgroundInspectorWidget
from romstudio.widgets.dma_tracker import DMATrackerWidget
from romcore.analyzer.analyzer import RomAnalyzer
from romcore.emulator.async_backend import AsyncEmulatorBackend
from romcore.emulator.transport import FileTransport

class RomStudioMainWindow(QMainWindow):
    def __init__(self, event_bus: EventBus):
        super().__init__()
        self.setWindowTitle("ROM Studio")
        self.resize(1200, 800)
        
        self.event_bus = event_bus
        self.rom = None
        
        # Menu Bar
        menu_bar = self.menuBar()
        file_menu = menu_bar.addMenu("File")
        
        open_action = file_menu.addAction("Open ROM")
        open_action.triggered.connect(self._open_rom)
        
        emu_menu = menu_bar.addMenu("Emulator")
        connect_action = emu_menu.addAction("Connect to Mesen...")
        connect_action.triggered.connect(self._connect_emulator)
        
        # Emulator Backend
        ipc_path = str(Path(__file__).parent.parent / "ipc")
        transport = FileTransport(ipc_path)
        self.emulator_backend = AsyncEmulatorBackend(transport)
        self.emulator_backend.connect()
        
        main_widget = QWidget()
        self.setCentralWidget(main_widget)
        main_layout = QHBoxLayout(main_widget)
        
        splitter = QSplitter(Qt.Orientation.Horizontal)
        main_layout.addWidget(splitter)
        
        # Left Panel - ROM / Game Analysis
        left_panel = QTabWidget()
        self.hex_editor_widget = HexEditorWidget()
        left_panel.addTab(self.hex_editor_widget, "ROM Hex")
        
        # Right Panel - Emulator Inspection
        right_panel = QTabWidget()
        self.vram_inspector_widget = VRAMInspectorWidget(self.emulator_backend)
        right_panel.addTab(self.vram_inspector_widget, "VRAM Inspector")
        
        self.sprite_inspector_widget = SpriteInspectorWidget(self.emulator_backend, self.event_bus)
        right_panel.addTab(self.sprite_inspector_widget, "Sprite Inspector")
        
        self.background_inspector_widget = BackgroundInspectorWidget(self.emulator_backend, self.event_bus)
        right_panel.addTab(self.background_inspector_widget, "Background Inspector")
        
        self.live_memory_widget = LiveMemoryWidget(self.emulator_backend)
        right_panel.addTab(self.live_memory_widget, "Live Memory")
        
        from romcore.emulator.dma_tracker import DMATracker
        self.dma_tracker = DMATracker()
        self.emulator_backend.set_dma_callback(self.dma_tracker.add_transfer)
        
        self.dma_tracker_widget = DMATrackerWidget(self.dma_tracker)
        right_panel.addTab(self.dma_tracker_widget, "DMA Tracker")
        
        self.heatmap_widget = HeatmapWidget()
        right_panel.addTab(self.heatmap_widget, "Access Heatmap")
        
        splitter.addWidget(left_panel)
        splitter.addWidget(right_panel)
        splitter.setSizes([500, 700])
        
        # Subscriptions
        self.event_bus.subscribe(EventTypes.ROM_LOADED, self._on_rom_loaded)
        self.event_bus.subscribe(EventTypes.ROM_MAP_UPDATED, self._on_map_updated)
        self.event_bus.subscribe(EventTypes.SPRITE_SELECTED, self.vram_inspector_widget.on_sprite_selected)
        
        # Cross-communication
        self.heatmap_widget.offset_selected.connect(self._on_offset_selected)
        self.vram_inspector_widget.tile_viewer.tile_selected.connect(self._on_vram_tile_selected)

    def _on_vram_tile_selected(self, payload: dict):
        self.event_bus.publish_async(Event(type=EventTypes.VRAM_TILE_SELECTED, payload=payload))

    def _on_rom_loaded(self, event: Event):
        rom_path = event.payload.get("path")
        if not rom_path: return
        
        from romcore.models.rom import RomData
        from romcore.analyzer.analyzer import RomAnalyzer
        
        self.rom = RomData(rom_path)
        self.rom.load()
        
        analyzer = RomAnalyzer(self.rom)
        analyzer.analyze()
        
        self.hex_editor_widget.load_data(self.rom.mmap)
        self.heatmap_widget.load_map(analyzer.rom_map, self.rom.info.size_bytes)
            
    def _on_map_updated(self, event: Event):
        pass
        
    def _on_offset_selected(self, offset: int):
        self.hex_editor_widget.scroll_to_offset(offset)

    def _open_rom(self):
        file_path, _ = QFileDialog.getOpenFileName(
            self, "Open SNES ROM", "", "SNES ROMs (*.sfc *.smc);;All Files (*)"
        )
        if file_path:
            self.event_bus.publish_async(Event(type=EventTypes.ROM_LOADED, payload={"path": file_path}))

    def _connect_emulator(self):
        QMessageBox.information(self, "Connect to Mesen", "Ensure Mesen is running and the Lua script 'romstudio_async_bridge.lua' is loaded.")
        if not self.emulator_backend.is_connected():
            self.emulator_backend.connect()

    def closeEvent(self, event):
        self.emulator_backend.disconnect()
        self.event_bus.publish_async(Event(type=EventTypes.APP_CLOSING))
        super().closeEvent(event)

def main():
    app = QApplication(sys.argv)
    
    event_bus = EventBus()
    
    window = RomStudioMainWindow(event_bus)
    window.show()
    
    sys.exit(app.exec())

if __name__ == "__main__":
    main()
