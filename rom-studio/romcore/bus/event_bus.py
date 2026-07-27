import threading
from collections import defaultdict
from typing import Callable, Dict, List, Optional
from .events import Event

class EventBus:
    """
    Central Message Bus for loosely coupled communication.
    Supports synchronous, asynchronous (via threads), and sticky events.
    Filters and priorities could be added in future iterations if required.
    """
    def __init__(self):
        self._subscribers: Dict[str, List[Callable[[Event], None]]] = defaultdict(list)
        self._sticky_events: Dict[str, Event] = {}
        self._lock = threading.RLock()
        
    def subscribe(self, event_type: str, callback: Callable[[Event], None]):
        """Subscribes a callback to an event type."""
        with self._lock:
            if callback not in self._subscribers[event_type]:
                self._subscribers[event_type].append(callback)
            
            # Immediately trigger sticky events if they exist
            if event_type in self._sticky_events:
                callback(self._sticky_events[event_type])
                
    def unsubscribe(self, event_type: str, callback: Callable[[Event], None]):
        """Unsubscribes a callback."""
        with self._lock:
            if callback in self._subscribers[event_type]:
                self._subscribers[event_type].remove(callback)
                
    def publish_sync(self, event: Event):
        """Publishes an event synchronously on the current thread."""
        with self._lock:
            # Copy list to avoid issues if subscribers mutate the list during iteration
            callbacks = list(self._subscribers[event.type])
        
        for callback in callbacks:
            callback(event)
            
    def publish_async(self, event: Event):
        """Publishes an event asynchronously in a background thread."""
        # For a truly robust system, a ThreadPoolExecutor or QThread could be used here.
        # Simple threading for now.
        thread = threading.Thread(target=self.publish_sync, args=(event,))
        thread.daemon = True
        thread.start()
        
    def publish_sticky(self, event: Event):
        """Publishes an event and stores it so future subscribers receive it immediately."""
        with self._lock:
            self._sticky_events[event.type] = event
        self.publish_sync(event)
        
    def clear_sticky(self, event_type: str):
        """Clears a sticky event."""
        with self._lock:
            if event_type in self._sticky_events:
                del self._sticky_events[event_type]
