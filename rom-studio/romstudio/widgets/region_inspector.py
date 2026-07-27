from PySide6.QtWidgets import QWidget, QFormLayout, QLabel
from PySide6.QtGui import QFont
from romcore.models.rom_map import Region

class RegionInspectorWidget(QWidget):
    """Displays detailed information about a selected ROM region."""
    
    def __init__(self):
        super().__init__()
        self.layout = QFormLayout(self)
        
        mono_font = QFont("Consolas", 10)
        
        self.lbl_id = QLabel("-")
        self.lbl_start = QLabel("-")
        self.lbl_start.setFont(mono_font)
        
        self.lbl_end = QLabel("-")
        self.lbl_end.setFont(mono_font)
        
        self.lbl_size = QLabel("-")
        self.lbl_size.setFont(mono_font)
        
        self.lbl_bank = QLabel("-")
        self.lbl_type = QLabel("-")
        self.lbl_entropy = QLabel("-")
        
        self.layout.addRow("Region ID:", self.lbl_id)
        self.layout.addRow("Start Offset:", self.lbl_start)
        self.layout.addRow("End Offset:", self.lbl_end)
        self.layout.addRow("Size:", self.lbl_size)
        self.layout.addRow("Bank:", self.lbl_bank)
        self.layout.addRow("Type:", self.lbl_type)
        self.layout.addRow("Entropy:", self.lbl_entropy)
        
    def update_region(self, region: Region | None):
        """Updates the panel with the given region data."""
        if not region:
            self.lbl_id.setText("-")
            self.lbl_start.setText("-")
            self.lbl_end.setText("-")
            self.lbl_size.setText("-")
            self.lbl_bank.setText("-")
            self.lbl_type.setText("-")
            self.lbl_entropy.setText("-")
            return
            
        self.lbl_id.setText(region.id)
        self.lbl_start.setText(f"0x{region.start:06X}")
        self.lbl_end.setText(f"0x{region.end:06X}")
        self.lbl_size.setText(f"0x{region.size:04X} ({region.size} bytes)")
        self.lbl_bank.setText(f"0x{region.bank:02X}")
        self.lbl_type.setText(region.region_type.value)
        self.lbl_entropy.setText(f"{region.entropy:.3f}")
