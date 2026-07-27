-- romstudio_mesen_bridge.lua
-- Run this script inside Mesen 2 (Debug -> Script Window)

local socket = require("socket")

local host, port = "127.0.0.1", 65816
local server = socket.tcp()
server:setoption('reuseaddr', true)
assert(server:bind(host, port))
assert(server:listen(5))
server:settimeout(0) -- non-blocking

local client = nil
local frame_count = 0

local function pack32_le(val)
    return string.char(val % 256, math.floor(val / 256) % 256, math.floor(val / 65536) % 256, math.floor(val / 16777216) % 256)
end

local function send_packet(opcode, payload)
    if not client then return end
    payload = payload or ""
    local header = string.char(opcode) .. pack32_le(#payload)
    local _, err = client:send(header .. payload)
    if err == "closed" then
        client = nil
        emu.log("ROM Studio disconnected.")
    end
end

local function handle_client()
    if not client then
        client = server:accept()
        if client then
            client:settimeout(0)
            emu.log("ROM Studio connected!")
        end
        return
    end

    -- Try to read header (5 bytes: 1 opcode, 4 length)
    local header, err = client:receive(5)
    if err == "closed" then
        emu.log("ROM Studio disconnected.")
        client = nil
        return
    end
    
    if header and #header == 5 then
        local opcode = string.byte(header, 1)
        local l1, l2, l3, l4 = string.byte(header, 2, 5)
        local length = l1 + (l2 * 256) + (l3 * 65536) + (l4 * 16777216)
        
        local payload = ""
        if length > 0 then
            payload, err = client:receive(length)
            if not payload then return end -- simple implementation, assume small packets arrive whole
        end
        
        -- PAUSE = 0x01
        if opcode == 0x01 then
            emu.pause()
        -- RESUME = 0x02
        elseif opcode == 0x02 then
            emu.resume()
        -- READ = 0x03 (Payload: Domain(1), Addr(4), Size(4))
        elseif opcode == 0x03 and #payload == 9 then
            local domain_id = string.byte(payload, 1)
            local a1, a2, a3, a4 = string.byte(payload, 2, 5)
            local addr = a1 + (a2 * 256) + (a3 * 65536) + (a4 * 16777216)
            local s1, s2, s3, s4 = string.byte(payload, 6, 9)
            local size = s1 + (s2 * 256) + (s3 * 65536) + (s4 * 16777216)
            
            -- Map domain_id to emu.memType (0:CPU, 1:VRAM, 2:CGRAM, 3:OAM)
            local mem_type
            if domain_id == 1 then mem_type = emu.memType.vram 
            elseif domain_id == 2 then mem_type = emu.memType.cgram
            elseif domain_id == 3 then mem_type = emu.memType.oam
            else mem_type = emu.memType.cpu end
            
            local data = {}
            for i=0, size-1 do
                -- Mesen 2 emu.read syntax
                local b = emu.read(addr + i, mem_type)
                table.insert(data, string.char(b or 0))
            end
            
            -- Send response: 0x83
            send_packet(0x83, table.concat(data))
        end
    end
end

-- DMA callback
local function on_dma(address, value)
    if not client then return end
    
    -- When MDMAEN (0x420B) is written, we check which channels triggered
    for ch = 0, 7 do
        -- Lua bitwise AND
        if (value & (1 << ch)) ~= 0 then
            local base = 0x4300 + (ch * 0x10)
            local dmap = emu.read(base, emu.memType.cpu)
            local bbad = emu.read(base + 1, emu.memType.cpu)
            local a1t = emu.read(base + 2, emu.memType.cpu) | (emu.read(base + 3, emu.memType.cpu) << 8)
            local a1b = emu.read(base + 4, emu.memType.cpu)
            local das = emu.read(base + 5, emu.memType.cpu) | (emu.read(base + 6, emu.memType.cpu) << 8)
            
            local source = (a1b << 16) | a1t
            local dest = bbad
            local length = das
            if length == 0 then length = 0x10000 end
            
            -- Payload: Source(4), Dest(2), Length(4), Channel(1), Mode(1)
            local dest_low = dest % 256
            local dest_high = math.floor(dest / 256)
            local p = pack32_le(source) .. string.char(dest_low, dest_high) .. pack32_le(length) .. string.char(ch, dmap)
            
            send_packet(0x85, p)
        end
    end
end

emu.addMemoryCallback(on_dma, emu.callbackType.write, 0x420B)

local function on_end_frame()
    frame_count = frame_count + 1
    handle_client()
    send_packet(0x84, pack32_le(frame_count))
end

emu.addEventCallback(on_end_frame, emu.eventType.endFrame)
emu.log("ROM Studio Bridge running on port 65816...")
