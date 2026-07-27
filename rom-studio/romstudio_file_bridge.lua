-- romstudio_file_bridge.lua
-- File-based IPC Bridge for Mesen 2 (No LuaSocket required)

local ipc_dir = "C:/Users/doxyh/Downloads/iamjoaozin-main/rom-studio/ipc/"
local cmd_file = ipc_dir .. "rom_cmd.txt"
local resp_file = ipc_dir .. "rom_resp.bin"
local dma_file = ipc_dir .. "dma_log.txt"

-- Ensure we can write
local test = io.open(ipc_dir .. "test.txt", "w")
if test then 
    test:write("ok")
    test:close()
    os.remove(ipc_dir .. "test.txt")
else
    emu.log("ERROR: Cannot write to IPC directory! Make sure I/O is allowed in Settings.")
    return
end

emu.log("ROM Studio File Bridge Initialized!")
emu.log("Waiting for commands in: " .. ipc_dir)

local function handle_command()
    local f = io.open(cmd_file, "r")
    if not f then return end
    
    local line = f:read("*l")
    f:close()
    
    if line then
        local parts = {}
        for token in string.gmatch(line, "[^%s]+") do
            table.insert(parts, token)
        end
        
        if parts[1] == "PAUSE" then
            emu.pause()
        elseif parts[1] == "RESUME" then
            emu.resume()
        elseif parts[1] == "READ" and #parts >= 4 then
            local domain_id = tonumber(parts[2])
            local addr = tonumber(parts[3])
            local size = tonumber(parts[4])
            
            local mem_type
            if domain_id == 1 then mem_type = emu.memType.vram 
            elseif domain_id == 2 then mem_type = emu.memType.cgram
            elseif domain_id == 3 then mem_type = emu.memType.oam
            else mem_type = emu.memType.cpu end
            
            local data = {}
            for i=0, size-1 do
                local b = emu.read(addr + i, mem_type)
                table.insert(data, string.char(b or 0))
            end
            
            -- Write binary response
            local rf = io.open(resp_file .. ".tmp", "wb")
            if rf then
                rf:write(table.concat(data))
                rf:close()
                os.rename(resp_file .. ".tmp", resp_file)
            end
        end
    end
    
    -- Delete the command file so we don't process it again
    os.remove(cmd_file)
end

local function on_dma(address, value)
    local dma_entries = {}
    for ch = 0, 7 do
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
            
            table.insert(dma_entries, string.format("%d,%d,%d,%d,%d", source, dest, length, ch, dmap))
        end
    end
    
    if #dma_entries > 0 then
        local f = io.open(dma_file, "a")
        if f then
            for _, entry in ipairs(dma_entries) do
                f:write(entry .. "\n")
            end
            f:close()
        end
    end
end

emu.addMemoryCallback(on_dma, emu.callbackType.write, 0x420B)

local function on_end_frame()
    handle_command()
end

emu.addEventCallback(on_end_frame, emu.eventType.endFrame)
