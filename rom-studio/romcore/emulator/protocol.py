import struct
from dataclasses import dataclass
from typing import Optional

@dataclass
class Message:
    req_id: int
    opcode: int
    payload: bytes
    
    def serialize(self) -> bytes:
        # Version(1), ReqID(4), Opcode(1), Length(4), Payload(N)
        header = struct.pack("<B I B I", 1, self.req_id, self.opcode, len(self.payload))
        return header + self.payload
        
    @staticmethod
    def deserialize(data: bytes) -> Optional['Message']:
        if len(data) < 10:
            return None
        version, req_id, opcode, length = struct.unpack("<B I B I", data[:10])
        if len(data) < 10 + length:
            return None
        payload = data[10:10+length]
        return Message(req_id, opcode, payload)
