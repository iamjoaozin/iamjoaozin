import numpy as np

class SNESTileDecoder:
    """Decodes SNES planar graphics formats into linear indexed arrays."""
    
    @staticmethod
    def decode_2bpp(data: np.ndarray, num_tiles: int) -> np.ndarray:
        """Decodes an array of bytes containing num_tiles 2BPP tiles."""
        expected_len = num_tiles * 16
        if len(data) < expected_len:
            data = np.pad(data, (0, expected_len - len(data)), 'constant')
        elif len(data) > expected_len:
            data = data[:expected_len]
            
        tiles_16 = data.reshape((num_tiles, 16))
        
        plane0 = tiles_16[:, 0:16:2, np.newaxis]
        plane1 = tiles_16[:, 1:16:2, np.newaxis]
        
        masks = np.array([128, 64, 32, 16, 8, 4, 2, 1], dtype=np.uint8)
        
        b0 = (plane0 & masks) != 0
        b1 = (plane1 & masks) != 0
        
        indices = b0.astype(np.uint8) | (b1.astype(np.uint8) << 1)
        return indices
        
    @staticmethod
    def decode_4bpp(data: np.ndarray, num_tiles: int) -> np.ndarray:
        """Decodes an array of bytes containing num_tiles 4BPP tiles."""
        expected_len = num_tiles * 32
        if len(data) < expected_len:
            data = np.pad(data, (0, expected_len - len(data)), 'constant')
        elif len(data) > expected_len:
            data = data[:expected_len]
            
        tiles_32 = data.reshape((num_tiles, 32))
        
        plane0 = tiles_32[:, 0:16:2, np.newaxis]
        plane1 = tiles_32[:, 1:16:2, np.newaxis]
        plane2 = tiles_32[:, 16:32:2, np.newaxis]
        plane3 = tiles_32[:, 17:32:2, np.newaxis]
        
        masks = np.array([128, 64, 32, 16, 8, 4, 2, 1], dtype=np.uint8)
        
        b0 = (plane0 & masks) != 0
        b1 = (plane1 & masks) != 0
        b2 = (plane2 & masks) != 0
        b3 = (plane3 & masks) != 0
        
        indices = (
            b0.astype(np.uint8) | 
            (b1.astype(np.uint8) << 1) | 
            (b2.astype(np.uint8) << 2) | 
            (b3.astype(np.uint8) << 3)
        )
        return indices

    @staticmethod
    def decode_cgram(data: bytes) -> np.ndarray:
        """
        Decodes SNES CGRAM (512 bytes) into a NumPy array of 256 RGBA colors (uint32).
        SNES uses 15-bit color (BGR555).
        """
        if len(data) < 512:
            data = data.ljust(512, b'\x00')
            
        words = np.frombuffer(data[:512], dtype=np.uint16)
        
        r = ((words & 0x1F) << 3).astype(np.uint32)
        g = (((words >> 5) & 0x1F) << 3).astype(np.uint32)
        b = (((words >> 10) & 0x1F) << 3).astype(np.uint32)
        a = np.full_like(r, 255, dtype=np.uint32)
        
        # In PySide6 (QImage.Format_RGBA8888), we need R, G, B, A order in memory
        # or we can pack them into ARGB32 depending on QImage format.
        # Let's pack as 0xAARRGGBB for Format_ARGB32
        colors = (a << 24) | (r << 16) | (g << 8) | b
        return colors
