# MCP 工具暴露策略

## 目标
同时平衡三件事：
1. 控制 MCP 首次上下文体积。
2. 保持 AI 对工具的可发现性。
3. 减少随机/错误工具调用。

## 默认策略
默认 profile 为 **`core`**（`discovery + mini-core`）。

- `discovery` 工具始终启用：
  - `server_search_tools`
  - `server_list_tool_categories`
  - `server_get_tool_detail`
- `mini-core` 默认只启用高频操作。
- 其余工具仍保留在项目中，但默认禁用，需在 Tool Manager 中手动启用。

## Mini-Core 默认工具集
默认启用：
- Scene: `scene_get_current_scene`, `scene_get_scene_hierarchy`, `scene_get_scene_list`, `scene_open_scene`, `scene_save_scene`
- Node: `node_get_node_info`, `node_find_nodes`, `node_find_node_by_name`, `node_create_node`, `node_set_node_transform`, `node_set_node_property`, `node_delete_node`
- Component: `component_get_components`, `component_get_component_info`, `component_add_component`, `component_set_component_property`
- Prefab: `prefab_get_prefab_list`, `prefab_get_prefab_info`, `prefab_instantiate_prefab`, `prefab_create_prefab`, `prefab_update_prefab`
- Project/Debug/Server: `project_get_project_info`, `project_get_assets`, `debug_get_console_logs`, `debug_validate_scene`, `debug_get_editor_info`, `server_get_server_status`

## 运行时行为
- `tools/list` 仅返回**已暴露（已启用）**的工具。
- `tools/call` 会强制执行暴露策略，禁用工具会被拒绝。
- `server_search_tools` 可检索全部已安装工具（含启用与禁用），并返回其 `enabled` 状态。
- Tool Manager 页面展示的是**全部可配置工具**；只有 `enabled=true` 的工具会暴露给 MCP 客户端。

## 推荐 AI 调用流程
1. 如果已知工具名，先直接调用。
2. 若不确定工具名或用途，调用 `server_search_tools`。
3. 再调用 `server_get_tool_detail` 获取 schema 与参数示例。
4. 最后执行正式 `tools/call`。

## 运维与使用
- 在 Tool Manager 中启用更多工具，可切换到更宽的工具集（例如 full set）。
- 新增工具会自动同步到已有配置；新工具默认遵循当前默认暴露策略。
