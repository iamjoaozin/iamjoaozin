from dataclasses import dataclass, field
from typing import List, Any
from abc import ABC, abstractmethod

@dataclass
class PluginCapabilities:
    """Defines the supported features of a plugin for dynamic discovery."""
    is_decompressor: bool = False
    is_viewer: bool = False
    is_analyzer: bool = False
    tags: List[str] = field(default_factory=list)

@dataclass
class PluginManifest:
    """Metadata describing a plugin and its capabilities."""
    name: str
    version: str
    description: str
    capabilities: PluginCapabilities
    author: str = ""

class IPlugin(ABC):
    """Base interface for all platform plugins."""
    
    @property
    @abstractmethod
    def manifest(self) -> PluginManifest:
        """Returns the plugin's metadata manifest."""
        pass
        
    @abstractmethod
    def initialize(self, container: Any):
        """
        Called when the plugin is loaded.
        The plugin should use the DI container to register its services,
        subscribe to EventBus events, or add its UI components to the DockManager.
        """
        pass
        
    @abstractmethod
    def shutdown(self):
        """Called when the plugin is unloaded."""
        pass
