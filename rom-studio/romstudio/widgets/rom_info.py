from PySide6.QtWidgets import QWidget, QFormLayout, QLabel
from romcore.models.rom import RomInfo

class RomInfoWidget(QWidget):
    """Displays parsed information from the SNES ROM header."""
    
    def __init__(self):
        super().__init__()
        self.layout = QFormLayout(self)
        
        self.lbl_title = QLabel("-")
        self.lbl_type = QLabel("-")
        self.lbl_size = QLabel("-")
        self.lbl_banks = QLabel("-")
        self.lbl_sram = QLabel("-")
        self.lbl_fastrom = QLabel("-")
        self.lbl_copier = QLabel("-")
        self.lbl_checksum = QLabel("-")
        
        self.layout.addRow("Title:", self.lbl_title)
        self.layout.addRow("ROM Type:", self.lbl_type)
        self.layout.addRow("Size:", self.lbl_size)
        self.layout.addRow("Banks:", self.lbl_banks)
        self.layout.addRow("SRAM Size:", self.lbl_sram)
        self.layout.addRow("FastROM:", self.lbl_fastrom)
        self.layout.addRow("Copier Header:", self.lbl_copier)
        self.layout.addRow("Checksum:", self.lbl_checksum)
        
    def update_info(self, info: RomInfo):
        """Updates the labels with a new RomInfo object."""
        self.lbl_title.setText(info.title)
        self.lbl_type.setText(info.rom_type.value)
        self.lbl_size.setText(f"{info.size_bytes / 1024 / 1024:.2f} MB")
        self.lbl_banks.setText(str(info.banks))
        self.lbl_sram.setText(f"{info.sram_size} KB" if info.sram_size else "None")
        self.lbl_fastrom.setText("Yes" if info.is_fastrom else "No")
        self.lbl_copier.setText("Yes" if info.has_copier_header else "No")
        
        chk_str = f"0x{info.checksum:04X}"
        if info.checksum == info.calculated_checksum:
            chk_str += " (OK)"
        else:
            chk_str += f" (Expected 0x{info.calculated_checksum:04X})"
        self.lbl_checksum.setText(chk_str)
