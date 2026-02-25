# MCP Tool Exposure Strategy

## Goal
Balance three things at once:
1. Keep initial MCP context small.
2. Keep tool discoverability for AI.
3. Avoid random/wrong tool calls.

## Default Policy
The default profile is **`core`** (`discovery + mini-core`).

- `discovery` tools are always enabled:
  - `server_search_tools`
  - `server_list_tool_categories`
  - `server_get_tool_detail`
- `mini-core` keeps only high-frequency operations enabled by default.
- All other tools remain available in the project but are disabled until enabled in Tool Manager.

## Mini-Core Tool Set
Enabled by default:
- Scene: `scene_get_current_scene`, `scene_get_scene_hierarchy`, `scene_get_scene_list`, `scene_open_scene`, `scene_save_scene`
- Node: `node_get_node_info`, `node_find_nodes`, `node_find_node_by_name`, `node_create_node`, `node_set_node_transform`, `node_set_node_property`, `node_delete_node`
- Component: `component_get_components`, `component_get_component_info`, `component_add_component`, `component_set_component_property`
- Prefab: `prefab_get_prefab_list`, `prefab_get_prefab_info`, `prefab_instantiate_prefab`, `prefab_create_prefab`, `prefab_update_prefab`
- Project/Debug/Server: `project_get_project_info`, `project_get_assets`, `debug_get_console_logs`, `debug_validate_scene`, `debug_get_editor_info`, `server_get_server_status`

## Runtime Behavior
- `tools/list` returns only **exposed (enabled)** tools.
- `tools/call` enforces exposure policy. Disabled tools are rejected.
- `server_search_tools` can search all installed tools (enabled and disabled) and mark `enabled` status.
- Tool Manager displays the **full configurable tool list**; only tools with `enabled=true` are exposed to MCP clients.

## Recommended AI Call Flow
1. Try direct call if tool is known.
2. If unknown/unsure, call `server_search_tools`.
3. Call `server_get_tool_detail` for schema and sample params.
4. Execute final `tools/call`.

## Operations
- Use Tool Manager to switch to broader profiles (e.g. full set) by enabling more tools.
- New tools are auto-synced into existing configurations; newly added tools follow the default policy.
