import pytest
from romcore.bus import EventBus, Event, EventTypes

def test_event_bus_sync():
    bus = EventBus()
    received_events = []
    
    def callback(event: Event):
        received_events.append(event)
        
    bus.subscribe("TEST_EVENT", callback)
    bus.publish_sync(Event(type="TEST_EVENT", payload={"data": 123}))
    
    assert len(received_events) == 1
    assert received_events[0].payload["data"] == 123

def test_event_bus_sticky():
    bus = EventBus()
    received_events = []
    
    # Publish sticky before subscribing
    bus.publish_sticky(Event(type="STICKY_EVENT", payload={"status": "ready"}))
    
    def callback(event: Event):
        received_events.append(event)
        
    bus.subscribe("STICKY_EVENT", callback)
    
    assert len(received_events) == 1
    assert received_events[0].payload["status"] == "ready"
    
    # Ensure it doesn't trigger again for new events unless published
    bus.clear_sticky("STICKY_EVENT")
    bus.subscribe("STICKY_EVENT", lambda e: None)
