from typing import Type, TypeVar, Dict, Any, Callable

T = TypeVar('T')

class DIContainer:
    """A simple Dependency Injection Container / Service Locator."""
    def __init__(self):
        self._services: Dict[Type, Any] = {}
        self._factories: Dict[Type, Callable[[], Any]] = {}
        
    def register_instance(self, interface: Type[T], implementation: Any):
        """Registers a singleton instance for a given interface or class."""
        self._services[interface] = implementation
        
    def register_factory(self, interface: Type[T], factory: Callable[[], Any]):
        """Registers a factory function that will be called each time the service is resolved."""
        self._factories[interface] = factory
        
    def resolve(self, interface: Type[T]) -> T:
        """Resolves the implementation for a given interface."""
        if interface in self._services:
            return self._services[interface]
        if interface in self._factories:
            return self._factories[interface]()
            
        raise KeyError(f"No service registered for {interface}")

# Global container instance
container = DIContainer()
