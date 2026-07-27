from dataclasses import dataclass, field
from typing import Dict, Any, Optional

@dataclass
class Event:
    """A generic event passed through the EventBus."""
    type: str
    payload: Dict[str, Any] = field(default_factory=dict)
    sender: str = "System"

class EventTypes:
    """Standard Event Types used across the platform."""
    ROM_LOADED = "ROM_LOADED"
    ROM_CLOSED = "ROM_CLOSED"
    ROM_MAP_UPDATED = "ROM_MAP_UPDATED"
    SCAN_STARTED = "SCAN_STARTED"
    SCAN_FINISHED = "SCAN_FINISHED"
    JOB_CREATED = "JOB_CREATED"
    JOB_UPDATED = "JOB_UPDATED"
    JOB_PROGRESS = "JOB_PROGRESS"
    JOB_FINISHED = "JOB_FINISHED"
    LOG_MESSAGE = "LOG_MESSAGE"
    WORKSPACE_OPENED = "WORKSPACE_OPENED"
    PLUGIN_LOADED = "PLUGIN_LOADED"
    APP_CLOSING = "APP_CLOSING"
    VRAM_TILE_SELECTED = "VRAM_TILE_SELECTED"
    SPRITE_SELECTED = "SPRITE_SELECTED"
    BACKGROUND_TILE_SELECTED = "BACKGROUND_TILE_SELECTED"
