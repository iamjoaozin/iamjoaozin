import numpy as np
from romcore.analyzer import SNESTileDecoder

def test_decode_2bpp():
    # A single 2BPP tile = 16 bytes
    # Let's make a tile where plane 0 is all 1s (0xFF), plane 1 is all 0s (0x00)
    # Row 0: p0, p1 -> 0xFF, 0x00
    data = bytearray(16)
    for i in range(0, 16, 2):
        data[i] = 0xFF
        data[i+1] = 0x00
        
    arr = np.frombuffer(data, dtype=np.uint8)
    indices = SNESTileDecoder.decode_2bpp(arr, 1)
    
    # Should be shape (1, 8, 8) and all values should be 1
    assert indices.shape == (1, 8, 8)
    assert np.all(indices == 1)
    
def test_decode_4bpp():
    # A single 4BPP tile = 32 bytes
    data = bytearray(32)
    # Let's set plane 0 and plane 3 to 1s
    # Plane 0: bytes 0, 2, 4..14 -> 0xFF
    # Plane 1: bytes 1, 3, 5..15 -> 0x00
    # Plane 2: bytes 16, 18..30 -> 0x00
    # Plane 3: bytes 17, 19..31 -> 0xFF
    for i in range(0, 16, 2):
        data[i] = 0xFF       # p0
        data[i+1] = 0x00     # p1
        data[16+i] = 0x00    # p2
        data[16+i+1] = 0xFF  # p3
        
    arr = np.frombuffer(data, dtype=np.uint8)
    indices = SNESTileDecoder.decode_4bpp(arr, 1)
    
    # Indices should be 1 (p0) + 8 (p3) = 9
    assert indices.shape == (1, 8, 8)
    assert np.all(indices == 9)

def test_decode_cgram():
    # 0x7FFF is white (15 bits all 1)
    # BGR555 -> 0 11111 11111 11111
    # 0x0000 is black
    # 0x001F is red
    cgram = bytearray(512)
    cgram[0:2] = b'\xFF\x7F' # White
    cgram[2:4] = b'\x1F\x00' # Red
    
    colors = SNESTileDecoder.decode_cgram(bytes(cgram))
    
    assert len(colors) == 256
    # 0x7FFF -> B=31, G=31, R=31 -> *8 = 248 -> 0xF8
    # ARGB white is 0xFFF8F8F8
    assert colors[0] == 0xFFF8F8F8
    # Red is R=31*8=248. Alpha=255. G=0, B=0
    # AARRGGBB = FF F8 00 00 = 4294443008
    assert colors[1] == 0xFFF80000
