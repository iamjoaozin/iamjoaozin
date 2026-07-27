from PySide6.QtCore import QObject, Signal
from romcore.bus import EventBus, Event

class UIBusBridge(QObject):
    """
    Bridges the thread-safe romcore EventBus with PySide6 Qt Signals.
    This ensures that UI updates triggered by background threads happen on the main thread safely.
    """
    event_received = Signal(Event)
    
    def __init__(self, event_bus: EventBus):
        super().__init__()
        self.event_bus = event_bus
        
    def subscribe_ui(self, event_type: str):
        """
        Subscribes to an EventBus event type.
        When the core bus fires, it emits a Qt signal which is thread-safe for the UI.
        """
        def callback(event: Event):
            self.event_received.emit(event)
            
        self.event_bus.subscribe(event_type, callback)
