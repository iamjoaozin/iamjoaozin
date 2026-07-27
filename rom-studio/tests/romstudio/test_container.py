import pytest
from romstudio.app.container import DIContainer

class IDummyService:
    pass

class DummyService(IDummyService):
    def __init__(self):
        self.value = 42

def test_di_container():
    c = DIContainer()
    instance = DummyService()
    
    c.register_instance(IDummyService, instance)
    resolved = c.resolve(IDummyService)
    
    assert resolved is instance
    assert resolved.value == 42

def test_di_container_factory():
    c = DIContainer()
    
    def factory():
        return DummyService()
        
    c.register_factory(IDummyService, factory)
    resolved1 = c.resolve(IDummyService)
    resolved2 = c.resolve(IDummyService)
    
    assert resolved1 is not resolved2
    assert resolved1.value == 42
