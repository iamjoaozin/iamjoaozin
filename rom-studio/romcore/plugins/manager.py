from typing import Dict, List, Any
from pathlib import Path
from .api import IPlugin
from ..bus import EventBus, Event, EventTypes

class PluginManager:
    """Discovers, loads, and manages plugins based on their manifests."""
    def __init__(self, container: Any, event_bus: EventBus):
        self.container = container
        self.event_bus = event_bus
        self._plugins: Dict[str, IPlugin] = {}
        
    def discover_and_load(self, plugin_dir: Path):
        """Stub for dynamically discovering plugins in a directory."""
        # A full implementation would use pkgutil or importlib to find modules and load them.
        pass
        
    def register(self, plugin: IPlugin):
        """Registers a single plugin explicitly."""
        name = plugin.manifest.name
        self._plugins[name] = plugin
        plugin.initialize(self.container)
        
        # Notify the rest of the application that a new plugin is available
        self.event_bus.publish_sync(Event(
            type=EventTypes.PLUGIN_LOADED, 
            payload={"plugin": plugin.manifest}
        ))
        
    def get_plugins_by_capability(self, capability: str) -> List[IPlugin]:
        """Returns plugins matching a capability flag (e.g., 'is_decompressor')."""
        matches = []
        for p in self._plugins.values():
            caps = p.manifest.capabilities
            if getattr(caps, capability, False):
                matches.append(p)
        return matches
