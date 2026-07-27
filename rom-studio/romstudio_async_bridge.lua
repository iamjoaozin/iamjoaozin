-- romstudio_async_bridge.lua
-- Asynchronous Binary Bridge for Mesen 2
local ipc_dir = "C:/Users/doxyh/Downloads/iamjoaozin-main/rom-studio/ipc/"
local cmd_file = ipc_dir .. "rom_cmd.txt"
local resp_file = ipc_dir .. "rom_resp.bin"

-- Pack/Unpack helpers (Little Endian)
local function unpack32_le(s, pos)
    local b1, b2, b3, b4 = string.byte(s, pos, pos+3)
    return b1 | (b2 << 8) | (b3 << 16) | (b4 << 24)
end

local function pack32_le(val)
    return string.char(val & 0xFF, (val >> 8) & 0xFF, (val >> 16) & 0xFF, (val >> 24) & 0xFF)
end

local function get_mem_type(domain_val)
    local mt = emu.memType or emu.memoryType or {}
    if domain_val == 1 then return mt.ppu or mt.vram or "PPU"
    elseif domain_val == 2 then return mt.cgram or "CGRAM"
    elseif domain_val == 3 then return mt.oam or "OAM"
    else return mt.cpu or "CPU" end
end

local function handle_command()
    local f = io.open(cmd_file, "rb")
    if not f then return end
    
    local data = f:read("*a")
    f:close()
    os.remove(cmd_file)
    
    if #data < 10 then return end
    
    local version = string.byte(data, 1)
    local req_id = unpack32_le(data, 2)
    local opcode = string.byte(data, 6)
    local length = unpack32_le(data, 7)
    
    if #data < 10 + length then return end
    local payload = string.sub(data, 11, 10 + length)
    
    if opcode == 0x03 then -- READ MEMORY
        local domain_val = string.byte(payload, 1)
        local addr = unpack32_le(payload, 2)
        local size = unpack32_le(payload, 6)
        
        local mem_type = get_mem_type(domain_val)
        local res_data = {}
        
        -- Safe reading strategy: use readByteArray if available (much faster)
        if emu.readByteArray then
            local ok, block = pcall(emu.readByteArray, addr, size, mem_type)
            if ok and type(block) == "table" then
                for i=1, #block do table.insert(res_data, string.char(block[i] & 0xFF)) end
            elseif ok and type(block) == "string" then
                -- if it returned a string already
                res_data = {block}
            else
                -- Fallback to slow loop
                for i=0, size-1 do
                    local ok2, b = pcall(emu.read, addr + i, mem_type)
                    if not ok2 or type(b) ~= "number" then b = 0 end
                    table.insert(res_data, string.char(b & 0xFF))
                end
            end
        else
            for i=0, size-1 do
                local ok2, b = pcall(emu.read, addr + i, mem_type)
                if not ok2 or type(b) ~= "number" then b = 0 end
                table.insert(res_data, string.char(b & 0xFF))
            end
        end
        
        local res_str = table.concat(res_data)
        
        local resp_header = string.char(1) .. pack32_le(req_id) .. string.char(0x83) .. pack32_le(#res_str + 9)
        local resp_payload = string.char(domain_val) .. pack32_le(addr) .. pack32_le(size) .. res_str
        local out_msg = resp_header .. resp_payload
        
        local rf = io.open(resp_file .. ".tmp", "wb")
        if rf then
            rf:write(out_msg)
            rf:close()
            os.rename(resp_file .. ".tmp", resp_file)
        end
    end
end

local function on_end_frame()
    handle_command()
end

emu.addEventCallback(on_end_frame, emu.eventType.endFrame)
emu.log("ROM Studio Async Bridge Initialized!")