from romcore.models import Region, RegionType, RomMap

def test_region_creation():
    r = Region(
        id="test_1",
        start=0x0000,
        end=0x1000,
        bank=0,
        region_type=RegionType.CODE
    )
    assert r.size == 0x1000
    assert r.region_type == RegionType.CODE

def test_rom_map():
    rm = RomMap()
    r1 = Region(id="r1", start=0, end=100, bank=0, region_type=RegionType.CODE)
    r2 = Region(id="r2", start=100, end=200, bank=0, region_type=RegionType.GRAPHICS)
    
    rm.add_region(r1)
    rm.add_region(r2)
    
    assert len(rm.get_regions_by_type(RegionType.GRAPHICS)) == 1
    assert rm.get_region("r2") == r2
