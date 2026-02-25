"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPServer = void 0;
const http = __importStar(require("http"));
const url = __importStar(require("url"));
const uuid_1 = require("uuid");
const scene_tools_1 = require("./tools/scene-tools");
const node_tools_1 = require("./tools/node-tools");
const component_tools_1 = require("./tools/component-tools");
const prefab_tools_1 = require("./tools/prefab-tools");
const project_tools_1 = require("./tools/project-tools");
const debug_tools_1 = require("./tools/debug-tools");
const preferences_tools_1 = require("./tools/preferences-tools");
const server_tools_1 = require("./tools/server-tools");
const broadcast_tools_1 = require("./tools/broadcast-tools");
const scene_advanced_tools_1 = require("./tools/scene-advanced-tools");
const scene_view_tools_1 = require("./tools/scene-view-tools");
const reference_image_tools_1 = require("./tools/reference-image-tools");
const asset_advanced_tools_1 = require("./tools/asset-advanced-tools");
const validation_tools_1 = require("./tools/validation-tools");
class MCPServer {
    constructor(settings) {
        this.mcpProtocolVersion = '2024-11-05';
        this.mcpServerVersion = '1.0.0';
        this.sseKeepAliveMs = 15000;
        this.httpServer = null;
        this.tools = {};
        this.toolsList = [];
        this.enabledTools = []; // 存储启用的工具列表
        this.sessions = new Map();
        this.streamConnections = new Map();
        this.streamHeartbeatTimers = new Map();
        this.settings = settings;
        this.initializeTools();
    }
    initializeTools() {
        try {
            console.log('[MCPServer] Initializing tools...');
            this.tools.scene = new scene_tools_1.SceneTools();
            this.tools.node = new node_tools_1.NodeTools();
            this.tools.component = new component_tools_1.ComponentTools();
            this.tools.prefab = new prefab_tools_1.PrefabTools();
            this.tools.project = new project_tools_1.ProjectTools();
            this.tools.debug = new debug_tools_1.DebugTools();
            this.tools.preferences = new preferences_tools_1.PreferencesTools();
            this.tools.server = new server_tools_1.ServerTools();
            this.tools.broadcast = new broadcast_tools_1.BroadcastTools();
            this.tools.sceneAdvanced = new scene_advanced_tools_1.SceneAdvancedTools();
            this.tools.sceneView = new scene_view_tools_1.SceneViewTools();
            this.tools.referenceImage = new reference_image_tools_1.ReferenceImageTools();
            this.tools.assetAdvanced = new asset_advanced_tools_1.AssetAdvancedTools();
            this.tools.validation = new validation_tools_1.ValidationTools();
            console.log('[MCPServer] Tools initialized successfully');
        }
        catch (error) {
            console.error('[MCPServer] Error initializing tools:', error);
            throw error;
        }
    }
    async start() {
        if (this.httpServer) {
            console.log('[MCPServer] Server is already running');
            return;
        }
        try {
            console.log(`[MCPServer] Starting HTTP server on port ${this.settings.port}...`);
            this.httpServer = http.createServer(this.handleHttpRequest.bind(this));
            await new Promise((resolve, reject) => {
                this.httpServer.listen(this.settings.port, '127.0.0.1', () => {
                    console.log(`[MCPServer] ✅ HTTP server started successfully on http://127.0.0.1:${this.settings.port}`);
                    console.log(`[MCPServer] Health check: http://127.0.0.1:${this.settings.port}/health`);
                    console.log(`[MCPServer] MCP endpoint: http://127.0.0.1:${this.settings.port}/mcp`);
                    resolve();
                });
                this.httpServer.on('error', (err) => {
                    console.error('[MCPServer] ❌ Failed to start server:', err);
                    if (err.code === 'EADDRINUSE') {
                        console.error(`[MCPServer] Port ${this.settings.port} is already in use. Please change the port in settings.`);
                    }
                    reject(err);
                });
            });
            this.setupTools();
            console.log('[MCPServer] 🚀 MCP Server is ready for connections');
        }
        catch (error) {
            console.error('[MCPServer] ❌ Failed to start server:', error);
            throw error;
        }
    }
    setupTools() {
        this.toolsList = [];
        // 如果没有启用工具配置，返回所有工具
        if (!this.enabledTools || this.enabledTools.length === 0) {
            for (const [category, toolSet] of Object.entries(this.tools)) {
                const tools = toolSet.getTools();
                for (const tool of tools) {
                    this.toolsList.push({
                        name: `${category}_${tool.name}`,
                        description: tool.description,
                        inputSchema: tool.inputSchema
                    });
                }
            }
        }
        else {
            // 根据启用的工具配置过滤
            const enabledToolNames = new Set(this.enabledTools.map(tool => `${tool.category}_${tool.name}`));
            for (const [category, toolSet] of Object.entries(this.tools)) {
                const tools = toolSet.getTools();
                for (const tool of tools) {
                    const toolName = `${category}_${tool.name}`;
                    if (enabledToolNames.has(toolName)) {
                        this.toolsList.push({
                            name: toolName,
                            description: tool.description,
                            inputSchema: tool.inputSchema
                        });
                    }
                }
            }
        }
        console.log(`[MCPServer] Setup tools: ${this.toolsList.length} tools available`);
    }
    getFilteredTools(enabledTools) {
        if (!enabledTools || enabledTools.length === 0) {
            return this.toolsList; // 如果没有过滤配置，返回所有工具
        }
        const enabledToolNames = new Set(enabledTools.map(tool => `${tool.category}_${tool.name}`));
        return this.toolsList.filter(tool => enabledToolNames.has(tool.name));
    }
    async executeToolCall(toolName, args) {
        const parts = toolName.split('_');
        const category = parts[0];
        const toolMethodName = parts.slice(1).join('_');
        // Discovery tools are handled by MCPServer directly.
        if (category === 'server' && (toolMethodName === 'search_tools' ||
            toolMethodName === 'list_tool_categories' ||
            toolMethodName === 'get_tool_detail')) {
            return await this.executeDiscoveryToolCall(toolMethodName, args);
        }
        // Enforce exposure policy: only currently exposed tools are callable.
        if (!this.isToolExposed(toolName)) {
            throw new Error(`Tool ${toolName} is disabled or not exposed in current profile`);
        }
        if (this.tools[category]) {
            return await this.tools[category].execute(toolMethodName, args);
        }
        throw new Error(`Tool ${toolName} not found`);
    }
    getClients() {
        return Array.from(this.sessions.values()).map(session => ({
            id: session.id,
            lastActivity: session.lastActivity,
            userAgent: session.userAgent
        }));
    }
    getAvailableTools() {
        return this.toolsList;
    }
    isToolExposed(toolName) {
        return this.toolsList.some(tool => tool.name === toolName);
    }
    getAllToolDefinitions() {
        const allTools = [];
        for (const [category, toolSet] of Object.entries(this.tools)) {
            const tools = toolSet.getTools();
            for (const tool of tools) {
                allTools.push({
                    name: `${category}_${tool.name}`,
                    description: tool.description,
                    inputSchema: tool.inputSchema
                });
            }
        }
        return allTools;
    }
    async executeDiscoveryToolCall(toolMethodName, args) {
        switch (toolMethodName) {
            case 'search_tools':
                return this.searchTools(args);
            case 'list_tool_categories':
                return this.listToolCategories(args);
            case 'get_tool_detail':
                return this.getToolDetail(args);
            default:
                throw new Error(`Unknown discovery tool: ${toolMethodName}`);
        }
    }
    searchTools(args) {
        const keywordRaw = typeof (args === null || args === void 0 ? void 0 : args.keyword) === 'string' ? args.keyword : '';
        const keyword = keywordRaw.trim().toLowerCase();
        if (!keyword) {
            return {
                success: false,
                error: 'keyword is required'
            };
        }
        const categoryFilter = typeof (args === null || args === void 0 ? void 0 : args.category) === 'string' ? args.category.trim() : '';
        const includeDisabled = (args === null || args === void 0 ? void 0 : args.includeDisabled) !== false;
        const limit = Math.min(Math.max(Number(args === null || args === void 0 ? void 0 : args.limit) || 10, 1), 50);
        const enabledToolNames = new Set(this.toolsList.map(tool => tool.name));
        const scored = this.getAllToolDefinitions()
            .map(tool => {
            const fullName = tool.name;
            const category = fullName.split('_')[0];
            const toolName = fullName.split('_').slice(1).join('_');
            const enabled = enabledToolNames.has(fullName);
            const score = this.calculateToolMatchScore(keyword, category, toolName, tool.description);
            return {
                name: fullName,
                category,
                toolName,
                description: tool.description,
                enabled,
                score
            };
        })
            .filter(item => item.score > 0)
            .filter(item => {
            if (categoryFilter && item.category !== categoryFilter) {
                return false;
            }
            if (!includeDisabled && !item.enabled) {
                return false;
            }
            return true;
        })
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
        return {
            success: true,
            data: {
                keyword: keywordRaw,
                category: categoryFilter || null,
                includeDisabled,
                totalMatches: scored.length,
                results: scored
            }
        };
    }
    calculateToolMatchScore(keyword, category, toolName, description) {
        const fullName = `${category}_${toolName}`.toLowerCase();
        const descriptionLower = (description || '').toLowerCase();
        const tokens = keyword.split(/[\s_-]+/).filter(Boolean);
        let score = 0;
        if (fullName === keyword)
            score += 120;
        if (toolName.toLowerCase() === keyword)
            score += 100;
        if (category.toLowerCase() === keyword)
            score += 80;
        if (fullName.startsWith(keyword))
            score += 70;
        if (toolName.toLowerCase().includes(keyword))
            score += 60;
        if (descriptionLower.includes(keyword))
            score += 35;
        for (const token of tokens) {
            if (toolName.toLowerCase().includes(token))
                score += 12;
            if (descriptionLower.includes(token))
                score += 6;
            if (category.toLowerCase() === token)
                score += 10;
        }
        return score;
    }
    listToolCategories(_args) {
        const enabledToolNames = new Set(this.toolsList.map(tool => tool.name));
        const categories = new Map();
        for (const tool of this.getAllToolDefinitions()) {
            const category = tool.name.split('_')[0];
            const current = categories.get(category) || {
                category,
                totalTools: 0,
                enabledTools: 0
            };
            current.totalTools += 1;
            if (enabledToolNames.has(tool.name)) {
                current.enabledTools += 1;
            }
            categories.set(category, current);
        }
        return {
            success: true,
            data: {
                categories: Array.from(categories.values()).sort((a, b) => a.category.localeCompare(b.category))
            }
        };
    }
    getToolDetail(args) {
        const toolName = typeof (args === null || args === void 0 ? void 0 : args.name) === 'string' ? args.name.trim() : '';
        if (!toolName) {
            return {
                success: false,
                error: 'name is required'
            };
        }
        const allTools = this.getAllToolDefinitions();
        const tool = allTools.find(item => item.name === toolName);
        if (!tool) {
            return {
                success: false,
                error: `Tool ${toolName} not found`
            };
        }
        const category = tool.name.split('_')[0];
        const method = tool.name.split('_').slice(1).join('_');
        return {
            success: true,
            data: {
                name: tool.name,
                category,
                toolName: method,
                enabled: this.isToolExposed(tool.name),
                description: tool.description,
                inputSchema: tool.inputSchema,
                sampleParams: this.generateSampleParams(tool.inputSchema),
                apiPath: `/api/${category}/${method}`
            }
        };
    }
    updateEnabledTools(enabledTools) {
        console.log(`[MCPServer] Updating enabled tools: ${enabledTools.length} tools`);
        this.enabledTools = enabledTools;
        this.setupTools(); // 重新设置工具列表
    }
    getSettings() {
        return this.settings;
    }
    setCommonResponseHeaders(res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Mcp-Session-Id, Last-Event-ID');
        res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    }
    async handleHttpRequest(req, res) {
        const parsedUrl = url.parse(req.url || '', true);
        const pathname = parsedUrl.pathname;
        this.setCommonResponseHeaders(res);
        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }
        try {
            if (pathname === '/mcp' && req.method === 'GET') {
                await this.handleMCPStreamRequest(req, res);
            }
            else if (pathname === '/mcp' && req.method === 'POST') {
                await this.handleMCPRequest(req, res);
            }
            else if (pathname === '/health' && req.method === 'GET') {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(200);
                res.end(JSON.stringify({
                    status: 'ok',
                    tools: this.toolsList.length,
                    sessions: this.sessions.size,
                    streams: this.streamConnections.size
                }));
            }
            else if ((pathname === null || pathname === void 0 ? void 0 : pathname.startsWith('/api/')) && req.method === 'POST') {
                await this.handleSimpleAPIRequest(req, res, pathname);
            }
            else if (pathname === '/api/tools' && req.method === 'GET') {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(200);
                res.end(JSON.stringify({ tools: this.getSimplifiedToolsList() }));
            }
            else {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Not found' }));
            }
        }
        catch (error) {
            console.error('[MCPServer][transport] HTTP request error:', error);
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }
    async handleMCPStreamRequest(req, res) {
        const session = this.resolveSession(req, true);
        if (!session) {
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to create MCP session for stream connection' }));
            return;
        }
        res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
            'Mcp-Session-Id': session.id
        });
        if (typeof res.flushHeaders === 'function') {
            res.flushHeaders();
        }
        this.registerStreamConnection(session.id, req, res);
        this.writeSSEComment(res, 'stream-open');
        console.log(`[MCPServer][transport] SSE stream connected: session=${session.id}`);
    }
    registerStreamConnection(sessionId, req, res) {
        let connections = this.streamConnections.get(sessionId);
        if (!connections) {
            connections = new Set();
            this.streamConnections.set(sessionId, connections);
        }
        connections.add(res);
        const keepAliveTimer = setInterval(() => {
            if (res.writableEnded || res.destroyed) {
                this.unregisterStreamConnection(sessionId, res);
                return;
            }
            this.writeSSEComment(res, 'keep-alive');
        }, this.sseKeepAliveMs);
        this.streamHeartbeatTimers.set(res, keepAliveTimer);
        const cleanup = () => this.unregisterStreamConnection(sessionId, res);
        req.on('close', cleanup);
        req.on('aborted', cleanup);
        res.on('close', cleanup);
        res.on('error', cleanup);
    }
    unregisterStreamConnection(sessionId, res) {
        const heartbeat = this.streamHeartbeatTimers.get(res);
        if (heartbeat) {
            clearInterval(heartbeat);
            this.streamHeartbeatTimers.delete(res);
        }
        const connections = this.streamConnections.get(sessionId);
        if (!connections) {
            return;
        }
        connections.delete(res);
        if (connections.size === 0) {
            this.streamConnections.delete(sessionId);
        }
    }
    writeSSEComment(res, text) {
        if (res.writableEnded || res.destroyed) {
            return;
        }
        res.write(`: ${text}\n\n`);
    }
    writeSSEEvent(res, event, payload) {
        if (res.writableEnded || res.destroyed) {
            return;
        }
        const serialized = JSON.stringify(payload);
        res.write(`event: ${event}\n`);
        for (const line of serialized.split('\n')) {
            res.write(`data: ${line}\n`);
        }
        res.write('\n');
    }
    pushMessageToSession(sessionId, message) {
        const connections = this.streamConnections.get(sessionId);
        if (!connections || connections.size === 0) {
            return;
        }
        for (const connection of Array.from(connections.values())) {
            if (connection.writableEnded || connection.destroyed) {
                this.unregisterStreamConnection(sessionId, connection);
                continue;
            }
            this.writeSSEEvent(connection, 'message', message);
        }
    }
    hasActiveStreamConnection(sessionId) {
        const connections = this.streamConnections.get(sessionId);
        return !!connections && connections.size > 0;
    }
    requestAcceptsEventStream(req) {
        const accept = this.getHeaderValue(req, 'accept');
        return !!accept && accept.toLowerCase().includes('text/event-stream');
    }
    getHeaderValue(req, headerName) {
        if (!req) {
            return undefined;
        }
        const rawValue = req.headers[headerName.toLowerCase()];
        if (Array.isArray(rawValue)) {
            return rawValue[0];
        }
        if (typeof rawValue === 'string') {
            return rawValue;
        }
        return undefined;
    }
    createSession(sessionId, req) {
        const now = new Date();
        const session = {
            id: sessionId,
            createdAt: now,
            lastActivity: now,
            initialized: false,
            userAgent: this.getHeaderValue(req, 'user-agent')
        };
        this.sessions.set(sessionId, session);
        console.log(`[MCPServer][transport] Created MCP session: ${sessionId}`);
        return session;
    }
    touchSession(session, req) {
        session.lastActivity = new Date();
        const userAgent = this.getHeaderValue(req, 'user-agent');
        if (userAgent) {
            session.userAgent = userAgent;
        }
    }
    resolveSession(req, createIfMissing) {
        const providedSessionId = this.getHeaderValue(req, 'mcp-session-id');
        if (providedSessionId) {
            const existingSession = this.sessions.get(providedSessionId);
            if (existingSession) {
                this.touchSession(existingSession, req);
                return existingSession;
            }
            if (createIfMissing) {
                console.warn(`[MCPServer][transport] Unknown session id '${providedSessionId}', recreating session`);
                return this.createSession(providedSessionId, req);
            }
            return null;
        }
        if (!createIfMissing) {
            return null;
        }
        return this.createSession((0, uuid_1.v4)(), req);
    }
    async readRequestBody(req) {
        return await new Promise((resolve, reject) => {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', () => resolve(body));
            req.on('error', reject);
        });
    }
    parseMCPPayload(body) {
        let parsedBody;
        try {
            parsedBody = JSON.parse(body);
        }
        catch (parseError) {
            const fixedBody = this.fixCommonJsonIssues(body);
            try {
                parsedBody = JSON.parse(fixedBody);
                console.log('[MCPServer] Fixed JSON parsing issue');
            }
            catch (_a) {
                throw new Error(`JSON parsing failed: ${parseError.message}. Original body: ${body.substring(0, 500)}...`);
            }
        }
        if (Array.isArray(parsedBody)) {
            if (parsedBody.length === 0) {
                throw new Error('Batch request cannot be empty');
            }
            return {
                messages: parsedBody,
                isBatch: true
            };
        }
        if (!parsedBody || typeof parsedBody !== 'object') {
            throw new Error('Request body must be a JSON-RPC object or array');
        }
        return {
            messages: [parsedBody],
            isBatch: false
        };
    }
    async handleMCPRequest(req, res) {
        try {
            const rawBody = await this.readRequestBody(req);
            const { messages, isBatch } = this.parseMCPPayload(rawBody);
            const hasInitializeRequest = messages.some(message => message && typeof message === 'object' && message.method === 'initialize');
            const hasSessionHeader = !!this.getHeaderValue(req, 'mcp-session-id');
            const session = this.resolveSession(req, hasInitializeRequest || hasSessionHeader);
            if (hasInitializeRequest && session) {
                res.setHeader('Mcp-Session-Id', session.id);
            }
            const responses = [];
            for (const message of messages) {
                const response = await this.handleMessage(message, session, req);
                if (response) {
                    responses.push(response);
                }
            }
            if (responses.length === 0) {
                res.writeHead(204);
                res.end();
                return;
            }
            if (session && this.requestAcceptsEventStream(req) && this.hasActiveStreamConnection(session.id)) {
                for (const response of responses) {
                    this.pushMessageToSession(session.id, response);
                }
                res.writeHead(202);
                res.end();
                return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(200);
            res.end(JSON.stringify(isBatch ? responses : responses[0]));
        }
        catch (error) {
            console.error('[MCPServer][transport] Error handling MCP request:', error);
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(400);
            res.end(JSON.stringify(this.createErrorResponse(null, -32700, `Parse error: ${error.message}`)));
        }
    }
    async handleMessage(message, session, req) {
        var _a;
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            return this.createErrorResponse(null, -32600, 'Invalid Request: message must be an object');
        }
        const hasId = Object.prototype.hasOwnProperty.call(message, 'id');
        const isNotification = !hasId;
        const requestId = hasId ? ((_a = message.id) !== null && _a !== void 0 ? _a : null) : null;
        const method = message.method;
        const params = message.params;
        if (session) {
            this.touchSession(session, req);
        }
        if (message.jsonrpc !== undefined && message.jsonrpc !== '2.0') {
            if (isNotification) {
                console.warn(`[MCPServer][protocol] Ignored invalid notification with jsonrpc='${String(message.jsonrpc)}'`);
                return null;
            }
            return this.createErrorResponse(requestId, -32600, 'Invalid Request: jsonrpc must be "2.0"');
        }
        if (typeof method !== 'string' || method.length === 0) {
            if (isNotification) {
                console.warn('[MCPServer][protocol] Ignored invalid notification without method');
                return null;
            }
            return this.createErrorResponse(requestId, -32600, 'Invalid Request: method must be a non-empty string');
        }
        if (method === 'initialized' || method.startsWith('notifications/')) {
            this.handleNotification(method, params, session, req);
            return null;
        }
        try {
            let result;
            switch (method) {
                case 'initialize': {
                    if (session) {
                        const protocolVersion = params && typeof params === 'object' ? params.protocolVersion : undefined;
                        if (typeof protocolVersion === 'string' && protocolVersion.length > 0) {
                            session.protocolVersion = protocolVersion;
                        }
                    }
                    result = {
                        protocolVersion: this.mcpProtocolVersion,
                        capabilities: {
                            tools: {}
                        },
                        serverInfo: {
                            name: 'cocos-mcp-server',
                            version: this.mcpServerVersion
                        }
                    };
                    break;
                }
                case 'tools/list':
                    result = { tools: this.getAvailableTools() };
                    break;
                case 'tools/call': {
                    if (!params || typeof params !== 'object') {
                        return isNotification ? null : this.createErrorResponse(requestId, -32602, 'Invalid params: expected an object');
                    }
                    const toolName = params.name;
                    const args = Object.prototype.hasOwnProperty.call(params, 'arguments') ? params.arguments : {};
                    if (typeof toolName !== 'string' || toolName.length === 0) {
                        return isNotification ? null : this.createErrorResponse(requestId, -32602, 'Invalid params: name is required');
                    }
                    const toolResult = await this.executeToolCall(toolName, args || {});
                    result = { content: [{ type: 'text', text: JSON.stringify(toolResult) }] };
                    break;
                }
                default:
                    if (isNotification) {
                        console.log(`[MCPServer][protocol] Ignored unknown notification method: ${method}`);
                        return null;
                    }
                    return this.createErrorResponse(requestId, -32601, `Method not found: ${method}`);
            }
            if (isNotification) {
                return null;
            }
            return this.createResultResponse(requestId, result);
        }
        catch (error) {
            const messageText = error instanceof Error ? error.message : String(error);
            if (isNotification) {
                console.warn(`[MCPServer][protocol] Notification '${method}' failed: ${messageText}`);
                return null;
            }
            return this.createErrorResponse(requestId, -32603, messageText);
        }
    }
    handleNotification(method, params, session, req) {
        switch (method) {
            case 'initialized':
            case 'notifications/initialized':
                if (session) {
                    session.initialized = true;
                    this.touchSession(session, req);
                }
                console.log(`[MCPServer][protocol] Received initialized notification for session ${(session === null || session === void 0 ? void 0 : session.id) || 'unknown'}`);
                return;
            case 'notifications/cancelled':
                console.log(`[MCPServer][protocol] Received cancelled notification: ${JSON.stringify(params || {})}`);
                return;
            default:
                console.log(`[MCPServer][protocol] Ignored notification: ${method}`);
                return;
        }
    }
    createResultResponse(id, result) {
        return {
            jsonrpc: '2.0',
            id,
            result
        };
    }
    createErrorResponse(id, code, message) {
        return {
            jsonrpc: '2.0',
            id,
            error: {
                code,
                message
            }
        };
    }
    fixCommonJsonIssues(jsonStr) {
        let fixed = jsonStr;
        // Fix common escape character issues
        fixed = fixed
            // Fix unescaped quotes in strings
            .replace(/([^\\])"([^"]*[^\\])"([^,}\]:])/g, '$1\\"$2\\"$3')
            // Fix unescaped backslashes
            .replace(/([^\\])\\([^"\\\/bfnrt])/g, '$1\\\\$2')
            // Fix trailing commas
            .replace(/,(\s*[}\]])/g, '$1')
            // Fix single quotes (should be double quotes)
            .replace(/'/g, '"')
            // Fix common control characters
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
        return fixed;
    }
    stop() {
        if (this.httpServer) {
            this.httpServer.close();
            this.httpServer = null;
            console.log('[MCPServer] HTTP server stopped');
        }
        for (const timer of this.streamHeartbeatTimers.values()) {
            clearInterval(timer);
        }
        this.streamHeartbeatTimers.clear();
        for (const [sessionId, connections] of this.streamConnections.entries()) {
            for (const connection of connections.values()) {
                if (!connection.writableEnded) {
                    connection.end();
                }
            }
            this.streamConnections.delete(sessionId);
        }
        this.streamConnections.clear();
        this.sessions.clear();
    }
    getStatus() {
        return {
            running: !!this.httpServer,
            port: this.settings.port,
            clients: this.sessions.size
        };
    }
    async handleSimpleAPIRequest(req, res, pathname) {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                // Extract tool name from path like /api/node/set_position
                const pathParts = pathname.split('/').filter(p => p);
                if (pathParts.length < 3) {
                    res.setHeader('Content-Type', 'application/json');
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid API path. Use /api/{category}/{tool_name}' }));
                    return;
                }
                const category = pathParts[1];
                const toolName = pathParts[2];
                const fullToolName = `${category}_${toolName}`;
                // Parse parameters with enhanced error handling
                let params;
                try {
                    params = body ? JSON.parse(body) : {};
                }
                catch (parseError) {
                    // Try to fix JSON issues
                    const fixedBody = this.fixCommonJsonIssues(body);
                    try {
                        params = JSON.parse(fixedBody);
                        console.log('[MCPServer] Fixed API JSON parsing issue');
                    }
                    catch (_a) {
                        res.setHeader('Content-Type', 'application/json');
                        res.writeHead(400);
                        res.end(JSON.stringify({
                            error: 'Invalid JSON in request body',
                            details: parseError.message,
                            receivedBody: body.substring(0, 200)
                        }));
                        return;
                    }
                }
                // Execute tool
                const result = await this.executeToolCall(fullToolName, params);
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(200);
                res.end(JSON.stringify({
                    success: true,
                    tool: fullToolName,
                    result: result
                }));
            }
            catch (error) {
                console.error('Simple API error:', error);
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(500);
                res.end(JSON.stringify({
                    success: false,
                    error: error.message,
                    tool: pathname
                }));
            }
        });
    }
    getSimplifiedToolsList() {
        return this.toolsList.map(tool => {
            const parts = tool.name.split('_');
            const category = parts[0];
            const toolName = parts.slice(1).join('_');
            return {
                name: tool.name,
                category: category,
                toolName: toolName,
                description: tool.description,
                apiPath: `/api/${category}/${toolName}`,
                curlExample: this.generateCurlExample(category, toolName, tool.inputSchema)
            };
        });
    }
    generateCurlExample(category, toolName, schema) {
        // Generate sample parameters based on schema
        const sampleParams = this.generateSampleParams(schema);
        const jsonString = JSON.stringify(sampleParams, null, 2);
        return `curl -X POST http://127.0.0.1:8585/api/${category}/${toolName} \\
  -H "Content-Type: application/json" \\
  -d '${jsonString}'`;
    }
    generateSampleParams(schema) {
        if (!schema || !schema.properties)
            return {};
        const sample = {};
        for (const [key, prop] of Object.entries(schema.properties)) {
            const propSchema = prop;
            switch (propSchema.type) {
                case 'string':
                    sample[key] = propSchema.default || 'example_string';
                    break;
                case 'number':
                    sample[key] = propSchema.default || 42;
                    break;
                case 'boolean':
                    sample[key] = propSchema.default || true;
                    break;
                case 'object':
                    sample[key] = propSchema.default || { x: 0, y: 0, z: 0 };
                    break;
                default:
                    sample[key] = 'example_value';
            }
        }
        return sample;
    }
    updateSettings(settings) {
        this.settings = settings;
        if (this.httpServer) {
            this.stop();
            this.start();
        }
    }
}
exports.MCPServer = MCPServer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWNwLXNlcnZlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL3NvdXJjZS9tY3Atc2VydmVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDJDQUE2QjtBQUM3Qix5Q0FBMkI7QUFDM0IsK0JBQW9DO0FBV3BDLHFEQUFpRDtBQUNqRCxtREFBK0M7QUFDL0MsNkRBQXlEO0FBQ3pELHVEQUFtRDtBQUNuRCx5REFBcUQ7QUFDckQscURBQWlEO0FBQ2pELGlFQUE2RDtBQUM3RCx1REFBbUQ7QUFDbkQsNkRBQXlEO0FBQ3pELHVFQUFrRTtBQUNsRSwrREFBMEQ7QUFDMUQseUVBQW9FO0FBQ3BFLHVFQUFrRTtBQUNsRSwrREFBMkQ7QUFPM0QsTUFBYSxTQUFTO0lBY2xCLFlBQVksUUFBMkI7UUFidEIsdUJBQWtCLEdBQUcsWUFBWSxDQUFDO1FBQ2xDLHFCQUFnQixHQUFHLE9BQU8sQ0FBQztRQUMzQixtQkFBYyxHQUFHLEtBQUssQ0FBQztRQUdoQyxlQUFVLEdBQXVCLElBQUksQ0FBQztRQUN0QyxVQUFLLEdBQXdCLEVBQUUsQ0FBQztRQUNoQyxjQUFTLEdBQXFCLEVBQUUsQ0FBQztRQUNqQyxpQkFBWSxHQUFVLEVBQUUsQ0FBQyxDQUFDLFlBQVk7UUFDdEMsYUFBUSxHQUE0QixJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQzlDLHNCQUFpQixHQUEwQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBQ3JFLDBCQUFxQixHQUE2QyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBR2hGLElBQUksQ0FBQyxRQUFRLEdBQUcsUUFBUSxDQUFDO1FBQ3pCLElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztJQUMzQixDQUFDO0lBRU8sZUFBZTtRQUNuQixJQUFJLENBQUM7WUFDRCxPQUFPLENBQUMsR0FBRyxDQUFDLG1DQUFtQyxDQUFDLENBQUM7WUFDakQsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsSUFBSSx3QkFBVSxFQUFFLENBQUM7WUFDcEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsSUFBSSxzQkFBUyxFQUFFLENBQUM7WUFDbEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsSUFBSSxnQ0FBYyxFQUFFLENBQUM7WUFDNUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsSUFBSSwwQkFBVyxFQUFFLENBQUM7WUFDdEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsSUFBSSw0QkFBWSxFQUFFLENBQUM7WUFDeEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEdBQUcsSUFBSSx3QkFBVSxFQUFFLENBQUM7WUFDcEMsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLEdBQUcsSUFBSSxvQ0FBZ0IsRUFBRSxDQUFDO1lBQ2hELElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxHQUFHLElBQUksMEJBQVcsRUFBRSxDQUFDO1lBQ3RDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLElBQUksZ0NBQWMsRUFBRSxDQUFDO1lBQzVDLElBQUksQ0FBQyxLQUFLLENBQUMsYUFBYSxHQUFHLElBQUkseUNBQWtCLEVBQUUsQ0FBQztZQUNwRCxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsR0FBRyxJQUFJLGlDQUFjLEVBQUUsQ0FBQztZQUM1QyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsR0FBRyxJQUFJLDJDQUFtQixFQUFFLENBQUM7WUFDdEQsSUFBSSxDQUFDLEtBQUssQ0FBQyxhQUFhLEdBQUcsSUFBSSx5Q0FBa0IsRUFBRSxDQUFDO1lBQ3BELElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxHQUFHLElBQUksa0NBQWUsRUFBRSxDQUFDO1lBQzlDLE9BQU8sQ0FBQyxHQUFHLENBQUMsNENBQTRDLENBQUMsQ0FBQztRQUM5RCxDQUFDO1FBQUMsT0FBTyxLQUFLLEVBQUUsQ0FBQztZQUNiLE9BQU8sQ0FBQyxLQUFLLENBQUMsdUNBQXVDLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFDOUQsTUFBTSxLQUFLLENBQUM7UUFDaEIsQ0FBQztJQUNMLENBQUM7SUFFTSxLQUFLLENBQUMsS0FBSztRQUNkLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2xCLE9BQU8sQ0FBQyxHQUFHLENBQUMsdUNBQXVDLENBQUMsQ0FBQztZQUNyRCxPQUFPO1FBQ1gsQ0FBQztRQUVELElBQUksQ0FBQztZQUNELE9BQU8sQ0FBQyxHQUFHLENBQUMsNENBQTRDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxLQUFLLENBQUMsQ0FBQztZQUNqRixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBRXZFLE1BQU0sSUFBSSxPQUFPLENBQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7Z0JBQ3hDLElBQUksQ0FBQyxVQUFXLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRSxHQUFHLEVBQUU7b0JBQzFELE9BQU8sQ0FBQyxHQUFHLENBQUMsc0VBQXNFLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztvQkFDeEcsT0FBTyxDQUFDLEdBQUcsQ0FBQyw4Q0FBOEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLFNBQVMsQ0FBQyxDQUFDO29CQUN2RixPQUFPLENBQUMsR0FBRyxDQUFDLDhDQUE4QyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksTUFBTSxDQUFDLENBQUM7b0JBQ3BGLE9BQU8sRUFBRSxDQUFDO2dCQUNkLENBQUMsQ0FBQyxDQUFDO2dCQUNILElBQUksQ0FBQyxVQUFXLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLEdBQVEsRUFBRSxFQUFFO29CQUN0QyxPQUFPLENBQUMsS0FBSyxDQUFDLHVDQUF1QyxFQUFFLEdBQUcsQ0FBQyxDQUFDO29CQUM1RCxJQUFJLEdBQUcsQ0FBQyxJQUFJLEtBQUssWUFBWSxFQUFFLENBQUM7d0JBQzVCLE9BQU8sQ0FBQyxLQUFLLENBQUMsb0JBQW9CLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSx5REFBeUQsQ0FBQyxDQUFDO29CQUNuSCxDQUFDO29CQUNELE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDaEIsQ0FBQyxDQUFDLENBQUM7WUFDUCxDQUFDLENBQUMsQ0FBQztZQUVILElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNsQixPQUFPLENBQUMsR0FBRyxDQUFDLG9EQUFvRCxDQUFDLENBQUM7UUFDdEUsQ0FBQztRQUFDLE9BQU8sS0FBSyxFQUFFLENBQUM7WUFDYixPQUFPLENBQUMsS0FBSyxDQUFDLHVDQUF1QyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzlELE1BQU0sS0FBSyxDQUFDO1FBQ2hCLENBQUM7SUFDTCxDQUFDO0lBRU8sVUFBVTtRQUNkLElBQUksQ0FBQyxTQUFTLEdBQUcsRUFBRSxDQUFDO1FBRXBCLG9CQUFvQjtRQUNwQixJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksSUFBSSxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUN2RCxLQUFLLE1BQU0sQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLElBQUksTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDM0QsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUNqQyxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRSxDQUFDO29CQUN2QixJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQzt3QkFDaEIsSUFBSSxFQUFFLEdBQUcsUUFBUSxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUU7d0JBQ2hDLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVzt3QkFDN0IsV0FBVyxFQUFFLElBQUksQ0FBQyxXQUFXO3FCQUNoQyxDQUFDLENBQUM7Z0JBQ1AsQ0FBQztZQUNMLENBQUM7UUFDTCxDQUFDO2FBQU0sQ0FBQztZQUNKLGNBQWM7WUFDZCxNQUFNLGdCQUFnQixHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFFakcsS0FBSyxNQUFNLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUM7Z0JBQzNELE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztnQkFDakMsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FBQztvQkFDdkIsTUFBTSxRQUFRLEdBQUcsR0FBRyxRQUFRLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO29CQUM1QyxJQUFJLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO3dCQUNqQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQzs0QkFDaEIsSUFBSSxFQUFFLFFBQVE7NEJBQ2QsV0FBVyxFQUFFLElBQUksQ0FBQyxXQUFXOzRCQUM3QixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7eUJBQ2hDLENBQUMsQ0FBQztvQkFDUCxDQUFDO2dCQUNMLENBQUM7WUFDTCxDQUFDO1FBQ0wsQ0FBQztRQUVELE9BQU8sQ0FBQyxHQUFHLENBQUMsNEJBQTRCLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxrQkFBa0IsQ0FBQyxDQUFDO0lBQ3JGLENBQUM7SUFFTSxnQkFBZ0IsQ0FBQyxZQUFtQjtRQUN2QyxJQUFJLENBQUMsWUFBWSxJQUFJLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDN0MsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsa0JBQWtCO1FBQzdDLENBQUM7UUFFRCxNQUFNLGdCQUFnQixHQUFHLElBQUksR0FBRyxDQUFDLFlBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxHQUFHLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM1RixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQzFFLENBQUM7SUFFTSxLQUFLLENBQUMsZUFBZSxDQUFDLFFBQWdCLEVBQUUsSUFBUztRQUNwRCxNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ2xDLE1BQU0sUUFBUSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUMxQixNQUFNLGNBQWMsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUVoRCxxREFBcUQ7UUFDckQsSUFBSSxRQUFRLEtBQUssUUFBUSxJQUFJLENBQ3pCLGNBQWMsS0FBSyxjQUFjO1lBQ2pDLGNBQWMsS0FBSyxzQkFBc0I7WUFDekMsY0FBYyxLQUFLLGlCQUFpQixDQUN2QyxFQUFFLENBQUM7WUFDQSxPQUFPLE1BQU0sSUFBSSxDQUFDLHdCQUF3QixDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNyRSxDQUFDO1FBRUQsc0VBQXNFO1FBQ3RFLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDaEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxRQUFRLFFBQVEsZ0RBQWdELENBQUMsQ0FBQztRQUN0RixDQUFDO1FBRUQsSUFBSSxJQUFJLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7WUFDdkIsT0FBTyxNQUFNLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNwRSxDQUFDO1FBRUQsTUFBTSxJQUFJLEtBQUssQ0FBQyxRQUFRLFFBQVEsWUFBWSxDQUFDLENBQUM7SUFDbEQsQ0FBQztJQUVNLFVBQVU7UUFDYixPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDdEQsRUFBRSxFQUFFLE9BQU8sQ0FBQyxFQUFFO1lBQ2QsWUFBWSxFQUFFLE9BQU8sQ0FBQyxZQUFZO1lBQ2xDLFNBQVMsRUFBRSxPQUFPLENBQUMsU0FBUztTQUMvQixDQUFDLENBQUMsQ0FBQztJQUNSLENBQUM7SUFFTSxpQkFBaUI7UUFDcEIsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQzFCLENBQUM7SUFFTyxhQUFhLENBQUMsUUFBZ0I7UUFDbEMsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssUUFBUSxDQUFDLENBQUM7SUFDL0QsQ0FBQztJQUVPLHFCQUFxQjtRQUN6QixNQUFNLFFBQVEsR0FBcUIsRUFBRSxDQUFDO1FBRXRDLEtBQUssTUFBTSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDO1lBQzNELE1BQU0sS0FBSyxHQUFHLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUNqQyxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssRUFBRSxDQUFDO2dCQUN2QixRQUFRLENBQUMsSUFBSSxDQUFDO29CQUNWLElBQUksRUFBRSxHQUFHLFFBQVEsSUFBSSxJQUFJLENBQUMsSUFBSSxFQUFFO29CQUNoQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7b0JBQzdCLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVztpQkFDaEMsQ0FBQyxDQUFDO1lBQ1AsQ0FBQztRQUNMLENBQUM7UUFFRCxPQUFPLFFBQVEsQ0FBQztJQUNwQixDQUFDO0lBRU8sS0FBSyxDQUFDLHdCQUF3QixDQUFDLGNBQXNCLEVBQUUsSUFBUztRQUNwRSxRQUFRLGNBQWMsRUFBRSxDQUFDO1lBQ3JCLEtBQUssY0FBYztnQkFDZixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDbEMsS0FBSyxzQkFBc0I7Z0JBQ3ZCLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ3pDLEtBQUssaUJBQWlCO2dCQUNsQixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDcEM7Z0JBQ0ksTUFBTSxJQUFJLEtBQUssQ0FBQywyQkFBMkIsY0FBYyxFQUFFLENBQUMsQ0FBQztRQUNyRSxDQUFDO0lBQ0wsQ0FBQztJQUVPLFdBQVcsQ0FBQyxJQUFTO1FBQ3pCLE1BQU0sVUFBVSxHQUFHLE9BQU8sQ0FBQSxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsT0FBTyxDQUFBLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDekUsTUFBTSxPQUFPLEdBQUcsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQ2hELElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNYLE9BQU87Z0JBQ0gsT0FBTyxFQUFFLEtBQUs7Z0JBQ2QsS0FBSyxFQUFFLHFCQUFxQjthQUMvQixDQUFDO1FBQ04sQ0FBQztRQUVELE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQSxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsUUFBUSxDQUFBLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDdEYsTUFBTSxlQUFlLEdBQUcsQ0FBQSxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsZUFBZSxNQUFLLEtBQUssQ0FBQztRQUN4RCxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElBQUksYUFBSixJQUFJLHVCQUFKLElBQUksQ0FBRSxLQUFLLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFDbkUsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRXhFLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsRUFBRTthQUN0QyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7WUFDUixNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQzNCLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDeEMsTUFBTSxRQUFRLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3hELE1BQU0sT0FBTyxHQUFHLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMvQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsdUJBQXVCLENBQUMsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBRTFGLE9BQU87Z0JBQ0gsSUFBSSxFQUFFLFFBQVE7Z0JBQ2QsUUFBUTtnQkFDUixRQUFRO2dCQUNSLFdBQVcsRUFBRSxJQUFJLENBQUMsV0FBVztnQkFDN0IsT0FBTztnQkFDUCxLQUFLO2FBQ1IsQ0FBQztRQUNOLENBQUMsQ0FBQzthQUNELE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDO2FBQzlCLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUNYLElBQUksY0FBYyxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssY0FBYyxFQUFFLENBQUM7Z0JBQ3JELE9BQU8sS0FBSyxDQUFDO1lBQ2pCLENBQUM7WUFDRCxJQUFJLENBQUMsZUFBZSxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUNwQyxPQUFPLEtBQUssQ0FBQztZQUNqQixDQUFDO1lBQ0QsT0FBTyxJQUFJLENBQUM7UUFDaEIsQ0FBQyxDQUFDO2FBQ0QsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDO2FBQ2pDLEtBQUssQ0FBQyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFckIsT0FBTztZQUNILE9BQU8sRUFBRSxJQUFJO1lBQ2IsSUFBSSxFQUFFO2dCQUNGLE9BQU8sRUFBRSxVQUFVO2dCQUNuQixRQUFRLEVBQUUsY0FBYyxJQUFJLElBQUk7Z0JBQ2hDLGVBQWU7Z0JBQ2YsWUFBWSxFQUFFLE1BQU0sQ0FBQyxNQUFNO2dCQUMzQixPQUFPLEVBQUUsTUFBTTthQUNsQjtTQUNKLENBQUM7SUFDTixDQUFDO0lBRU8sdUJBQXVCLENBQUMsT0FBZSxFQUFFLFFBQWdCLEVBQUUsUUFBZ0IsRUFBRSxXQUFtQjtRQUNwRyxNQUFNLFFBQVEsR0FBRyxHQUFHLFFBQVEsSUFBSSxRQUFRLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUN6RCxNQUFNLGdCQUFnQixHQUFHLENBQUMsV0FBVyxJQUFJLEVBQUUsQ0FBQyxDQUFDLFdBQVcsRUFBRSxDQUFDO1FBQzNELE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3hELElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztRQUVkLElBQUksUUFBUSxLQUFLLE9BQU87WUFBRSxLQUFLLElBQUksR0FBRyxDQUFDO1FBQ3ZDLElBQUksUUFBUSxDQUFDLFdBQVcsRUFBRSxLQUFLLE9BQU87WUFBRSxLQUFLLElBQUksR0FBRyxDQUFDO1FBQ3JELElBQUksUUFBUSxDQUFDLFdBQVcsRUFBRSxLQUFLLE9BQU87WUFBRSxLQUFLLElBQUksRUFBRSxDQUFDO1FBQ3BELElBQUksUUFBUSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUM7WUFBRSxLQUFLLElBQUksRUFBRSxDQUFDO1FBQzlDLElBQUksUUFBUSxDQUFDLFdBQVcsRUFBRSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUM7WUFBRSxLQUFLLElBQUksRUFBRSxDQUFDO1FBQzFELElBQUksZ0JBQWdCLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQztZQUFFLEtBQUssSUFBSSxFQUFFLENBQUM7UUFFcEQsS0FBSyxNQUFNLEtBQUssSUFBSSxNQUFNLEVBQUUsQ0FBQztZQUN6QixJQUFJLFFBQVEsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO2dCQUFFLEtBQUssSUFBSSxFQUFFLENBQUM7WUFDeEQsSUFBSSxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO2dCQUFFLEtBQUssSUFBSSxDQUFDLENBQUM7WUFDakQsSUFBSSxRQUFRLENBQUMsV0FBVyxFQUFFLEtBQUssS0FBSztnQkFBRSxLQUFLLElBQUksRUFBRSxDQUFDO1FBQ3RELENBQUM7UUFFRCxPQUFPLEtBQUssQ0FBQztJQUNqQixDQUFDO0lBRU8sa0JBQWtCLENBQUMsS0FBVTtRQUNqQyxNQUFNLGdCQUFnQixHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDeEUsTUFBTSxVQUFVLEdBQUcsSUFBSSxHQUFHLEVBQTBFLENBQUM7UUFFckcsS0FBSyxNQUFNLElBQUksSUFBSSxJQUFJLENBQUMscUJBQXFCLEVBQUUsRUFBRSxDQUFDO1lBQzlDLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3pDLE1BQU0sT0FBTyxHQUFHLFVBQVUsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUk7Z0JBQ3hDLFFBQVE7Z0JBQ1IsVUFBVSxFQUFFLENBQUM7Z0JBQ2IsWUFBWSxFQUFFLENBQUM7YUFDbEIsQ0FBQztZQUNGLE9BQU8sQ0FBQyxVQUFVLElBQUksQ0FBQyxDQUFDO1lBQ3hCLElBQUksZ0JBQWdCLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUNsQyxPQUFPLENBQUMsWUFBWSxJQUFJLENBQUMsQ0FBQztZQUM5QixDQUFDO1lBQ0QsVUFBVSxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7UUFDdEMsQ0FBQztRQUVELE9BQU87WUFDSCxPQUFPLEVBQUUsSUFBSTtZQUNiLElBQUksRUFBRTtnQkFDRixVQUFVLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDbkc7U0FDSixDQUFDO0lBQ04sQ0FBQztJQUVPLGFBQWEsQ0FBQyxJQUFTO1FBQzNCLE1BQU0sUUFBUSxHQUFHLE9BQU8sQ0FBQSxJQUFJLGFBQUosSUFBSSx1QkFBSixJQUFJLENBQUUsSUFBSSxDQUFBLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDeEUsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ1osT0FBTztnQkFDSCxPQUFPLEVBQUUsS0FBSztnQkFDZCxLQUFLLEVBQUUsa0JBQWtCO2FBQzVCLENBQUM7UUFDTixDQUFDO1FBRUQsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDOUMsTUFBTSxJQUFJLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssUUFBUSxDQUFDLENBQUM7UUFDM0QsSUFBSSxDQUFDLElBQUksRUFBRSxDQUFDO1lBQ1IsT0FBTztnQkFDSCxPQUFPLEVBQUUsS0FBSztnQkFDZCxLQUFLLEVBQUUsUUFBUSxRQUFRLFlBQVk7YUFDdEMsQ0FBQztRQUNOLENBQUM7UUFFRCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUN6QyxNQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBRXZELE9BQU87WUFDSCxPQUFPLEVBQUUsSUFBSTtZQUNiLElBQUksRUFBRTtnQkFDRixJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7Z0JBQ2YsUUFBUTtnQkFDUixRQUFRLEVBQUUsTUFBTTtnQkFDaEIsT0FBTyxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztnQkFDdEMsV0FBVyxFQUFFLElBQUksQ0FBQyxXQUFXO2dCQUM3QixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7Z0JBQzdCLFlBQVksRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztnQkFDekQsT0FBTyxFQUFFLFFBQVEsUUFBUSxJQUFJLE1BQU0sRUFBRTthQUN4QztTQUNKLENBQUM7SUFDTixDQUFDO0lBRU0sa0JBQWtCLENBQUMsWUFBbUI7UUFDekMsT0FBTyxDQUFDLEdBQUcsQ0FBQyx1Q0FBdUMsWUFBWSxDQUFDLE1BQU0sUUFBUSxDQUFDLENBQUM7UUFDaEYsSUFBSSxDQUFDLFlBQVksR0FBRyxZQUFZLENBQUM7UUFDakMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUMsV0FBVztJQUNsQyxDQUFDO0lBRU0sV0FBVztRQUNkLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQztJQUN6QixDQUFDO0lBRU8sd0JBQXdCLENBQUMsR0FBd0I7UUFDckQsR0FBRyxDQUFDLFNBQVMsQ0FBQyw2QkFBNkIsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUNsRCxHQUFHLENBQUMsU0FBUyxDQUFDLDhCQUE4QixFQUFFLG9CQUFvQixDQUFDLENBQUM7UUFDcEUsR0FBRyxDQUFDLFNBQVMsQ0FBQyw4QkFBOEIsRUFBRSxvRUFBb0UsQ0FBQyxDQUFDO1FBQ3BILEdBQUcsQ0FBQyxTQUFTLENBQUMsK0JBQStCLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztJQUNyRSxDQUFDO0lBRU8sS0FBSyxDQUFDLGlCQUFpQixDQUFDLEdBQXlCLEVBQUUsR0FBd0I7UUFDL0UsTUFBTSxTQUFTLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNqRCxNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsUUFBUSxDQUFDO1FBRXBDLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUVuQyxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssU0FBUyxFQUFFLENBQUM7WUFDM0IsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNuQixHQUFHLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDVixPQUFPO1FBQ1gsQ0FBQztRQUVELElBQUksQ0FBQztZQUNELElBQUksUUFBUSxLQUFLLE1BQU0sSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLEtBQUssRUFBRSxDQUFDO2dCQUM5QyxNQUFNLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDaEQsQ0FBQztpQkFBTSxJQUFJLFFBQVEsS0FBSyxNQUFNLElBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxNQUFNLEVBQUUsQ0FBQztnQkFDdEQsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQzFDLENBQUM7aUJBQU0sSUFBSSxRQUFRLEtBQUssU0FBUyxJQUFJLEdBQUcsQ0FBQyxNQUFNLEtBQUssS0FBSyxFQUFFLENBQUM7Z0JBQ3hELEdBQUcsQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFLGtCQUFrQixDQUFDLENBQUM7Z0JBQ2xELEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ25CLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztvQkFDbkIsTUFBTSxFQUFFLElBQUk7b0JBQ1osS0FBSyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTTtvQkFDNUIsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSTtvQkFDNUIsT0FBTyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJO2lCQUN2QyxDQUFDLENBQUMsQ0FBQztZQUNSLENBQUM7aUJBQU0sSUFBSSxDQUFBLFFBQVEsYUFBUixRQUFRLHVCQUFSLFFBQVEsQ0FBRSxVQUFVLENBQUMsT0FBTyxDQUFDLEtBQUksR0FBRyxDQUFDLE1BQU0sS0FBSyxNQUFNLEVBQUUsQ0FBQztnQkFDaEUsTUFBTSxJQUFJLENBQUMsc0JBQXNCLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUMxRCxDQUFDO2lCQUFNLElBQUksUUFBUSxLQUFLLFlBQVksSUFBSSxHQUFHLENBQUMsTUFBTSxLQUFLLEtBQUssRUFBRSxDQUFDO2dCQUMzRCxHQUFHLENBQUMsU0FBUyxDQUFDLGNBQWMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO2dCQUNsRCxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNuQixHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLHNCQUFzQixFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDdEUsQ0FBQztpQkFBTSxDQUFDO2dCQUNKLEdBQUcsQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFLGtCQUFrQixDQUFDLENBQUM7Z0JBQ2xELEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ25CLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEtBQUssRUFBRSxXQUFXLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDcEQsQ0FBQztRQUNMLENBQUM7UUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1lBQ2IsT0FBTyxDQUFDLEtBQUssQ0FBQyw0Q0FBNEMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQUNuRSxHQUFHLENBQUMsU0FBUyxDQUFDLGNBQWMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO1lBQ2xELEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDbkIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsS0FBSyxFQUFFLHVCQUF1QixFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ2hFLENBQUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLHNCQUFzQixDQUFDLEdBQXlCLEVBQUUsR0FBd0I7UUFDcEYsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ1gsR0FBRyxDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUNsRCxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ25CLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLEtBQUssRUFBRSxvREFBb0QsRUFBRSxDQUFDLENBQUMsQ0FBQztZQUN6RixPQUFPO1FBQ1gsQ0FBQztRQUVELEdBQUcsQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFO1lBQ2YsY0FBYyxFQUFFLGtDQUFrQztZQUNsRCxlQUFlLEVBQUUsd0JBQXdCO1lBQ3pDLFVBQVUsRUFBRSxZQUFZO1lBQ3hCLG1CQUFtQixFQUFFLElBQUk7WUFDekIsZ0JBQWdCLEVBQUUsT0FBTyxDQUFDLEVBQUU7U0FDL0IsQ0FBQyxDQUFDO1FBRUgsSUFBSSxPQUFRLEdBQVcsQ0FBQyxZQUFZLEtBQUssVUFBVSxFQUFFLENBQUM7WUFDakQsR0FBVyxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQ2hDLENBQUM7UUFFRCxJQUFJLENBQUMsd0JBQXdCLENBQUMsT0FBTyxDQUFDLEVBQUUsRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDcEQsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFDekMsT0FBTyxDQUFDLEdBQUcsQ0FBQyx3REFBd0QsT0FBTyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDdEYsQ0FBQztJQUVPLHdCQUF3QixDQUFDLFNBQWlCLEVBQUUsR0FBeUIsRUFBRSxHQUF3QjtRQUNuRyxJQUFJLFdBQVcsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ3hELElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNmLFdBQVcsR0FBRyxJQUFJLEdBQUcsRUFBdUIsQ0FBQztZQUM3QyxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLFNBQVMsRUFBRSxXQUFXLENBQUMsQ0FBQztRQUN2RCxDQUFDO1FBQ0QsV0FBVyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUVyQixNQUFNLGNBQWMsR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFO1lBQ3BDLElBQUksR0FBRyxDQUFDLGFBQWEsSUFBSSxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ3JDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQ2hELE9BQU87WUFDWCxDQUFDO1lBQ0QsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDNUMsQ0FBQyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUN4QixJQUFJLENBQUMscUJBQXFCLENBQUMsR0FBRyxDQUFDLEdBQUcsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUVwRCxNQUFNLE9BQU8sR0FBRyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsMEJBQTBCLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3RFLEdBQUcsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3pCLEdBQUcsQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQzNCLEdBQUcsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3pCLEdBQUcsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzdCLENBQUM7SUFFTywwQkFBMEIsQ0FBQyxTQUFpQixFQUFFLEdBQXdCO1FBQzFFLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDdEQsSUFBSSxTQUFTLEVBQUUsQ0FBQztZQUNaLGFBQWEsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN6QixJQUFJLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQzNDLENBQUM7UUFFRCxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzFELElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUNmLE9BQU87UUFDWCxDQUFDO1FBRUQsV0FBVyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQztRQUN4QixJQUFJLFdBQVcsQ0FBQyxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUM7WUFDekIsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM3QyxDQUFDO0lBQ0wsQ0FBQztJQUVPLGVBQWUsQ0FBQyxHQUF3QixFQUFFLElBQVk7UUFDMUQsSUFBSSxHQUFHLENBQUMsYUFBYSxJQUFJLEdBQUcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUNyQyxPQUFPO1FBQ1gsQ0FBQztRQUNELEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxJQUFJLE1BQU0sQ0FBQyxDQUFDO0lBQy9CLENBQUM7SUFFTyxhQUFhLENBQUMsR0FBd0IsRUFBRSxLQUFhLEVBQUUsT0FBWTtRQUN2RSxJQUFJLEdBQUcsQ0FBQyxhQUFhLElBQUksR0FBRyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3JDLE9BQU87UUFDWCxDQUFDO1FBRUQsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUMzQyxHQUFHLENBQUMsS0FBSyxDQUFDLFVBQVUsS0FBSyxJQUFJLENBQUMsQ0FBQztRQUMvQixLQUFLLE1BQU0sSUFBSSxJQUFJLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUN4QyxHQUFHLENBQUMsS0FBSyxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsQ0FBQztRQUNqQyxDQUFDO1FBQ0QsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUNwQixDQUFDO0lBRU8sb0JBQW9CLENBQUMsU0FBaUIsRUFBRSxPQUEyQjtRQUN2RSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQzFELElBQUksQ0FBQyxXQUFXLElBQUksV0FBVyxDQUFDLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUN6QyxPQUFPO1FBQ1gsQ0FBQztRQUVELEtBQUssTUFBTSxVQUFVLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDO1lBQ3hELElBQUksVUFBVSxDQUFDLGFBQWEsSUFBSSxVQUFVLENBQUMsU0FBUyxFQUFFLENBQUM7Z0JBQ25ELElBQUksQ0FBQywwQkFBMEIsQ0FBQyxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUM7Z0JBQ3ZELFNBQVM7WUFDYixDQUFDO1lBQ0QsSUFBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLEVBQUUsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3ZELENBQUM7SUFDTCxDQUFDO0lBRU8seUJBQXlCLENBQUMsU0FBaUI7UUFDL0MsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUMxRCxPQUFPLENBQUMsQ0FBQyxXQUFXLElBQUksV0FBVyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUM7SUFDakQsQ0FBQztJQUVPLHlCQUF5QixDQUFDLEdBQXlCO1FBQ3ZELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ2xELE9BQU8sQ0FBQyxDQUFDLE1BQU0sSUFBSSxNQUFNLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDLENBQUM7SUFDMUUsQ0FBQztJQUVPLGNBQWMsQ0FBQyxHQUFxQyxFQUFFLFVBQWtCO1FBQzVFLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztZQUNQLE9BQU8sU0FBUyxDQUFDO1FBQ3JCLENBQUM7UUFFRCxNQUFNLFFBQVEsR0FBRyxHQUFHLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBQ3ZELElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDO1lBQzFCLE9BQU8sUUFBUSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3ZCLENBQUM7UUFFRCxJQUFJLE9BQU8sUUFBUSxLQUFLLFFBQVEsRUFBRSxDQUFDO1lBQy9CLE9BQU8sUUFBUSxDQUFDO1FBQ3BCLENBQUM7UUFFRCxPQUFPLFNBQVMsQ0FBQztJQUNyQixDQUFDO0lBRU8sYUFBYSxDQUFDLFNBQWlCLEVBQUUsR0FBMEI7UUFDL0QsTUFBTSxHQUFHLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUN2QixNQUFNLE9BQU8sR0FBZTtZQUN4QixFQUFFLEVBQUUsU0FBUztZQUNiLFNBQVMsRUFBRSxHQUFHO1lBQ2QsWUFBWSxFQUFFLEdBQUc7WUFDakIsV0FBVyxFQUFFLEtBQUs7WUFDbEIsU0FBUyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLFlBQVksQ0FBQztTQUNwRCxDQUFDO1FBRUYsSUFBSSxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3RDLE9BQU8sQ0FBQyxHQUFHLENBQUMsK0NBQStDLFNBQVMsRUFBRSxDQUFDLENBQUM7UUFDeEUsT0FBTyxPQUFPLENBQUM7SUFDbkIsQ0FBQztJQUVPLFlBQVksQ0FBQyxPQUFtQixFQUFFLEdBQTBCO1FBQ2hFLE9BQU8sQ0FBQyxZQUFZLEdBQUcsSUFBSSxJQUFJLEVBQUUsQ0FBQztRQUNsQyxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUN6RCxJQUFJLFNBQVMsRUFBRSxDQUFDO1lBQ1osT0FBTyxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7UUFDbEMsQ0FBQztJQUNMLENBQUM7SUFFTyxjQUFjLENBQUMsR0FBeUIsRUFBRSxlQUF3QjtRQUN0RSxNQUFNLGlCQUFpQixHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFDckUsSUFBSSxpQkFBaUIsRUFBRSxDQUFDO1lBQ3BCLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDN0QsSUFBSSxlQUFlLEVBQUUsQ0FBQztnQkFDbEIsSUFBSSxDQUFDLFlBQVksQ0FBQyxlQUFlLEVBQUUsR0FBRyxDQUFDLENBQUM7Z0JBQ3hDLE9BQU8sZUFBZSxDQUFDO1lBQzNCLENBQUM7WUFFRCxJQUFJLGVBQWUsRUFBRSxDQUFDO2dCQUNsQixPQUFPLENBQUMsSUFBSSxDQUFDLDhDQUE4QyxpQkFBaUIsdUJBQXVCLENBQUMsQ0FBQztnQkFDckcsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLGlCQUFpQixFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ3RELENBQUM7WUFFRCxPQUFPLElBQUksQ0FBQztRQUNoQixDQUFDO1FBRUQsSUFBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBQ25CLE9BQU8sSUFBSSxDQUFDO1FBQ2hCLENBQUM7UUFFRCxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBQSxTQUFNLEdBQUUsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUM3QyxDQUFDO0lBRU8sS0FBSyxDQUFDLGVBQWUsQ0FBQyxHQUF5QjtRQUNuRCxPQUFPLE1BQU0sSUFBSSxPQUFPLENBQVMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDakQsSUFBSSxJQUFJLEdBQUcsRUFBRSxDQUFDO1lBQ2QsR0FBRyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRTtnQkFDckIsSUFBSSxJQUFJLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUM3QixDQUFDLENBQUMsQ0FBQztZQUNILEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ25DLEdBQUcsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzVCLENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVPLGVBQWUsQ0FBQyxJQUFZO1FBQ2hDLElBQUksVUFBbUIsQ0FBQztRQUN4QixJQUFJLENBQUM7WUFDRCxVQUFVLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsQyxDQUFDO1FBQUMsT0FBTyxVQUFlLEVBQUUsQ0FBQztZQUN2QixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDakQsSUFBSSxDQUFDO2dCQUNELFVBQVUsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxDQUFDO2dCQUNuQyxPQUFPLENBQUMsR0FBRyxDQUFDLHNDQUFzQyxDQUFDLENBQUM7WUFDeEQsQ0FBQztZQUFDLFdBQU0sQ0FBQztnQkFDTCxNQUFNLElBQUksS0FBSyxDQUFDLHdCQUF3QixVQUFVLENBQUMsT0FBTyxvQkFBb0IsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQy9HLENBQUM7UUFDTCxDQUFDO1FBRUQsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUM7WUFDNUIsSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRSxDQUFDO2dCQUMxQixNQUFNLElBQUksS0FBSyxDQUFDLCtCQUErQixDQUFDLENBQUM7WUFDckQsQ0FBQztZQUNELE9BQU87Z0JBQ0gsUUFBUSxFQUFFLFVBQWlDO2dCQUMzQyxPQUFPLEVBQUUsSUFBSTthQUNoQixDQUFDO1FBQ04sQ0FBQztRQUVELElBQUksQ0FBQyxVQUFVLElBQUksT0FBTyxVQUFVLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDaEQsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBaUQsQ0FBQyxDQUFDO1FBQ3ZFLENBQUM7UUFFRCxPQUFPO1lBQ0gsUUFBUSxFQUFFLENBQUMsVUFBK0IsQ0FBQztZQUMzQyxPQUFPLEVBQUUsS0FBSztTQUNqQixDQUFDO0lBQ04sQ0FBQztJQUVPLEtBQUssQ0FBQyxnQkFBZ0IsQ0FBQyxHQUF5QixFQUFFLEdBQXdCO1FBQzlFLElBQUksQ0FBQztZQUNELE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNoRCxNQUFNLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDNUQsTUFBTSxvQkFBb0IsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUMsT0FBTyxJQUFJLE9BQU8sT0FBTyxLQUFLLFFBQVEsSUFBSSxPQUFPLENBQUMsTUFBTSxLQUFLLFlBQVksQ0FBQyxDQUFDO1lBQ2pJLE1BQU0sZ0JBQWdCLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLGdCQUFnQixDQUFDLENBQUM7WUFFdEUsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLEVBQUUsb0JBQW9CLElBQUksZ0JBQWdCLENBQUMsQ0FBQztZQUNuRixJQUFJLG9CQUFvQixJQUFJLE9BQU8sRUFBRSxDQUFDO2dCQUNsQyxHQUFHLENBQUMsU0FBUyxDQUFDLGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztZQUNoRCxDQUFDO1lBRUQsTUFBTSxTQUFTLEdBQXlCLEVBQUUsQ0FBQztZQUMzQyxLQUFLLE1BQU0sT0FBTyxJQUFJLFFBQVEsRUFBRSxDQUFDO2dCQUM3QixNQUFNLFFBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDakUsSUFBSSxRQUFRLEVBQUUsQ0FBQztvQkFDWCxTQUFTLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2dCQUM3QixDQUFDO1lBQ0wsQ0FBQztZQUVELElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztnQkFDekIsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDbkIsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUNWLE9BQU87WUFDWCxDQUFDO1lBRUQsSUFBSSxPQUFPLElBQUksSUFBSSxDQUFDLHlCQUF5QixDQUFDLEdBQUcsQ0FBQyxJQUFJLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztnQkFDL0YsS0FBSyxNQUFNLFFBQVEsSUFBSSxTQUFTLEVBQUUsQ0FBQztvQkFDL0IsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE9BQU8sQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLENBQUM7Z0JBQ3BELENBQUM7Z0JBRUQsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDbkIsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDO2dCQUNWLE9BQU87WUFDWCxDQUFDO1lBRUQsR0FBRyxDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztZQUNsRCxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ25CLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoRSxDQUFDO1FBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztZQUNsQixPQUFPLENBQUMsS0FBSyxDQUFDLG9EQUFvRCxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQzNFLEdBQUcsQ0FBQyxTQUFTLENBQUMsY0FBYyxFQUFFLGtCQUFrQixDQUFDLENBQUM7WUFDbEQsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNuQixHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLElBQUksRUFBRSxDQUFDLEtBQUssRUFBRSxnQkFBZ0IsS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ3JHLENBQUM7SUFDTCxDQUFDO0lBRU8sS0FBSyxDQUFDLGFBQWEsQ0FDdkIsT0FBMEIsRUFDMUIsT0FBMEIsRUFDMUIsR0FBeUI7O1FBRXpCLElBQUksQ0FBQyxPQUFPLElBQUksT0FBTyxPQUFPLEtBQUssUUFBUSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNwRSxPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxLQUFLLEVBQUUsNENBQTRDLENBQUMsQ0FBQztRQUNoRyxDQUFDO1FBRUQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztRQUNsRSxNQUFNLGNBQWMsR0FBRyxDQUFDLEtBQUssQ0FBQztRQUM5QixNQUFNLFNBQVMsR0FBaUIsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLE1BQUEsT0FBTyxDQUFDLEVBQUUsbUNBQUksSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUNwRSxNQUFNLE1BQU0sR0FBRyxPQUFPLENBQUMsTUFBTSxDQUFDO1FBQzlCLE1BQU0sTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLENBQUM7UUFFOUIsSUFBSSxPQUFPLEVBQUUsQ0FBQztZQUNWLElBQUksQ0FBQyxZQUFZLENBQUMsT0FBTyxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQ3BDLENBQUM7UUFFRCxJQUFJLE9BQU8sQ0FBQyxPQUFPLEtBQUssU0FBUyxJQUFJLE9BQU8sQ0FBQyxPQUFPLEtBQUssS0FBSyxFQUFFLENBQUM7WUFDN0QsSUFBSSxjQUFjLEVBQUUsQ0FBQztnQkFDakIsT0FBTyxDQUFDLElBQUksQ0FBQyxvRUFBb0UsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQzdHLE9BQU8sSUFBSSxDQUFDO1lBQ2hCLENBQUM7WUFDRCxPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxLQUFLLEVBQUUsd0NBQXdDLENBQUMsQ0FBQztRQUNqRyxDQUFDO1FBRUQsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLElBQUksTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQztZQUNwRCxJQUFJLGNBQWMsRUFBRSxDQUFDO2dCQUNqQixPQUFPLENBQUMsSUFBSSxDQUFDLG1FQUFtRSxDQUFDLENBQUM7Z0JBQ2xGLE9BQU8sSUFBSSxDQUFDO1lBQ2hCLENBQUM7WUFDRCxPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxLQUFLLEVBQUUsb0RBQW9ELENBQUMsQ0FBQztRQUM3RyxDQUFDO1FBRUQsSUFBSSxNQUFNLEtBQUssYUFBYSxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsZ0JBQWdCLENBQUMsRUFBRSxDQUFDO1lBQ2xFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQztZQUN0RCxPQUFPLElBQUksQ0FBQztRQUNoQixDQUFDO1FBRUQsSUFBSSxDQUFDO1lBQ0QsSUFBSSxNQUFXLENBQUM7WUFFaEIsUUFBUSxNQUFNLEVBQUUsQ0FBQztnQkFDYixLQUFLLFlBQVksQ0FBQyxDQUFDLENBQUM7b0JBQ2hCLElBQUksT0FBTyxFQUFFLENBQUM7d0JBQ1YsTUFBTSxlQUFlLEdBQUcsTUFBTSxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO3dCQUNsRyxJQUFJLE9BQU8sZUFBZSxLQUFLLFFBQVEsSUFBSSxlQUFlLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDOzRCQUNwRSxPQUFPLENBQUMsZUFBZSxHQUFHLGVBQWUsQ0FBQzt3QkFDOUMsQ0FBQztvQkFDTCxDQUFDO29CQUVELE1BQU0sR0FBRzt3QkFDTCxlQUFlLEVBQUUsSUFBSSxDQUFDLGtCQUFrQjt3QkFDeEMsWUFBWSxFQUFFOzRCQUNWLEtBQUssRUFBRSxFQUFFO3lCQUNaO3dCQUNELFVBQVUsRUFBRTs0QkFDUixJQUFJLEVBQUUsa0JBQWtCOzRCQUN4QixPQUFPLEVBQUUsSUFBSSxDQUFDLGdCQUFnQjt5QkFDakM7cUJBQ0osQ0FBQztvQkFDRixNQUFNO2dCQUNWLENBQUM7Z0JBQ0QsS0FBSyxZQUFZO29CQUNiLE1BQU0sR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsaUJBQWlCLEVBQUUsRUFBRSxDQUFDO29CQUM3QyxNQUFNO2dCQUNWLEtBQUssWUFBWSxDQUFDLENBQUMsQ0FBQztvQkFDaEIsSUFBSSxDQUFDLE1BQU0sSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUUsQ0FBQzt3QkFDeEMsT0FBTyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxDQUFDLEtBQUssRUFBRSxvQ0FBb0MsQ0FBQyxDQUFDO29CQUNySCxDQUFDO29CQUVELE1BQU0sUUFBUSxHQUFJLE1BQWMsQ0FBQyxJQUFJLENBQUM7b0JBQ3RDLE1BQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFFLE1BQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztvQkFDeEcsSUFBSSxPQUFPLFFBQVEsS0FBSyxRQUFRLElBQUksUUFBUSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUUsQ0FBQzt3QkFDeEQsT0FBTyxjQUFjLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxDQUFDLEtBQUssRUFBRSxrQ0FBa0MsQ0FBQyxDQUFDO29CQUNuSCxDQUFDO29CQUVELE1BQU0sVUFBVSxHQUFHLE1BQU0sSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsSUFBSSxJQUFJLEVBQUUsQ0FBQyxDQUFDO29CQUNwRSxNQUFNLEdBQUcsRUFBRSxPQUFPLEVBQUUsQ0FBQyxFQUFFLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUM7b0JBQzNFLE1BQU07Z0JBQ1YsQ0FBQztnQkFDRDtvQkFDSSxJQUFJLGNBQWMsRUFBRSxDQUFDO3dCQUNqQixPQUFPLENBQUMsR0FBRyxDQUFDLDhEQUE4RCxNQUFNLEVBQUUsQ0FBQyxDQUFDO3dCQUNwRixPQUFPLElBQUksQ0FBQztvQkFDaEIsQ0FBQztvQkFDRCxPQUFPLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxLQUFLLEVBQUUscUJBQXFCLE1BQU0sRUFBRSxDQUFDLENBQUM7WUFDMUYsQ0FBQztZQUVELElBQUksY0FBYyxFQUFFLENBQUM7Z0JBQ2pCLE9BQU8sSUFBSSxDQUFDO1lBQ2hCLENBQUM7WUFFRCxPQUFPLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDeEQsQ0FBQztRQUFDLE9BQU8sS0FBVSxFQUFFLENBQUM7WUFDbEIsTUFBTSxXQUFXLEdBQUcsS0FBSyxZQUFZLEtBQUssQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBQzNFLElBQUksY0FBYyxFQUFFLENBQUM7Z0JBQ2pCLE9BQU8sQ0FBQyxJQUFJLENBQUMsdUNBQXVDLE1BQU0sYUFBYSxXQUFXLEVBQUUsQ0FBQyxDQUFDO2dCQUN0RixPQUFPLElBQUksQ0FBQztZQUNoQixDQUFDO1lBQ0QsT0FBTyxJQUFJLENBQUMsbUJBQW1CLENBQUMsU0FBUyxFQUFFLENBQUMsS0FBSyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ3BFLENBQUM7SUFDTCxDQUFDO0lBRU8sa0JBQWtCLENBQ3RCLE1BQWMsRUFDZCxNQUFXLEVBQ1gsT0FBMEIsRUFDMUIsR0FBeUI7UUFFekIsUUFBUSxNQUFNLEVBQUUsQ0FBQztZQUNiLEtBQUssYUFBYSxDQUFDO1lBQ25CLEtBQUssMkJBQTJCO2dCQUM1QixJQUFJLE9BQU8sRUFBRSxDQUFDO29CQUNWLE9BQU8sQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO29CQUMzQixJQUFJLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxHQUFHLENBQUMsQ0FBQztnQkFDcEMsQ0FBQztnQkFDRCxPQUFPLENBQUMsR0FBRyxDQUFDLHVFQUF1RSxDQUFBLE9BQU8sYUFBUCxPQUFPLHVCQUFQLE9BQU8sQ0FBRSxFQUFFLEtBQUksU0FBUyxFQUFFLENBQUMsQ0FBQztnQkFDL0csT0FBTztZQUNYLEtBQUsseUJBQXlCO2dCQUMxQixPQUFPLENBQUMsR0FBRyxDQUFDLDBEQUEwRCxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sSUFBSSxFQUFFLENBQUMsRUFBRSxDQUFDLENBQUM7Z0JBQ3RHLE9BQU87WUFDWDtnQkFDSSxPQUFPLENBQUMsR0FBRyxDQUFDLCtDQUErQyxNQUFNLEVBQUUsQ0FBQyxDQUFDO2dCQUNyRSxPQUFPO1FBQ2YsQ0FBQztJQUNMLENBQUM7SUFFTyxvQkFBb0IsQ0FBQyxFQUFnQixFQUFFLE1BQVc7UUFDdEQsT0FBTztZQUNILE9BQU8sRUFBRSxLQUFLO1lBQ2QsRUFBRTtZQUNGLE1BQU07U0FDVCxDQUFDO0lBQ04sQ0FBQztJQUVPLG1CQUFtQixDQUFDLEVBQWdCLEVBQUUsSUFBWSxFQUFFLE9BQWU7UUFDdkUsT0FBTztZQUNILE9BQU8sRUFBRSxLQUFLO1lBQ2QsRUFBRTtZQUNGLEtBQUssRUFBRTtnQkFDSCxJQUFJO2dCQUNKLE9BQU87YUFDVjtTQUNKLENBQUM7SUFDTixDQUFDO0lBRU8sbUJBQW1CLENBQUMsT0FBZTtRQUN2QyxJQUFJLEtBQUssR0FBRyxPQUFPLENBQUM7UUFFcEIscUNBQXFDO1FBQ3JDLEtBQUssR0FBRyxLQUFLO1lBQ1Qsa0NBQWtDO2FBQ2pDLE9BQU8sQ0FBQyxrQ0FBa0MsRUFBRSxjQUFjLENBQUM7WUFDNUQsNEJBQTRCO2FBQzNCLE9BQU8sQ0FBQywyQkFBMkIsRUFBRSxVQUFVLENBQUM7WUFDakQsc0JBQXNCO2FBQ3JCLE9BQU8sQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDO1lBQzlCLDhDQUE4QzthQUM3QyxPQUFPLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztZQUNuQixnQ0FBZ0M7YUFDL0IsT0FBTyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUM7YUFDckIsT0FBTyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUM7YUFDckIsT0FBTyxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQztRQUUzQixPQUFPLEtBQUssQ0FBQztJQUNqQixDQUFDO0lBRU0sSUFBSTtRQUNQLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1lBQ2xCLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDeEIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7WUFDdkIsT0FBTyxDQUFDLEdBQUcsQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO1FBQ25ELENBQUM7UUFFRCxLQUFLLE1BQU0sS0FBSyxJQUFJLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDO1lBQ3RELGFBQWEsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN6QixDQUFDO1FBQ0QsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEtBQUssRUFBRSxDQUFDO1FBRW5DLEtBQUssTUFBTSxDQUFDLFNBQVMsRUFBRSxXQUFXLENBQUMsSUFBSSxJQUFJLENBQUMsaUJBQWlCLENBQUMsT0FBTyxFQUFFLEVBQUUsQ0FBQztZQUN0RSxLQUFLLE1BQU0sVUFBVSxJQUFJLFdBQVcsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUFDO2dCQUM1QyxJQUFJLENBQUMsVUFBVSxDQUFDLGFBQWEsRUFBRSxDQUFDO29CQUM1QixVQUFVLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQ3JCLENBQUM7WUFDTCxDQUFDO1lBQ0QsSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM3QyxDQUFDO1FBQ0QsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEtBQUssRUFBRSxDQUFDO1FBQy9CLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDMUIsQ0FBQztJQUVNLFNBQVM7UUFDWixPQUFPO1lBQ0gsT0FBTyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVTtZQUMxQixJQUFJLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJO1lBQ3hCLE9BQU8sRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUk7U0FDOUIsQ0FBQztJQUNOLENBQUM7SUFFTyxLQUFLLENBQUMsc0JBQXNCLENBQUMsR0FBeUIsRUFBRSxHQUF3QixFQUFFLFFBQWdCO1FBQ3RHLElBQUksSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUVkLEdBQUcsQ0FBQyxFQUFFLENBQUMsTUFBTSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUU7WUFDckIsSUFBSSxJQUFJLEtBQUssQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUM3QixDQUFDLENBQUMsQ0FBQztRQUVILEdBQUcsQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLEtBQUssSUFBSSxFQUFFO1lBQ3JCLElBQUksQ0FBQztnQkFDRCwwREFBMEQ7Z0JBQzFELE1BQU0sU0FBUyxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3JELElBQUksU0FBUyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsQ0FBQztvQkFDdkIsR0FBRyxDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztvQkFDbEQsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztvQkFDbkIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsS0FBSyxFQUFFLG1EQUFtRCxFQUFFLENBQUMsQ0FBQyxDQUFDO29CQUN4RixPQUFPO2dCQUNYLENBQUM7Z0JBRUQsTUFBTSxRQUFRLEdBQUcsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUM5QixNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQzlCLE1BQU0sWUFBWSxHQUFHLEdBQUcsUUFBUSxJQUFJLFFBQVEsRUFBRSxDQUFDO2dCQUUvQyxnREFBZ0Q7Z0JBQ2hELElBQUksTUFBTSxDQUFDO2dCQUNYLElBQUksQ0FBQztvQkFDRCxNQUFNLEdBQUcsSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7Z0JBQzFDLENBQUM7Z0JBQUMsT0FBTyxVQUFlLEVBQUUsQ0FBQztvQkFDdkIseUJBQXlCO29CQUN6QixNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSSxDQUFDLENBQUM7b0JBQ2pELElBQUksQ0FBQzt3QkFDRCxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsQ0FBQzt3QkFDL0IsT0FBTyxDQUFDLEdBQUcsQ0FBQywwQ0FBMEMsQ0FBQyxDQUFDO29CQUM1RCxDQUFDO29CQUFDLFdBQU0sQ0FBQzt3QkFDTCxHQUFHLENBQUMsU0FBUyxDQUFDLGNBQWMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO3dCQUNsRCxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDO3dCQUNuQixHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7NEJBQ25CLEtBQUssRUFBRSw4QkFBOEI7NEJBQ3JDLE9BQU8sRUFBRSxVQUFVLENBQUMsT0FBTzs0QkFDM0IsWUFBWSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQzt5QkFDdkMsQ0FBQyxDQUFDLENBQUM7d0JBQ0osT0FBTztvQkFDWCxDQUFDO2dCQUNMLENBQUM7Z0JBRUQsZUFBZTtnQkFDZixNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLE1BQU0sQ0FBQyxDQUFDO2dCQUVoRSxHQUFHLENBQUMsU0FBUyxDQUFDLGNBQWMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDO2dCQUNsRCxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNuQixHQUFHLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUM7b0JBQ25CLE9BQU8sRUFBRSxJQUFJO29CQUNiLElBQUksRUFBRSxZQUFZO29CQUNsQixNQUFNLEVBQUUsTUFBTTtpQkFDakIsQ0FBQyxDQUFDLENBQUM7WUFDUixDQUFDO1lBQUMsT0FBTyxLQUFVLEVBQUUsQ0FBQztnQkFDbEIsT0FBTyxDQUFDLEtBQUssQ0FBQyxtQkFBbUIsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDMUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxjQUFjLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztnQkFDbEQsR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDbkIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDO29CQUNuQixPQUFPLEVBQUUsS0FBSztvQkFDZCxLQUFLLEVBQUUsS0FBSyxDQUFDLE9BQU87b0JBQ3BCLElBQUksRUFBRSxRQUFRO2lCQUNqQixDQUFDLENBQUMsQ0FBQztZQUNSLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFTyxzQkFBc0I7UUFDMUIsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUM3QixNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUNuQyxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDMUIsTUFBTSxRQUFRLEdBQUcsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFFMUMsT0FBTztnQkFDSCxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUk7Z0JBQ2YsUUFBUSxFQUFFLFFBQVE7Z0JBQ2xCLFFBQVEsRUFBRSxRQUFRO2dCQUNsQixXQUFXLEVBQUUsSUFBSSxDQUFDLFdBQVc7Z0JBQzdCLE9BQU8sRUFBRSxRQUFRLFFBQVEsSUFBSSxRQUFRLEVBQUU7Z0JBQ3ZDLFdBQVcsRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsUUFBUSxFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDO2FBQzlFLENBQUM7UUFDTixDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7SUFFTyxtQkFBbUIsQ0FBQyxRQUFnQixFQUFFLFFBQWdCLEVBQUUsTUFBVztRQUN2RSw2Q0FBNkM7UUFDN0MsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3ZELE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsWUFBWSxFQUFFLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUV6RCxPQUFPLDBDQUEwQyxRQUFRLElBQUksUUFBUTs7UUFFckUsVUFBVSxHQUFHLENBQUM7SUFDbEIsQ0FBQztJQUVPLG9CQUFvQixDQUFDLE1BQVc7UUFDcEMsSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxVQUFVO1lBQUUsT0FBTyxFQUFFLENBQUM7UUFFN0MsTUFBTSxNQUFNLEdBQVEsRUFBRSxDQUFDO1FBQ3ZCLEtBQUssTUFBTSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsSUFBSSxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFpQixDQUFDLEVBQUUsQ0FBQztZQUNqRSxNQUFNLFVBQVUsR0FBRyxJQUFXLENBQUM7WUFDL0IsUUFBUSxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7Z0JBQ3RCLEtBQUssUUFBUTtvQkFDVCxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsVUFBVSxDQUFDLE9BQU8sSUFBSSxnQkFBZ0IsQ0FBQztvQkFDckQsTUFBTTtnQkFDVixLQUFLLFFBQVE7b0JBQ1QsTUFBTSxDQUFDLEdBQUcsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDO29CQUN2QyxNQUFNO2dCQUNWLEtBQUssU0FBUztvQkFDVixNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsVUFBVSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUM7b0JBQ3pDLE1BQU07Z0JBQ1YsS0FBSyxRQUFRO29CQUNULE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxVQUFVLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztvQkFDekQsTUFBTTtnQkFDVjtvQkFDSSxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsZUFBZSxDQUFDO1lBQ3RDLENBQUM7UUFDTCxDQUFDO1FBQ0QsT0FBTyxNQUFNLENBQUM7SUFDbEIsQ0FBQztJQUVNLGNBQWMsQ0FBQyxRQUEyQjtRQUM3QyxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNsQixJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7WUFDWixJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDakIsQ0FBQztJQUNMLENBQUM7Q0FDSjtBQW4rQkQsOEJBbStCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGh0dHAgZnJvbSAnaHR0cCc7XG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcbmltcG9ydCB7IHY0IGFzIHV1aWR2NCB9IGZyb20gJ3V1aWQnO1xuaW1wb3J0IHtcbiAgICBNQ1BTZXJ2ZXJTZXR0aW5ncyxcbiAgICBTZXJ2ZXJTdGF0dXMsXG4gICAgTUNQQ2xpZW50LFxuICAgIFRvb2xEZWZpbml0aW9uLFxuICAgIE1DUFNlc3Npb24sXG4gICAgTUNQSlNPTlJQQ01lc3NhZ2UsXG4gICAgTUNQSlNPTlJQQ1Jlc3BvbnNlLFxuICAgIE1DUFJlcXVlc3RJZFxufSBmcm9tICcuL3R5cGVzJztcbmltcG9ydCB7IFNjZW5lVG9vbHMgfSBmcm9tICcuL3Rvb2xzL3NjZW5lLXRvb2xzJztcbmltcG9ydCB7IE5vZGVUb29scyB9IGZyb20gJy4vdG9vbHMvbm9kZS10b29scyc7XG5pbXBvcnQgeyBDb21wb25lbnRUb29scyB9IGZyb20gJy4vdG9vbHMvY29tcG9uZW50LXRvb2xzJztcbmltcG9ydCB7IFByZWZhYlRvb2xzIH0gZnJvbSAnLi90b29scy9wcmVmYWItdG9vbHMnO1xuaW1wb3J0IHsgUHJvamVjdFRvb2xzIH0gZnJvbSAnLi90b29scy9wcm9qZWN0LXRvb2xzJztcbmltcG9ydCB7IERlYnVnVG9vbHMgfSBmcm9tICcuL3Rvb2xzL2RlYnVnLXRvb2xzJztcbmltcG9ydCB7IFByZWZlcmVuY2VzVG9vbHMgfSBmcm9tICcuL3Rvb2xzL3ByZWZlcmVuY2VzLXRvb2xzJztcbmltcG9ydCB7IFNlcnZlclRvb2xzIH0gZnJvbSAnLi90b29scy9zZXJ2ZXItdG9vbHMnO1xuaW1wb3J0IHsgQnJvYWRjYXN0VG9vbHMgfSBmcm9tICcuL3Rvb2xzL2Jyb2FkY2FzdC10b29scyc7XG5pbXBvcnQgeyBTY2VuZUFkdmFuY2VkVG9vbHMgfSBmcm9tICcuL3Rvb2xzL3NjZW5lLWFkdmFuY2VkLXRvb2xzJztcbmltcG9ydCB7IFNjZW5lVmlld1Rvb2xzIH0gZnJvbSAnLi90b29scy9zY2VuZS12aWV3LXRvb2xzJztcbmltcG9ydCB7IFJlZmVyZW5jZUltYWdlVG9vbHMgfSBmcm9tICcuL3Rvb2xzL3JlZmVyZW5jZS1pbWFnZS10b29scyc7XG5pbXBvcnQgeyBBc3NldEFkdmFuY2VkVG9vbHMgfSBmcm9tICcuL3Rvb2xzL2Fzc2V0LWFkdmFuY2VkLXRvb2xzJztcbmltcG9ydCB7IFZhbGlkYXRpb25Ub29scyB9IGZyb20gJy4vdG9vbHMvdmFsaWRhdGlvbi10b29scyc7XG5cbnR5cGUgUGFyc2VkTUNQUGF5bG9hZCA9IHtcbiAgICBtZXNzYWdlczogTUNQSlNPTlJQQ01lc3NhZ2VbXTtcbiAgICBpc0JhdGNoOiBib29sZWFuO1xufTtcblxuZXhwb3J0IGNsYXNzIE1DUFNlcnZlciB7XG4gICAgcHJpdmF0ZSByZWFkb25seSBtY3BQcm90b2NvbFZlcnNpb24gPSAnMjAyNC0xMS0wNSc7XG4gICAgcHJpdmF0ZSByZWFkb25seSBtY3BTZXJ2ZXJWZXJzaW9uID0gJzEuMC4wJztcbiAgICBwcml2YXRlIHJlYWRvbmx5IHNzZUtlZXBBbGl2ZU1zID0gMTUwMDA7XG5cbiAgICBwcml2YXRlIHNldHRpbmdzOiBNQ1BTZXJ2ZXJTZXR0aW5ncztcbiAgICBwcml2YXRlIGh0dHBTZXJ2ZXI6IGh0dHAuU2VydmVyIHwgbnVsbCA9IG51bGw7XG4gICAgcHJpdmF0ZSB0b29sczogUmVjb3JkPHN0cmluZywgYW55PiA9IHt9O1xuICAgIHByaXZhdGUgdG9vbHNMaXN0OiBUb29sRGVmaW5pdGlvbltdID0gW107XG4gICAgcHJpdmF0ZSBlbmFibGVkVG9vbHM6IGFueVtdID0gW107IC8vIOWtmOWCqOWQr+eUqOeahOW3peWFt+WIl+ihqFxuICAgIHByaXZhdGUgc2Vzc2lvbnM6IE1hcDxzdHJpbmcsIE1DUFNlc3Npb24+ID0gbmV3IE1hcCgpO1xuICAgIHByaXZhdGUgc3RyZWFtQ29ubmVjdGlvbnM6IE1hcDxzdHJpbmcsIFNldDxodHRwLlNlcnZlclJlc3BvbnNlPj4gPSBuZXcgTWFwKCk7XG4gICAgcHJpdmF0ZSBzdHJlYW1IZWFydGJlYXRUaW1lcnM6IE1hcDxodHRwLlNlcnZlclJlc3BvbnNlLCBOb2RlSlMuVGltZW91dD4gPSBuZXcgTWFwKCk7XG5cbiAgICBjb25zdHJ1Y3RvcihzZXR0aW5nczogTUNQU2VydmVyU2V0dGluZ3MpIHtcbiAgICAgICAgdGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xuICAgICAgICB0aGlzLmluaXRpYWxpemVUb29scygpO1xuICAgIH1cblxuICAgIHByaXZhdGUgaW5pdGlhbGl6ZVRvb2xzKCk6IHZvaWQge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tNQ1BTZXJ2ZXJdIEluaXRpYWxpemluZyB0b29scy4uLicpO1xuICAgICAgICAgICAgdGhpcy50b29scy5zY2VuZSA9IG5ldyBTY2VuZVRvb2xzKCk7XG4gICAgICAgICAgICB0aGlzLnRvb2xzLm5vZGUgPSBuZXcgTm9kZVRvb2xzKCk7XG4gICAgICAgICAgICB0aGlzLnRvb2xzLmNvbXBvbmVudCA9IG5ldyBDb21wb25lbnRUb29scygpO1xuICAgICAgICAgICAgdGhpcy50b29scy5wcmVmYWIgPSBuZXcgUHJlZmFiVG9vbHMoKTtcbiAgICAgICAgICAgIHRoaXMudG9vbHMucHJvamVjdCA9IG5ldyBQcm9qZWN0VG9vbHMoKTtcbiAgICAgICAgICAgIHRoaXMudG9vbHMuZGVidWcgPSBuZXcgRGVidWdUb29scygpO1xuICAgICAgICAgICAgdGhpcy50b29scy5wcmVmZXJlbmNlcyA9IG5ldyBQcmVmZXJlbmNlc1Rvb2xzKCk7XG4gICAgICAgICAgICB0aGlzLnRvb2xzLnNlcnZlciA9IG5ldyBTZXJ2ZXJUb29scygpO1xuICAgICAgICAgICAgdGhpcy50b29scy5icm9hZGNhc3QgPSBuZXcgQnJvYWRjYXN0VG9vbHMoKTtcbiAgICAgICAgICAgIHRoaXMudG9vbHMuc2NlbmVBZHZhbmNlZCA9IG5ldyBTY2VuZUFkdmFuY2VkVG9vbHMoKTtcbiAgICAgICAgICAgIHRoaXMudG9vbHMuc2NlbmVWaWV3ID0gbmV3IFNjZW5lVmlld1Rvb2xzKCk7XG4gICAgICAgICAgICB0aGlzLnRvb2xzLnJlZmVyZW5jZUltYWdlID0gbmV3IFJlZmVyZW5jZUltYWdlVG9vbHMoKTtcbiAgICAgICAgICAgIHRoaXMudG9vbHMuYXNzZXRBZHZhbmNlZCA9IG5ldyBBc3NldEFkdmFuY2VkVG9vbHMoKTtcbiAgICAgICAgICAgIHRoaXMudG9vbHMudmFsaWRhdGlvbiA9IG5ldyBWYWxpZGF0aW9uVG9vbHMoKTtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbTUNQU2VydmVyXSBUb29scyBpbml0aWFsaXplZCBzdWNjZXNzZnVsbHknKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNQ1BTZXJ2ZXJdIEVycm9yIGluaXRpYWxpemluZyB0b29sczonLCBlcnJvcik7XG4gICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBzdGFydCgpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgaWYgKHRoaXMuaHR0cFNlcnZlcikge1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tNQ1BTZXJ2ZXJdIFNlcnZlciBpcyBhbHJlYWR5IHJ1bm5pbmcnKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhgW01DUFNlcnZlcl0gU3RhcnRpbmcgSFRUUCBzZXJ2ZXIgb24gcG9ydCAke3RoaXMuc2V0dGluZ3MucG9ydH0uLi5gKTtcbiAgICAgICAgICAgIHRoaXMuaHR0cFNlcnZlciA9IGh0dHAuY3JlYXRlU2VydmVyKHRoaXMuaGFuZGxlSHR0cFJlcXVlc3QuYmluZCh0aGlzKSk7XG5cbiAgICAgICAgICAgIGF3YWl0IG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmh0dHBTZXJ2ZXIhLmxpc3Rlbih0aGlzLnNldHRpbmdzLnBvcnQsICcxMjcuMC4wLjEnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSDinIUgSFRUUCBzZXJ2ZXIgc3RhcnRlZCBzdWNjZXNzZnVsbHkgb24gaHR0cDovLzEyNy4wLjAuMToke3RoaXMuc2V0dGluZ3MucG9ydH1gKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtNQ1BTZXJ2ZXJdIEhlYWx0aCBjaGVjazogaHR0cDovLzEyNy4wLjAuMToke3RoaXMuc2V0dGluZ3MucG9ydH0vaGVhbHRoYCk7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXSBNQ1AgZW5kcG9pbnQ6IGh0dHA6Ly8xMjcuMC4wLjE6JHt0aGlzLnNldHRpbmdzLnBvcnR9L21jcGApO1xuICAgICAgICAgICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgdGhpcy5odHRwU2VydmVyIS5vbignZXJyb3InLCAoZXJyOiBhbnkpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignW01DUFNlcnZlcl0g4p2MIEZhaWxlZCB0byBzdGFydCBzZXJ2ZXI6JywgZXJyKTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVyci5jb2RlID09PSAnRUFERFJJTlVTRScpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoYFtNQ1BTZXJ2ZXJdIFBvcnQgJHt0aGlzLnNldHRpbmdzLnBvcnR9IGlzIGFscmVhZHkgaW4gdXNlLiBQbGVhc2UgY2hhbmdlIHRoZSBwb3J0IGluIHNldHRpbmdzLmApO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIHRoaXMuc2V0dXBUb29scygpO1xuICAgICAgICAgICAgY29uc29sZS5sb2coJ1tNQ1BTZXJ2ZXJdIPCfmoAgTUNQIFNlcnZlciBpcyByZWFkeSBmb3IgY29ubmVjdGlvbnMnKTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNQ1BTZXJ2ZXJdIOKdjCBGYWlsZWQgdG8gc3RhcnQgc2VydmVyOicsIGVycm9yKTtcbiAgICAgICAgICAgIHRocm93IGVycm9yO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBzZXR1cFRvb2xzKCk6IHZvaWQge1xuICAgICAgICB0aGlzLnRvb2xzTGlzdCA9IFtdO1xuXG4gICAgICAgIC8vIOWmguaenOayoeacieWQr+eUqOW3peWFt+mFjee9ru+8jOi/lOWbnuaJgOacieW3peWFt1xuICAgICAgICBpZiAoIXRoaXMuZW5hYmxlZFRvb2xzIHx8IHRoaXMuZW5hYmxlZFRvb2xzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBbY2F0ZWdvcnksIHRvb2xTZXRdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMudG9vbHMpKSB7XG4gICAgICAgICAgICAgICAgY29uc3QgdG9vbHMgPSB0b29sU2V0LmdldFRvb2xzKCk7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCB0b29sIG9mIHRvb2xzKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMudG9vbHNMaXN0LnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogYCR7Y2F0ZWdvcnl9XyR7dG9vbC5uYW1lfWAsXG4gICAgICAgICAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogdG9vbC5kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICAgICAgICAgIGlucHV0U2NoZW1hOiB0b29sLmlucHV0U2NoZW1hXG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIOagueaNruWQr+eUqOeahOW3peWFt+mFjee9rui/h+a7pFxuICAgICAgICAgICAgY29uc3QgZW5hYmxlZFRvb2xOYW1lcyA9IG5ldyBTZXQodGhpcy5lbmFibGVkVG9vbHMubWFwKHRvb2wgPT4gYCR7dG9vbC5jYXRlZ29yeX1fJHt0b29sLm5hbWV9YCkpO1xuXG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtjYXRlZ29yeSwgdG9vbFNldF0gb2YgT2JqZWN0LmVudHJpZXModGhpcy50b29scykpIHtcbiAgICAgICAgICAgICAgICBjb25zdCB0b29scyA9IHRvb2xTZXQuZ2V0VG9vbHMoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHRvb2wgb2YgdG9vbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgdG9vbE5hbWUgPSBgJHtjYXRlZ29yeX1fJHt0b29sLm5hbWV9YDtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGVuYWJsZWRUb29sTmFtZXMuaGFzKHRvb2xOYW1lKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy50b29sc0xpc3QucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogdG9vbE5hbWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHRvb2wuZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHRvb2wuaW5wdXRTY2hlbWFcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgY29uc29sZS5sb2coYFtNQ1BTZXJ2ZXJdIFNldHVwIHRvb2xzOiAke3RoaXMudG9vbHNMaXN0Lmxlbmd0aH0gdG9vbHMgYXZhaWxhYmxlYCk7XG4gICAgfVxuXG4gICAgcHVibGljIGdldEZpbHRlcmVkVG9vbHMoZW5hYmxlZFRvb2xzOiBhbnlbXSk6IFRvb2xEZWZpbml0aW9uW10ge1xuICAgICAgICBpZiAoIWVuYWJsZWRUb29scyB8fCBlbmFibGVkVG9vbHMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy50b29sc0xpc3Q7IC8vIOWmguaenOayoeaciei/h+a7pOmFjee9ru+8jOi/lOWbnuaJgOacieW3peWFt1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgZW5hYmxlZFRvb2xOYW1lcyA9IG5ldyBTZXQoZW5hYmxlZFRvb2xzLm1hcCh0b29sID0+IGAke3Rvb2wuY2F0ZWdvcnl9XyR7dG9vbC5uYW1lfWApKTtcbiAgICAgICAgcmV0dXJuIHRoaXMudG9vbHNMaXN0LmZpbHRlcih0b29sID0+IGVuYWJsZWRUb29sTmFtZXMuaGFzKHRvb2wubmFtZSkpO1xuICAgIH1cblxuICAgIHB1YmxpYyBhc3luYyBleGVjdXRlVG9vbENhbGwodG9vbE5hbWU6IHN0cmluZywgYXJnczogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgY29uc3QgcGFydHMgPSB0b29sTmFtZS5zcGxpdCgnXycpO1xuICAgICAgICBjb25zdCBjYXRlZ29yeSA9IHBhcnRzWzBdO1xuICAgICAgICBjb25zdCB0b29sTWV0aG9kTmFtZSA9IHBhcnRzLnNsaWNlKDEpLmpvaW4oJ18nKTtcblxuICAgICAgICAvLyBEaXNjb3ZlcnkgdG9vbHMgYXJlIGhhbmRsZWQgYnkgTUNQU2VydmVyIGRpcmVjdGx5LlxuICAgICAgICBpZiAoY2F0ZWdvcnkgPT09ICdzZXJ2ZXInICYmIChcbiAgICAgICAgICAgIHRvb2xNZXRob2ROYW1lID09PSAnc2VhcmNoX3Rvb2xzJyB8fFxuICAgICAgICAgICAgdG9vbE1ldGhvZE5hbWUgPT09ICdsaXN0X3Rvb2xfY2F0ZWdvcmllcycgfHxcbiAgICAgICAgICAgIHRvb2xNZXRob2ROYW1lID09PSAnZ2V0X3Rvb2xfZGV0YWlsJ1xuICAgICAgICApKSB7XG4gICAgICAgICAgICByZXR1cm4gYXdhaXQgdGhpcy5leGVjdXRlRGlzY292ZXJ5VG9vbENhbGwodG9vbE1ldGhvZE5hbWUsIGFyZ3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRW5mb3JjZSBleHBvc3VyZSBwb2xpY3k6IG9ubHkgY3VycmVudGx5IGV4cG9zZWQgdG9vbHMgYXJlIGNhbGxhYmxlLlxuICAgICAgICBpZiAoIXRoaXMuaXNUb29sRXhwb3NlZCh0b29sTmFtZSkpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVG9vbCAke3Rvb2xOYW1lfSBpcyBkaXNhYmxlZCBvciBub3QgZXhwb3NlZCBpbiBjdXJyZW50IHByb2ZpbGVgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLnRvb2xzW2NhdGVnb3J5XSkge1xuICAgICAgICAgICAgcmV0dXJuIGF3YWl0IHRoaXMudG9vbHNbY2F0ZWdvcnldLmV4ZWN1dGUodG9vbE1ldGhvZE5hbWUsIGFyZ3MpO1xuICAgICAgICB9XG5cbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGBUb29sICR7dG9vbE5hbWV9IG5vdCBmb3VuZGApO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRDbGllbnRzKCk6IE1DUENsaWVudFtdIHtcbiAgICAgICAgcmV0dXJuIEFycmF5LmZyb20odGhpcy5zZXNzaW9ucy52YWx1ZXMoKSkubWFwKHNlc3Npb24gPT4gKHtcbiAgICAgICAgICAgIGlkOiBzZXNzaW9uLmlkLFxuICAgICAgICAgICAgbGFzdEFjdGl2aXR5OiBzZXNzaW9uLmxhc3RBY3Rpdml0eSxcbiAgICAgICAgICAgIHVzZXJBZ2VudDogc2Vzc2lvbi51c2VyQWdlbnRcbiAgICAgICAgfSkpO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRBdmFpbGFibGVUb29scygpOiBUb29sRGVmaW5pdGlvbltdIHtcbiAgICAgICAgcmV0dXJuIHRoaXMudG9vbHNMaXN0O1xuICAgIH1cblxuICAgIHByaXZhdGUgaXNUb29sRXhwb3NlZCh0b29sTmFtZTogc3RyaW5nKTogYm9vbGVhbiB7XG4gICAgICAgIHJldHVybiB0aGlzLnRvb2xzTGlzdC5zb21lKHRvb2wgPT4gdG9vbC5uYW1lID09PSB0b29sTmFtZSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRBbGxUb29sRGVmaW5pdGlvbnMoKTogVG9vbERlZmluaXRpb25bXSB7XG4gICAgICAgIGNvbnN0IGFsbFRvb2xzOiBUb29sRGVmaW5pdGlvbltdID0gW107XG5cbiAgICAgICAgZm9yIChjb25zdCBbY2F0ZWdvcnksIHRvb2xTZXRdIG9mIE9iamVjdC5lbnRyaWVzKHRoaXMudG9vbHMpKSB7XG4gICAgICAgICAgICBjb25zdCB0b29scyA9IHRvb2xTZXQuZ2V0VG9vbHMoKTtcbiAgICAgICAgICAgIGZvciAoY29uc3QgdG9vbCBvZiB0b29scykge1xuICAgICAgICAgICAgICAgIGFsbFRvb2xzLnB1c2goe1xuICAgICAgICAgICAgICAgICAgICBuYW1lOiBgJHtjYXRlZ29yeX1fJHt0b29sLm5hbWV9YCxcbiAgICAgICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHRvb2wuZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgICAgIGlucHV0U2NoZW1hOiB0b29sLmlucHV0U2NoZW1hXG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYWxsVG9vbHM7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBleGVjdXRlRGlzY292ZXJ5VG9vbENhbGwodG9vbE1ldGhvZE5hbWU6IHN0cmluZywgYXJnczogYW55KTogUHJvbWlzZTxhbnk+IHtcbiAgICAgICAgc3dpdGNoICh0b29sTWV0aG9kTmFtZSkge1xuICAgICAgICAgICAgY2FzZSAnc2VhcmNoX3Rvb2xzJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5zZWFyY2hUb29scyhhcmdzKTtcbiAgICAgICAgICAgIGNhc2UgJ2xpc3RfdG9vbF9jYXRlZ29yaWVzJzpcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5saXN0VG9vbENhdGVnb3JpZXMoYXJncyk7XG4gICAgICAgICAgICBjYXNlICdnZXRfdG9vbF9kZXRhaWwnOlxuICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLmdldFRvb2xEZXRhaWwoYXJncyk7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgVW5rbm93biBkaXNjb3ZlcnkgdG9vbDogJHt0b29sTWV0aG9kTmFtZX1gKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgc2VhcmNoVG9vbHMoYXJnczogYW55KTogYW55IHtcbiAgICAgICAgY29uc3Qga2V5d29yZFJhdyA9IHR5cGVvZiBhcmdzPy5rZXl3b3JkID09PSAnc3RyaW5nJyA/IGFyZ3Mua2V5d29yZCA6ICcnO1xuICAgICAgICBjb25zdCBrZXl3b3JkID0ga2V5d29yZFJhdy50cmltKCkudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgaWYgKCFrZXl3b3JkKSB7XG4gICAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGVycm9yOiAna2V5d29yZCBpcyByZXF1aXJlZCdcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjYXRlZ29yeUZpbHRlciA9IHR5cGVvZiBhcmdzPy5jYXRlZ29yeSA9PT0gJ3N0cmluZycgPyBhcmdzLmNhdGVnb3J5LnRyaW0oKSA6ICcnO1xuICAgICAgICBjb25zdCBpbmNsdWRlRGlzYWJsZWQgPSBhcmdzPy5pbmNsdWRlRGlzYWJsZWQgIT09IGZhbHNlO1xuICAgICAgICBjb25zdCBsaW1pdCA9IE1hdGgubWluKE1hdGgubWF4KE51bWJlcihhcmdzPy5saW1pdCkgfHwgMTAsIDEpLCA1MCk7XG4gICAgICAgIGNvbnN0IGVuYWJsZWRUb29sTmFtZXMgPSBuZXcgU2V0KHRoaXMudG9vbHNMaXN0Lm1hcCh0b29sID0+IHRvb2wubmFtZSkpO1xuXG4gICAgICAgIGNvbnN0IHNjb3JlZCA9IHRoaXMuZ2V0QWxsVG9vbERlZmluaXRpb25zKClcbiAgICAgICAgICAgIC5tYXAodG9vbCA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZnVsbE5hbWUgPSB0b29sLm5hbWU7XG4gICAgICAgICAgICAgICAgY29uc3QgY2F0ZWdvcnkgPSBmdWxsTmFtZS5zcGxpdCgnXycpWzBdO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRvb2xOYW1lID0gZnVsbE5hbWUuc3BsaXQoJ18nKS5zbGljZSgxKS5qb2luKCdfJyk7XG4gICAgICAgICAgICAgICAgY29uc3QgZW5hYmxlZCA9IGVuYWJsZWRUb29sTmFtZXMuaGFzKGZ1bGxOYW1lKTtcbiAgICAgICAgICAgICAgICBjb25zdCBzY29yZSA9IHRoaXMuY2FsY3VsYXRlVG9vbE1hdGNoU2NvcmUoa2V5d29yZCwgY2F0ZWdvcnksIHRvb2xOYW1lLCB0b29sLmRlc2NyaXB0aW9uKTtcblxuICAgICAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IGZ1bGxOYW1lLFxuICAgICAgICAgICAgICAgICAgICBjYXRlZ29yeSxcbiAgICAgICAgICAgICAgICAgICAgdG9vbE5hbWUsXG4gICAgICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiB0b29sLmRlc2NyaXB0aW9uLFxuICAgICAgICAgICAgICAgICAgICBlbmFibGVkLFxuICAgICAgICAgICAgICAgICAgICBzY29yZVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmZpbHRlcihpdGVtID0+IGl0ZW0uc2NvcmUgPiAwKVxuICAgICAgICAgICAgLmZpbHRlcihpdGVtID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoY2F0ZWdvcnlGaWx0ZXIgJiYgaXRlbS5jYXRlZ29yeSAhPT0gY2F0ZWdvcnlGaWx0ZXIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIWluY2x1ZGVEaXNhYmxlZCAmJiAhaXRlbS5lbmFibGVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLnNvcnQoKGEsIGIpID0+IGIuc2NvcmUgLSBhLnNjb3JlKVxuICAgICAgICAgICAgLnNsaWNlKDAsIGxpbWl0KTtcblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgICBrZXl3b3JkOiBrZXl3b3JkUmF3LFxuICAgICAgICAgICAgICAgIGNhdGVnb3J5OiBjYXRlZ29yeUZpbHRlciB8fCBudWxsLFxuICAgICAgICAgICAgICAgIGluY2x1ZGVEaXNhYmxlZCxcbiAgICAgICAgICAgICAgICB0b3RhbE1hdGNoZXM6IHNjb3JlZC5sZW5ndGgsXG4gICAgICAgICAgICAgICAgcmVzdWx0czogc2NvcmVkXG4gICAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjYWxjdWxhdGVUb29sTWF0Y2hTY29yZShrZXl3b3JkOiBzdHJpbmcsIGNhdGVnb3J5OiBzdHJpbmcsIHRvb2xOYW1lOiBzdHJpbmcsIGRlc2NyaXB0aW9uOiBzdHJpbmcpOiBudW1iZXIge1xuICAgICAgICBjb25zdCBmdWxsTmFtZSA9IGAke2NhdGVnb3J5fV8ke3Rvb2xOYW1lfWAudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgZGVzY3JpcHRpb25Mb3dlciA9IChkZXNjcmlwdGlvbiB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgY29uc3QgdG9rZW5zID0ga2V5d29yZC5zcGxpdCgvW1xcc18tXSsvKS5maWx0ZXIoQm9vbGVhbik7XG4gICAgICAgIGxldCBzY29yZSA9IDA7XG5cbiAgICAgICAgaWYgKGZ1bGxOYW1lID09PSBrZXl3b3JkKSBzY29yZSArPSAxMjA7XG4gICAgICAgIGlmICh0b29sTmFtZS50b0xvd2VyQ2FzZSgpID09PSBrZXl3b3JkKSBzY29yZSArPSAxMDA7XG4gICAgICAgIGlmIChjYXRlZ29yeS50b0xvd2VyQ2FzZSgpID09PSBrZXl3b3JkKSBzY29yZSArPSA4MDtcbiAgICAgICAgaWYgKGZ1bGxOYW1lLnN0YXJ0c1dpdGgoa2V5d29yZCkpIHNjb3JlICs9IDcwO1xuICAgICAgICBpZiAodG9vbE5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhrZXl3b3JkKSkgc2NvcmUgKz0gNjA7XG4gICAgICAgIGlmIChkZXNjcmlwdGlvbkxvd2VyLmluY2x1ZGVzKGtleXdvcmQpKSBzY29yZSArPSAzNTtcblxuICAgICAgICBmb3IgKGNvbnN0IHRva2VuIG9mIHRva2Vucykge1xuICAgICAgICAgICAgaWYgKHRvb2xOYW1lLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXModG9rZW4pKSBzY29yZSArPSAxMjtcbiAgICAgICAgICAgIGlmIChkZXNjcmlwdGlvbkxvd2VyLmluY2x1ZGVzKHRva2VuKSkgc2NvcmUgKz0gNjtcbiAgICAgICAgICAgIGlmIChjYXRlZ29yeS50b0xvd2VyQ2FzZSgpID09PSB0b2tlbikgc2NvcmUgKz0gMTA7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gc2NvcmU7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBsaXN0VG9vbENhdGVnb3JpZXMoX2FyZ3M6IGFueSk6IGFueSB7XG4gICAgICAgIGNvbnN0IGVuYWJsZWRUb29sTmFtZXMgPSBuZXcgU2V0KHRoaXMudG9vbHNMaXN0Lm1hcCh0b29sID0+IHRvb2wubmFtZSkpO1xuICAgICAgICBjb25zdCBjYXRlZ29yaWVzID0gbmV3IE1hcDxzdHJpbmcsIHsgY2F0ZWdvcnk6IHN0cmluZzsgdG90YWxUb29sczogbnVtYmVyOyBlbmFibGVkVG9vbHM6IG51bWJlciB9PigpO1xuXG4gICAgICAgIGZvciAoY29uc3QgdG9vbCBvZiB0aGlzLmdldEFsbFRvb2xEZWZpbml0aW9ucygpKSB7XG4gICAgICAgICAgICBjb25zdCBjYXRlZ29yeSA9IHRvb2wubmFtZS5zcGxpdCgnXycpWzBdO1xuICAgICAgICAgICAgY29uc3QgY3VycmVudCA9IGNhdGVnb3JpZXMuZ2V0KGNhdGVnb3J5KSB8fCB7XG4gICAgICAgICAgICAgICAgY2F0ZWdvcnksXG4gICAgICAgICAgICAgICAgdG90YWxUb29sczogMCxcbiAgICAgICAgICAgICAgICBlbmFibGVkVG9vbHM6IDBcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBjdXJyZW50LnRvdGFsVG9vbHMgKz0gMTtcbiAgICAgICAgICAgIGlmIChlbmFibGVkVG9vbE5hbWVzLmhhcyh0b29sLm5hbWUpKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudC5lbmFibGVkVG9vbHMgKz0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNhdGVnb3JpZXMuc2V0KGNhdGVnb3J5LCBjdXJyZW50KTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgIGNhdGVnb3JpZXM6IEFycmF5LmZyb20oY2F0ZWdvcmllcy52YWx1ZXMoKSkuc29ydCgoYSwgYikgPT4gYS5jYXRlZ29yeS5sb2NhbGVDb21wYXJlKGIuY2F0ZWdvcnkpKVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgZ2V0VG9vbERldGFpbChhcmdzOiBhbnkpOiBhbnkge1xuICAgICAgICBjb25zdCB0b29sTmFtZSA9IHR5cGVvZiBhcmdzPy5uYW1lID09PSAnc3RyaW5nJyA/IGFyZ3MubmFtZS50cmltKCkgOiAnJztcbiAgICAgICAgaWYgKCF0b29sTmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBlcnJvcjogJ25hbWUgaXMgcmVxdWlyZWQnXG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgYWxsVG9vbHMgPSB0aGlzLmdldEFsbFRvb2xEZWZpbml0aW9ucygpO1xuICAgICAgICBjb25zdCB0b29sID0gYWxsVG9vbHMuZmluZChpdGVtID0+IGl0ZW0ubmFtZSA9PT0gdG9vbE5hbWUpO1xuICAgICAgICBpZiAoIXRvb2wpIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICAgICAgICAgICAgZXJyb3I6IGBUb29sICR7dG9vbE5hbWV9IG5vdCBmb3VuZGBcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjYXRlZ29yeSA9IHRvb2wubmFtZS5zcGxpdCgnXycpWzBdO1xuICAgICAgICBjb25zdCBtZXRob2QgPSB0b29sLm5hbWUuc3BsaXQoJ18nKS5zbGljZSgxKS5qb2luKCdfJyk7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgICAgbmFtZTogdG9vbC5uYW1lLFxuICAgICAgICAgICAgICAgIGNhdGVnb3J5LFxuICAgICAgICAgICAgICAgIHRvb2xOYW1lOiBtZXRob2QsXG4gICAgICAgICAgICAgICAgZW5hYmxlZDogdGhpcy5pc1Rvb2xFeHBvc2VkKHRvb2wubmFtZSksXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246IHRvb2wuZGVzY3JpcHRpb24sXG4gICAgICAgICAgICAgICAgaW5wdXRTY2hlbWE6IHRvb2wuaW5wdXRTY2hlbWEsXG4gICAgICAgICAgICAgICAgc2FtcGxlUGFyYW1zOiB0aGlzLmdlbmVyYXRlU2FtcGxlUGFyYW1zKHRvb2wuaW5wdXRTY2hlbWEpLFxuICAgICAgICAgICAgICAgIGFwaVBhdGg6IGAvYXBpLyR7Y2F0ZWdvcnl9LyR7bWV0aG9kfWBcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICBwdWJsaWMgdXBkYXRlRW5hYmxlZFRvb2xzKGVuYWJsZWRUb29sczogYW55W10pOiB2b2lkIHtcbiAgICAgICAgY29uc29sZS5sb2coYFtNQ1BTZXJ2ZXJdIFVwZGF0aW5nIGVuYWJsZWQgdG9vbHM6ICR7ZW5hYmxlZFRvb2xzLmxlbmd0aH0gdG9vbHNgKTtcbiAgICAgICAgdGhpcy5lbmFibGVkVG9vbHMgPSBlbmFibGVkVG9vbHM7XG4gICAgICAgIHRoaXMuc2V0dXBUb29scygpOyAvLyDph43mlrDorr7nva7lt6XlhbfliJfooahcbiAgICB9XG5cbiAgICBwdWJsaWMgZ2V0U2V0dGluZ3MoKTogTUNQU2VydmVyU2V0dGluZ3Mge1xuICAgICAgICByZXR1cm4gdGhpcy5zZXR0aW5ncztcbiAgICB9XG5cbiAgICBwcml2YXRlIHNldENvbW1vblJlc3BvbnNlSGVhZGVycyhyZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpOiB2b2lkIHtcbiAgICAgICAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJywgJyonKTtcbiAgICAgICAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcycsICdHRVQsIFBPU1QsIE9QVElPTlMnKTtcbiAgICAgICAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycycsICdDb250ZW50LVR5cGUsIEF1dGhvcml6YXRpb24sIEFjY2VwdCwgTWNwLVNlc3Npb24tSWQsIExhc3QtRXZlbnQtSUQnKTtcbiAgICAgICAgcmVzLnNldEhlYWRlcignQWNjZXNzLUNvbnRyb2wtRXhwb3NlLUhlYWRlcnMnLCAnTWNwLVNlc3Npb24tSWQnKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZUh0dHBSZXF1ZXN0KHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBjb25zdCBwYXJzZWRVcmwgPSB1cmwucGFyc2UocmVxLnVybCB8fCAnJywgdHJ1ZSk7XG4gICAgICAgIGNvbnN0IHBhdGhuYW1lID0gcGFyc2VkVXJsLnBhdGhuYW1lO1xuXG4gICAgICAgIHRoaXMuc2V0Q29tbW9uUmVzcG9uc2VIZWFkZXJzKHJlcyk7XG5cbiAgICAgICAgaWYgKHJlcS5tZXRob2QgPT09ICdPUFRJT05TJykge1xuICAgICAgICAgICAgcmVzLndyaXRlSGVhZCgyMDApO1xuICAgICAgICAgICAgcmVzLmVuZCgpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChwYXRobmFtZSA9PT0gJy9tY3AnICYmIHJlcS5tZXRob2QgPT09ICdHRVQnKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgdGhpcy5oYW5kbGVNQ1BTdHJlYW1SZXF1ZXN0KHJlcSwgcmVzKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGF0aG5hbWUgPT09ICcvbWNwJyAmJiByZXEubWV0aG9kID09PSAnUE9TVCcpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZU1DUFJlcXVlc3QocmVxLCByZXMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwYXRobmFtZSA9PT0gJy9oZWFsdGgnICYmIHJlcS5tZXRob2QgPT09ICdHRVQnKSB7XG4gICAgICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDIwMCk7XG4gICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgICAgICAgICAgIHN0YXR1czogJ29rJyxcbiAgICAgICAgICAgICAgICAgICAgdG9vbHM6IHRoaXMudG9vbHNMaXN0Lmxlbmd0aCxcbiAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbnM6IHRoaXMuc2Vzc2lvbnMuc2l6ZSxcbiAgICAgICAgICAgICAgICAgICAgc3RyZWFtczogdGhpcy5zdHJlYW1Db25uZWN0aW9ucy5zaXplXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChwYXRobmFtZT8uc3RhcnRzV2l0aCgnL2FwaS8nKSAmJiByZXEubWV0aG9kID09PSAnUE9TVCcpIHtcbiAgICAgICAgICAgICAgICBhd2FpdCB0aGlzLmhhbmRsZVNpbXBsZUFQSVJlcXVlc3QocmVxLCByZXMsIHBhdGhuYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAocGF0aG5hbWUgPT09ICcvYXBpL3Rvb2xzJyAmJiByZXEubWV0aG9kID09PSAnR0VUJykge1xuICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCgyMDApO1xuICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyB0b29sczogdGhpcy5nZXRTaW1wbGlmaWVkVG9vbHNMaXN0KCkgfSkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNDA0KTtcbiAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdOb3QgZm91bmQnIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1tNQ1BTZXJ2ZXJdW3RyYW5zcG9ydF0gSFRUUCByZXF1ZXN0IGVycm9yOicsIGVycm9yKTtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAgICAgICByZXMud3JpdGVIZWFkKDUwMCk7XG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdJbnRlcm5hbCBzZXJ2ZXIgZXJyb3InIH0pKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgYXN5bmMgaGFuZGxlTUNQU3RyZWFtUmVxdWVzdChyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlLCByZXM6IGh0dHAuU2VydmVyUmVzcG9uc2UpOiBQcm9taXNlPHZvaWQ+IHtcbiAgICAgICAgY29uc3Qgc2Vzc2lvbiA9IHRoaXMucmVzb2x2ZVNlc3Npb24ocmVxLCB0cnVlKTtcbiAgICAgICAgaWYgKCFzZXNzaW9uKSB7XG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg1MDApO1xuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnRmFpbGVkIHRvIGNyZWF0ZSBNQ1Agc2Vzc2lvbiBmb3Igc3RyZWFtIGNvbm5lY3Rpb24nIH0pKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7XG4gICAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ3RleHQvZXZlbnQtc3RyZWFtOyBjaGFyc2V0PXV0Zi04JyxcbiAgICAgICAgICAgICdDYWNoZS1Db250cm9sJzogJ25vLWNhY2hlLCBuby10cmFuc2Zvcm0nLFxuICAgICAgICAgICAgQ29ubmVjdGlvbjogJ2tlZXAtYWxpdmUnLFxuICAgICAgICAgICAgJ1gtQWNjZWwtQnVmZmVyaW5nJzogJ25vJyxcbiAgICAgICAgICAgICdNY3AtU2Vzc2lvbi1JZCc6IHNlc3Npb24uaWRcbiAgICAgICAgfSk7XG5cbiAgICAgICAgaWYgKHR5cGVvZiAocmVzIGFzIGFueSkuZmx1c2hIZWFkZXJzID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAocmVzIGFzIGFueSkuZmx1c2hIZWFkZXJzKCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnJlZ2lzdGVyU3RyZWFtQ29ubmVjdGlvbihzZXNzaW9uLmlkLCByZXEsIHJlcyk7XG4gICAgICAgIHRoaXMud3JpdGVTU0VDb21tZW50KHJlcywgJ3N0cmVhbS1vcGVuJyk7XG4gICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXVt0cmFuc3BvcnRdIFNTRSBzdHJlYW0gY29ubmVjdGVkOiBzZXNzaW9uPSR7c2Vzc2lvbi5pZH1gKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHJlZ2lzdGVyU3RyZWFtQ29ubmVjdGlvbihzZXNzaW9uSWQ6IHN0cmluZywgcmVxOiBodHRwLkluY29taW5nTWVzc2FnZSwgcmVzOiBodHRwLlNlcnZlclJlc3BvbnNlKTogdm9pZCB7XG4gICAgICAgIGxldCBjb25uZWN0aW9ucyA9IHRoaXMuc3RyZWFtQ29ubmVjdGlvbnMuZ2V0KHNlc3Npb25JZCk7XG4gICAgICAgIGlmICghY29ubmVjdGlvbnMpIHtcbiAgICAgICAgICAgIGNvbm5lY3Rpb25zID0gbmV3IFNldDxodHRwLlNlcnZlclJlc3BvbnNlPigpO1xuICAgICAgICAgICAgdGhpcy5zdHJlYW1Db25uZWN0aW9ucy5zZXQoc2Vzc2lvbklkLCBjb25uZWN0aW9ucyk7XG4gICAgICAgIH1cbiAgICAgICAgY29ubmVjdGlvbnMuYWRkKHJlcyk7XG5cbiAgICAgICAgY29uc3Qga2VlcEFsaXZlVGltZXIgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICBpZiAocmVzLndyaXRhYmxlRW5kZWQgfHwgcmVzLmRlc3Ryb3llZCkge1xuICAgICAgICAgICAgICAgIHRoaXMudW5yZWdpc3RlclN0cmVhbUNvbm5lY3Rpb24oc2Vzc2lvbklkLCByZXMpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMud3JpdGVTU0VDb21tZW50KHJlcywgJ2tlZXAtYWxpdmUnKTtcbiAgICAgICAgfSwgdGhpcy5zc2VLZWVwQWxpdmVNcyk7XG4gICAgICAgIHRoaXMuc3RyZWFtSGVhcnRiZWF0VGltZXJzLnNldChyZXMsIGtlZXBBbGl2ZVRpbWVyKTtcblxuICAgICAgICBjb25zdCBjbGVhbnVwID0gKCkgPT4gdGhpcy51bnJlZ2lzdGVyU3RyZWFtQ29ubmVjdGlvbihzZXNzaW9uSWQsIHJlcyk7XG4gICAgICAgIHJlcS5vbignY2xvc2UnLCBjbGVhbnVwKTtcbiAgICAgICAgcmVxLm9uKCdhYm9ydGVkJywgY2xlYW51cCk7XG4gICAgICAgIHJlcy5vbignY2xvc2UnLCBjbGVhbnVwKTtcbiAgICAgICAgcmVzLm9uKCdlcnJvcicsIGNsZWFudXApO1xuICAgIH1cblxuICAgIHByaXZhdGUgdW5yZWdpc3RlclN0cmVhbUNvbm5lY3Rpb24oc2Vzc2lvbklkOiBzdHJpbmcsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSk6IHZvaWQge1xuICAgICAgICBjb25zdCBoZWFydGJlYXQgPSB0aGlzLnN0cmVhbUhlYXJ0YmVhdFRpbWVycy5nZXQocmVzKTtcbiAgICAgICAgaWYgKGhlYXJ0YmVhdCkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbChoZWFydGJlYXQpO1xuICAgICAgICAgICAgdGhpcy5zdHJlYW1IZWFydGJlYXRUaW1lcnMuZGVsZXRlKHJlcyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBjb25uZWN0aW9ucyA9IHRoaXMuc3RyZWFtQ29ubmVjdGlvbnMuZ2V0KHNlc3Npb25JZCk7XG4gICAgICAgIGlmICghY29ubmVjdGlvbnMpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbm5lY3Rpb25zLmRlbGV0ZShyZXMpO1xuICAgICAgICBpZiAoY29ubmVjdGlvbnMuc2l6ZSA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5zdHJlYW1Db25uZWN0aW9ucy5kZWxldGUoc2Vzc2lvbklkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgd3JpdGVTU0VDb21tZW50KHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSwgdGV4dDogc3RyaW5nKTogdm9pZCB7XG4gICAgICAgIGlmIChyZXMud3JpdGFibGVFbmRlZCB8fCByZXMuZGVzdHJveWVkKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgcmVzLndyaXRlKGA6ICR7dGV4dH1cXG5cXG5gKTtcbiAgICB9XG5cbiAgICBwcml2YXRlIHdyaXRlU1NFRXZlbnQocmVzOiBodHRwLlNlcnZlclJlc3BvbnNlLCBldmVudDogc3RyaW5nLCBwYXlsb2FkOiBhbnkpOiB2b2lkIHtcbiAgICAgICAgaWYgKHJlcy53cml0YWJsZUVuZGVkIHx8IHJlcy5kZXN0cm95ZWQpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHNlcmlhbGl6ZWQgPSBKU09OLnN0cmluZ2lmeShwYXlsb2FkKTtcbiAgICAgICAgcmVzLndyaXRlKGBldmVudDogJHtldmVudH1cXG5gKTtcbiAgICAgICAgZm9yIChjb25zdCBsaW5lIG9mIHNlcmlhbGl6ZWQuc3BsaXQoJ1xcbicpKSB7XG4gICAgICAgICAgICByZXMud3JpdGUoYGRhdGE6ICR7bGluZX1cXG5gKTtcbiAgICAgICAgfVxuICAgICAgICByZXMud3JpdGUoJ1xcbicpO1xuICAgIH1cblxuICAgIHByaXZhdGUgcHVzaE1lc3NhZ2VUb1Nlc3Npb24oc2Vzc2lvbklkOiBzdHJpbmcsIG1lc3NhZ2U6IE1DUEpTT05SUENSZXNwb25zZSk6IHZvaWQge1xuICAgICAgICBjb25zdCBjb25uZWN0aW9ucyA9IHRoaXMuc3RyZWFtQ29ubmVjdGlvbnMuZ2V0KHNlc3Npb25JZCk7XG4gICAgICAgIGlmICghY29ubmVjdGlvbnMgfHwgY29ubmVjdGlvbnMuc2l6ZSA9PT0gMCkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCBjb25uZWN0aW9uIG9mIEFycmF5LmZyb20oY29ubmVjdGlvbnMudmFsdWVzKCkpKSB7XG4gICAgICAgICAgICBpZiAoY29ubmVjdGlvbi53cml0YWJsZUVuZGVkIHx8IGNvbm5lY3Rpb24uZGVzdHJveWVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy51bnJlZ2lzdGVyU3RyZWFtQ29ubmVjdGlvbihzZXNzaW9uSWQsIGNvbm5lY3Rpb24pO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy53cml0ZVNTRUV2ZW50KGNvbm5lY3Rpb24sICdtZXNzYWdlJywgbWVzc2FnZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGhhc0FjdGl2ZVN0cmVhbUNvbm5lY3Rpb24oc2Vzc2lvbklkOiBzdHJpbmcpOiBib29sZWFuIHtcbiAgICAgICAgY29uc3QgY29ubmVjdGlvbnMgPSB0aGlzLnN0cmVhbUNvbm5lY3Rpb25zLmdldChzZXNzaW9uSWQpO1xuICAgICAgICByZXR1cm4gISFjb25uZWN0aW9ucyAmJiBjb25uZWN0aW9ucy5zaXplID4gMDtcbiAgICB9XG5cbiAgICBwcml2YXRlIHJlcXVlc3RBY2NlcHRzRXZlbnRTdHJlYW0ocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSk6IGJvb2xlYW4ge1xuICAgICAgICBjb25zdCBhY2NlcHQgPSB0aGlzLmdldEhlYWRlclZhbHVlKHJlcSwgJ2FjY2VwdCcpO1xuICAgICAgICByZXR1cm4gISFhY2NlcHQgJiYgYWNjZXB0LnRvTG93ZXJDYXNlKCkuaW5jbHVkZXMoJ3RleHQvZXZlbnQtc3RyZWFtJyk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZXRIZWFkZXJWYWx1ZShyZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlIHwgdW5kZWZpbmVkLCBoZWFkZXJOYW1lOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICAgICAgICBpZiAoIXJlcSkge1xuICAgICAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJhd1ZhbHVlID0gcmVxLmhlYWRlcnNbaGVhZGVyTmFtZS50b0xvd2VyQ2FzZSgpXTtcbiAgICAgICAgaWYgKEFycmF5LmlzQXJyYXkocmF3VmFsdWUpKSB7XG4gICAgICAgICAgICByZXR1cm4gcmF3VmFsdWVbMF07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIHJhd1ZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgcmV0dXJuIHJhd1ZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG5cbiAgICBwcml2YXRlIGNyZWF0ZVNlc3Npb24oc2Vzc2lvbklkOiBzdHJpbmcsIHJlcT86IGh0dHAuSW5jb21pbmdNZXNzYWdlKTogTUNQU2Vzc2lvbiB7XG4gICAgICAgIGNvbnN0IG5vdyA9IG5ldyBEYXRlKCk7XG4gICAgICAgIGNvbnN0IHNlc3Npb246IE1DUFNlc3Npb24gPSB7XG4gICAgICAgICAgICBpZDogc2Vzc2lvbklkLFxuICAgICAgICAgICAgY3JlYXRlZEF0OiBub3csXG4gICAgICAgICAgICBsYXN0QWN0aXZpdHk6IG5vdyxcbiAgICAgICAgICAgIGluaXRpYWxpemVkOiBmYWxzZSxcbiAgICAgICAgICAgIHVzZXJBZ2VudDogdGhpcy5nZXRIZWFkZXJWYWx1ZShyZXEsICd1c2VyLWFnZW50JylcbiAgICAgICAgfTtcblxuICAgICAgICB0aGlzLnNlc3Npb25zLnNldChzZXNzaW9uSWQsIHNlc3Npb24pO1xuICAgICAgICBjb25zb2xlLmxvZyhgW01DUFNlcnZlcl1bdHJhbnNwb3J0XSBDcmVhdGVkIE1DUCBzZXNzaW9uOiAke3Nlc3Npb25JZH1gKTtcbiAgICAgICAgcmV0dXJuIHNlc3Npb247XG4gICAgfVxuXG4gICAgcHJpdmF0ZSB0b3VjaFNlc3Npb24oc2Vzc2lvbjogTUNQU2Vzc2lvbiwgcmVxPzogaHR0cC5JbmNvbWluZ01lc3NhZ2UpOiB2b2lkIHtcbiAgICAgICAgc2Vzc2lvbi5sYXN0QWN0aXZpdHkgPSBuZXcgRGF0ZSgpO1xuICAgICAgICBjb25zdCB1c2VyQWdlbnQgPSB0aGlzLmdldEhlYWRlclZhbHVlKHJlcSwgJ3VzZXItYWdlbnQnKTtcbiAgICAgICAgaWYgKHVzZXJBZ2VudCkge1xuICAgICAgICAgICAgc2Vzc2lvbi51c2VyQWdlbnQgPSB1c2VyQWdlbnQ7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIHJlc29sdmVTZXNzaW9uKHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIGNyZWF0ZUlmTWlzc2luZzogYm9vbGVhbik6IE1DUFNlc3Npb24gfCBudWxsIHtcbiAgICAgICAgY29uc3QgcHJvdmlkZWRTZXNzaW9uSWQgPSB0aGlzLmdldEhlYWRlclZhbHVlKHJlcSwgJ21jcC1zZXNzaW9uLWlkJyk7XG4gICAgICAgIGlmIChwcm92aWRlZFNlc3Npb25JZCkge1xuICAgICAgICAgICAgY29uc3QgZXhpc3RpbmdTZXNzaW9uID0gdGhpcy5zZXNzaW9ucy5nZXQocHJvdmlkZWRTZXNzaW9uSWQpO1xuICAgICAgICAgICAgaWYgKGV4aXN0aW5nU2Vzc2lvbikge1xuICAgICAgICAgICAgICAgIHRoaXMudG91Y2hTZXNzaW9uKGV4aXN0aW5nU2Vzc2lvbiwgcmVxKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZXhpc3RpbmdTZXNzaW9uO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY3JlYXRlSWZNaXNzaW5nKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBbTUNQU2VydmVyXVt0cmFuc3BvcnRdIFVua25vd24gc2Vzc2lvbiBpZCAnJHtwcm92aWRlZFNlc3Npb25JZH0nLCByZWNyZWF0aW5nIHNlc3Npb25gKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVTZXNzaW9uKHByb3ZpZGVkU2Vzc2lvbklkLCByZXEpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghY3JlYXRlSWZNaXNzaW5nKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLmNyZWF0ZVNlc3Npb24odXVpZHY0KCksIHJlcSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyByZWFkUmVxdWVzdEJvZHkocmVxOiBodHRwLkluY29taW5nTWVzc2FnZSk6IFByb21pc2U8c3RyaW5nPiB7XG4gICAgICAgIHJldHVybiBhd2FpdCBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgIGxldCBib2R5ID0gJyc7XG4gICAgICAgICAgICByZXEub24oJ2RhdGEnLCAoY2h1bmspID0+IHtcbiAgICAgICAgICAgICAgICBib2R5ICs9IGNodW5rLnRvU3RyaW5nKCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJlcS5vbignZW5kJywgKCkgPT4gcmVzb2x2ZShib2R5KSk7XG4gICAgICAgICAgICByZXEub24oJ2Vycm9yJywgcmVqZWN0KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBwYXJzZU1DUFBheWxvYWQoYm9keTogc3RyaW5nKTogUGFyc2VkTUNQUGF5bG9hZCB7XG4gICAgICAgIGxldCBwYXJzZWRCb2R5OiB1bmtub3duO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcGFyc2VkQm9keSA9IEpTT04ucGFyc2UoYm9keSk7XG4gICAgICAgIH0gY2F0Y2ggKHBhcnNlRXJyb3I6IGFueSkge1xuICAgICAgICAgICAgY29uc3QgZml4ZWRCb2R5ID0gdGhpcy5maXhDb21tb25Kc29uSXNzdWVzKGJvZHkpO1xuICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBwYXJzZWRCb2R5ID0gSlNPTi5wYXJzZShmaXhlZEJvZHkpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdbTUNQU2VydmVyXSBGaXhlZCBKU09OIHBhcnNpbmcgaXNzdWUnKTtcbiAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihgSlNPTiBwYXJzaW5nIGZhaWxlZDogJHtwYXJzZUVycm9yLm1lc3NhZ2V9LiBPcmlnaW5hbCBib2R5OiAke2JvZHkuc3Vic3RyaW5nKDAsIDUwMCl9Li4uYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShwYXJzZWRCb2R5KSkge1xuICAgICAgICAgICAgaWYgKHBhcnNlZEJvZHkubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdCYXRjaCByZXF1ZXN0IGNhbm5vdCBiZSBlbXB0eScpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBtZXNzYWdlczogcGFyc2VkQm9keSBhcyBNQ1BKU09OUlBDTWVzc2FnZVtdLFxuICAgICAgICAgICAgICAgIGlzQmF0Y2g6IHRydWVcbiAgICAgICAgICAgIH07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXBhcnNlZEJvZHkgfHwgdHlwZW9mIHBhcnNlZEJvZHkgIT09ICdvYmplY3QnKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1JlcXVlc3QgYm9keSBtdXN0IGJlIGEgSlNPTi1SUEMgb2JqZWN0IG9yIGFycmF5Jyk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbWVzc2FnZXM6IFtwYXJzZWRCb2R5IGFzIE1DUEpTT05SUENNZXNzYWdlXSxcbiAgICAgICAgICAgIGlzQmF0Y2g6IGZhbHNlXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVNQ1BSZXF1ZXN0KHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmF3Qm9keSA9IGF3YWl0IHRoaXMucmVhZFJlcXVlc3RCb2R5KHJlcSk7XG4gICAgICAgICAgICBjb25zdCB7IG1lc3NhZ2VzLCBpc0JhdGNoIH0gPSB0aGlzLnBhcnNlTUNQUGF5bG9hZChyYXdCb2R5KTtcbiAgICAgICAgICAgIGNvbnN0IGhhc0luaXRpYWxpemVSZXF1ZXN0ID0gbWVzc2FnZXMuc29tZShtZXNzYWdlID0+IG1lc3NhZ2UgJiYgdHlwZW9mIG1lc3NhZ2UgPT09ICdvYmplY3QnICYmIG1lc3NhZ2UubWV0aG9kID09PSAnaW5pdGlhbGl6ZScpO1xuICAgICAgICAgICAgY29uc3QgaGFzU2Vzc2lvbkhlYWRlciA9ICEhdGhpcy5nZXRIZWFkZXJWYWx1ZShyZXEsICdtY3Atc2Vzc2lvbi1pZCcpO1xuXG4gICAgICAgICAgICBjb25zdCBzZXNzaW9uID0gdGhpcy5yZXNvbHZlU2Vzc2lvbihyZXEsIGhhc0luaXRpYWxpemVSZXF1ZXN0IHx8IGhhc1Nlc3Npb25IZWFkZXIpO1xuICAgICAgICAgICAgaWYgKGhhc0luaXRpYWxpemVSZXF1ZXN0ICYmIHNlc3Npb24pIHtcbiAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdNY3AtU2Vzc2lvbi1JZCcsIHNlc3Npb24uaWQpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZXM6IE1DUEpTT05SUENSZXNwb25zZVtdID0gW107XG4gICAgICAgICAgICBmb3IgKGNvbnN0IG1lc3NhZ2Ugb2YgbWVzc2FnZXMpIHtcbiAgICAgICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuaGFuZGxlTWVzc2FnZShtZXNzYWdlLCBzZXNzaW9uLCByZXEpO1xuICAgICAgICAgICAgICAgIGlmIChyZXNwb25zZSkge1xuICAgICAgICAgICAgICAgICAgICByZXNwb25zZXMucHVzaChyZXNwb25zZSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAocmVzcG9uc2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoMjA0KTtcbiAgICAgICAgICAgICAgICByZXMuZW5kKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2Vzc2lvbiAmJiB0aGlzLnJlcXVlc3RBY2NlcHRzRXZlbnRTdHJlYW0ocmVxKSAmJiB0aGlzLmhhc0FjdGl2ZVN0cmVhbUNvbm5lY3Rpb24oc2Vzc2lvbi5pZCkpIHtcbiAgICAgICAgICAgICAgICBmb3IgKGNvbnN0IHJlc3BvbnNlIG9mIHJlc3BvbnNlcykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnB1c2hNZXNzYWdlVG9TZXNzaW9uKHNlc3Npb24uaWQsIHJlc3BvbnNlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDIwMik7XG4gICAgICAgICAgICAgICAgcmVzLmVuZCgpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcbiAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoMjAwKTtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoaXNCYXRjaCA/IHJlc3BvbnNlcyA6IHJlc3BvbnNlc1swXSkpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbTUNQU2VydmVyXVt0cmFuc3BvcnRdIEVycm9yIGhhbmRsaW5nIE1DUCByZXF1ZXN0OicsIGVycm9yKTtcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAgICAgICByZXMud3JpdGVIZWFkKDQwMCk7XG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHRoaXMuY3JlYXRlRXJyb3JSZXNwb25zZShudWxsLCAtMzI3MDAsIGBQYXJzZSBlcnJvcjogJHtlcnJvci5tZXNzYWdlfWApKSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBwcml2YXRlIGFzeW5jIGhhbmRsZU1lc3NhZ2UoXG4gICAgICAgIG1lc3NhZ2U6IE1DUEpTT05SUENNZXNzYWdlLFxuICAgICAgICBzZXNzaW9uOiBNQ1BTZXNzaW9uIHwgbnVsbCxcbiAgICAgICAgcmVxOiBodHRwLkluY29taW5nTWVzc2FnZVxuICAgICk6IFByb21pc2U8TUNQSlNPTlJQQ1Jlc3BvbnNlIHwgbnVsbD4ge1xuICAgICAgICBpZiAoIW1lc3NhZ2UgfHwgdHlwZW9mIG1lc3NhZ2UgIT09ICdvYmplY3QnIHx8IEFycmF5LmlzQXJyYXkobWVzc2FnZSkpIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNyZWF0ZUVycm9yUmVzcG9uc2UobnVsbCwgLTMyNjAwLCAnSW52YWxpZCBSZXF1ZXN0OiBtZXNzYWdlIG11c3QgYmUgYW4gb2JqZWN0Jyk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCBoYXNJZCA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChtZXNzYWdlLCAnaWQnKTtcbiAgICAgICAgY29uc3QgaXNOb3RpZmljYXRpb24gPSAhaGFzSWQ7XG4gICAgICAgIGNvbnN0IHJlcXVlc3RJZDogTUNQUmVxdWVzdElkID0gaGFzSWQgPyAobWVzc2FnZS5pZCA/PyBudWxsKSA6IG51bGw7XG4gICAgICAgIGNvbnN0IG1ldGhvZCA9IG1lc3NhZ2UubWV0aG9kO1xuICAgICAgICBjb25zdCBwYXJhbXMgPSBtZXNzYWdlLnBhcmFtcztcblxuICAgICAgICBpZiAoc2Vzc2lvbikge1xuICAgICAgICAgICAgdGhpcy50b3VjaFNlc3Npb24oc2Vzc2lvbiwgcmVxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChtZXNzYWdlLmpzb25ycGMgIT09IHVuZGVmaW5lZCAmJiBtZXNzYWdlLmpzb25ycGMgIT09ICcyLjAnKSB7XG4gICAgICAgICAgICBpZiAoaXNOb3RpZmljYXRpb24pIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFtNQ1BTZXJ2ZXJdW3Byb3RvY29sXSBJZ25vcmVkIGludmFsaWQgbm90aWZpY2F0aW9uIHdpdGgganNvbnJwYz0nJHtTdHJpbmcobWVzc2FnZS5qc29ucnBjKX0nYCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVFcnJvclJlc3BvbnNlKHJlcXVlc3RJZCwgLTMyNjAwLCAnSW52YWxpZCBSZXF1ZXN0OiBqc29ucnBjIG11c3QgYmUgXCIyLjBcIicpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBtZXRob2QgIT09ICdzdHJpbmcnIHx8IG1ldGhvZC5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGlmIChpc05vdGlmaWNhdGlvbikge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybignW01DUFNlcnZlcl1bcHJvdG9jb2xdIElnbm9yZWQgaW52YWxpZCBub3RpZmljYXRpb24gd2l0aG91dCBtZXRob2QnKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNyZWF0ZUVycm9yUmVzcG9uc2UocmVxdWVzdElkLCAtMzI2MDAsICdJbnZhbGlkIFJlcXVlc3Q6IG1ldGhvZCBtdXN0IGJlIGEgbm9uLWVtcHR5IHN0cmluZycpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG1ldGhvZCA9PT0gJ2luaXRpYWxpemVkJyB8fCBtZXRob2Quc3RhcnRzV2l0aCgnbm90aWZpY2F0aW9ucy8nKSkge1xuICAgICAgICAgICAgdGhpcy5oYW5kbGVOb3RpZmljYXRpb24obWV0aG9kLCBwYXJhbXMsIHNlc3Npb24sIHJlcSk7XG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgcmVzdWx0OiBhbnk7XG5cbiAgICAgICAgICAgIHN3aXRjaCAobWV0aG9kKSB7XG4gICAgICAgICAgICAgICAgY2FzZSAnaW5pdGlhbGl6ZSc6IHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHNlc3Npb24pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHByb3RvY29sVmVyc2lvbiA9IHBhcmFtcyAmJiB0eXBlb2YgcGFyYW1zID09PSAnb2JqZWN0JyA/IHBhcmFtcy5wcm90b2NvbFZlcnNpb24gOiB1bmRlZmluZWQ7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHByb3RvY29sVmVyc2lvbiA9PT0gJ3N0cmluZycgJiYgcHJvdG9jb2xWZXJzaW9uLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXNzaW9uLnByb3RvY29sVmVyc2lvbiA9IHByb3RvY29sVmVyc2lvbjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHByb3RvY29sVmVyc2lvbjogdGhpcy5tY3BQcm90b2NvbFZlcnNpb24sXG4gICAgICAgICAgICAgICAgICAgICAgICBjYXBhYmlsaXRpZXM6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0b29sczoge31cbiAgICAgICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBzZXJ2ZXJJbmZvOiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogJ2NvY29zLW1jcC1zZXJ2ZXInLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHZlcnNpb246IHRoaXMubWNwU2VydmVyVmVyc2lvblxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY2FzZSAndG9vbHMvbGlzdCc6XG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdCA9IHsgdG9vbHM6IHRoaXMuZ2V0QXZhaWxhYmxlVG9vbHMoKSB9O1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICd0b29scy9jYWxsJzoge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIXBhcmFtcyB8fCB0eXBlb2YgcGFyYW1zICE9PSAnb2JqZWN0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGlzTm90aWZpY2F0aW9uID8gbnVsbCA6IHRoaXMuY3JlYXRlRXJyb3JSZXNwb25zZShyZXF1ZXN0SWQsIC0zMjYwMiwgJ0ludmFsaWQgcGFyYW1zOiBleHBlY3RlZCBhbiBvYmplY3QnKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHRvb2xOYW1lID0gKHBhcmFtcyBhcyBhbnkpLm5hbWU7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGFyZ3MgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwocGFyYW1zLCAnYXJndW1lbnRzJykgPyAocGFyYW1zIGFzIGFueSkuYXJndW1lbnRzIDoge307XG4gICAgICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdG9vbE5hbWUgIT09ICdzdHJpbmcnIHx8IHRvb2xOYW1lLmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGlzTm90aWZpY2F0aW9uID8gbnVsbCA6IHRoaXMuY3JlYXRlRXJyb3JSZXNwb25zZShyZXF1ZXN0SWQsIC0zMjYwMiwgJ0ludmFsaWQgcGFyYW1zOiBuYW1lIGlzIHJlcXVpcmVkJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICBjb25zdCB0b29sUmVzdWx0ID0gYXdhaXQgdGhpcy5leGVjdXRlVG9vbENhbGwodG9vbE5hbWUsIGFyZ3MgfHwge30pO1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSB7IGNvbnRlbnQ6IFt7IHR5cGU6ICd0ZXh0JywgdGV4dDogSlNPTi5zdHJpbmdpZnkodG9vbFJlc3VsdCkgfV0gfTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgIGlmIChpc05vdGlmaWNhdGlvbikge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtNQ1BTZXJ2ZXJdW3Byb3RvY29sXSBJZ25vcmVkIHVua25vd24gbm90aWZpY2F0aW9uIG1ldGhvZDogJHttZXRob2R9YCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVFcnJvclJlc3BvbnNlKHJlcXVlc3RJZCwgLTMyNjAxLCBgTWV0aG9kIG5vdCBmb3VuZDogJHttZXRob2R9YCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChpc05vdGlmaWNhdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy5jcmVhdGVSZXN1bHRSZXNwb25zZShyZXF1ZXN0SWQsIHJlc3VsdCk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgIGNvbnN0IG1lc3NhZ2VUZXh0ID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBTdHJpbmcoZXJyb3IpO1xuICAgICAgICAgICAgaWYgKGlzTm90aWZpY2F0aW9uKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBbTUNQU2VydmVyXVtwcm90b2NvbF0gTm90aWZpY2F0aW9uICcke21ldGhvZH0nIGZhaWxlZDogJHttZXNzYWdlVGV4dH1gKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiB0aGlzLmNyZWF0ZUVycm9yUmVzcG9uc2UocmVxdWVzdElkLCAtMzI2MDMsIG1lc3NhZ2VUZXh0KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByaXZhdGUgaGFuZGxlTm90aWZpY2F0aW9uKFxuICAgICAgICBtZXRob2Q6IHN0cmluZyxcbiAgICAgICAgcGFyYW1zOiBhbnksXG4gICAgICAgIHNlc3Npb246IE1DUFNlc3Npb24gfCBudWxsLFxuICAgICAgICByZXE6IGh0dHAuSW5jb21pbmdNZXNzYWdlXG4gICAgKTogdm9pZCB7XG4gICAgICAgIHN3aXRjaCAobWV0aG9kKSB7XG4gICAgICAgICAgICBjYXNlICdpbml0aWFsaXplZCc6XG4gICAgICAgICAgICBjYXNlICdub3RpZmljYXRpb25zL2luaXRpYWxpemVkJzpcbiAgICAgICAgICAgICAgICBpZiAoc2Vzc2lvbikge1xuICAgICAgICAgICAgICAgICAgICBzZXNzaW9uLmluaXRpYWxpemVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy50b3VjaFNlc3Npb24oc2Vzc2lvbiwgcmVxKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtNQ1BTZXJ2ZXJdW3Byb3RvY29sXSBSZWNlaXZlZCBpbml0aWFsaXplZCBub3RpZmljYXRpb24gZm9yIHNlc3Npb24gJHtzZXNzaW9uPy5pZCB8fCAndW5rbm93bid9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgY2FzZSAnbm90aWZpY2F0aW9ucy9jYW5jZWxsZWQnOlxuICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbTUNQU2VydmVyXVtwcm90b2NvbF0gUmVjZWl2ZWQgY2FuY2VsbGVkIG5vdGlmaWNhdGlvbjogJHtKU09OLnN0cmluZ2lmeShwYXJhbXMgfHwge30pfWApO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgY29uc29sZS5sb2coYFtNQ1BTZXJ2ZXJdW3Byb3RvY29sXSBJZ25vcmVkIG5vdGlmaWNhdGlvbjogJHttZXRob2R9YCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjcmVhdGVSZXN1bHRSZXNwb25zZShpZDogTUNQUmVxdWVzdElkLCByZXN1bHQ6IGFueSk6IE1DUEpTT05SUENSZXNwb25zZSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBqc29ucnBjOiAnMi4wJyxcbiAgICAgICAgICAgIGlkLFxuICAgICAgICAgICAgcmVzdWx0XG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBjcmVhdGVFcnJvclJlc3BvbnNlKGlkOiBNQ1BSZXF1ZXN0SWQsIGNvZGU6IG51bWJlciwgbWVzc2FnZTogc3RyaW5nKTogTUNQSlNPTlJQQ1Jlc3BvbnNlIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgICAgICAgaWQsXG4gICAgICAgICAgICBlcnJvcjoge1xuICAgICAgICAgICAgICAgIGNvZGUsXG4gICAgICAgICAgICAgICAgbWVzc2FnZVxuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuICAgIH1cblxuICAgIHByaXZhdGUgZml4Q29tbW9uSnNvbklzc3Vlcyhqc29uU3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICAgICAgICBsZXQgZml4ZWQgPSBqc29uU3RyO1xuXG4gICAgICAgIC8vIEZpeCBjb21tb24gZXNjYXBlIGNoYXJhY3RlciBpc3N1ZXNcbiAgICAgICAgZml4ZWQgPSBmaXhlZFxuICAgICAgICAgICAgLy8gRml4IHVuZXNjYXBlZCBxdW90ZXMgaW4gc3RyaW5nc1xuICAgICAgICAgICAgLnJlcGxhY2UoLyhbXlxcXFxdKVwiKFteXCJdKlteXFxcXF0pXCIoW14sfVxcXTpdKS9nLCAnJDFcXFxcXCIkMlxcXFxcIiQzJylcbiAgICAgICAgICAgIC8vIEZpeCB1bmVzY2FwZWQgYmFja3NsYXNoZXNcbiAgICAgICAgICAgIC5yZXBsYWNlKC8oW15cXFxcXSlcXFxcKFteXCJcXFxcXFwvYmZucnRdKS9nLCAnJDFcXFxcXFxcXCQyJylcbiAgICAgICAgICAgIC8vIEZpeCB0cmFpbGluZyBjb21tYXNcbiAgICAgICAgICAgIC5yZXBsYWNlKC8sKFxccypbfVxcXV0pL2csICckMScpXG4gICAgICAgICAgICAvLyBGaXggc2luZ2xlIHF1b3RlcyAoc2hvdWxkIGJlIGRvdWJsZSBxdW90ZXMpXG4gICAgICAgICAgICAucmVwbGFjZSgvJy9nLCAnXCInKVxuICAgICAgICAgICAgLy8gRml4IGNvbW1vbiBjb250cm9sIGNoYXJhY3RlcnNcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXG4vZywgJ1xcXFxuJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHIvZywgJ1xcXFxyJylcbiAgICAgICAgICAgIC5yZXBsYWNlKC9cXHQvZywgJ1xcXFx0Jyk7XG5cbiAgICAgICAgcmV0dXJuIGZpeGVkO1xuICAgIH1cblxuICAgIHB1YmxpYyBzdG9wKCk6IHZvaWQge1xuICAgICAgICBpZiAodGhpcy5odHRwU2VydmVyKSB7XG4gICAgICAgICAgICB0aGlzLmh0dHBTZXJ2ZXIuY2xvc2UoKTtcbiAgICAgICAgICAgIHRoaXMuaHR0cFNlcnZlciA9IG51bGw7XG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW01DUFNlcnZlcl0gSFRUUCBzZXJ2ZXIgc3RvcHBlZCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChjb25zdCB0aW1lciBvZiB0aGlzLnN0cmVhbUhlYXJ0YmVhdFRpbWVycy52YWx1ZXMoKSkge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aW1lcik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zdHJlYW1IZWFydGJlYXRUaW1lcnMuY2xlYXIoKTtcblxuICAgICAgICBmb3IgKGNvbnN0IFtzZXNzaW9uSWQsIGNvbm5lY3Rpb25zXSBvZiB0aGlzLnN0cmVhbUNvbm5lY3Rpb25zLmVudHJpZXMoKSkge1xuICAgICAgICAgICAgZm9yIChjb25zdCBjb25uZWN0aW9uIG9mIGNvbm5lY3Rpb25zLnZhbHVlcygpKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFjb25uZWN0aW9uLndyaXRhYmxlRW5kZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgY29ubmVjdGlvbi5lbmQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnN0cmVhbUNvbm5lY3Rpb25zLmRlbGV0ZShzZXNzaW9uSWQpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuc3RyZWFtQ29ubmVjdGlvbnMuY2xlYXIoKTtcbiAgICAgICAgdGhpcy5zZXNzaW9ucy5jbGVhcigpO1xuICAgIH1cblxuICAgIHB1YmxpYyBnZXRTdGF0dXMoKTogU2VydmVyU3RhdHVzIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIHJ1bm5pbmc6ICEhdGhpcy5odHRwU2VydmVyLFxuICAgICAgICAgICAgcG9ydDogdGhpcy5zZXR0aW5ncy5wb3J0LFxuICAgICAgICAgICAgY2xpZW50czogdGhpcy5zZXNzaW9ucy5zaXplXG4gICAgICAgIH07XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBhc3luYyBoYW5kbGVTaW1wbGVBUElSZXF1ZXN0KHJlcTogaHR0cC5JbmNvbWluZ01lc3NhZ2UsIHJlczogaHR0cC5TZXJ2ZXJSZXNwb25zZSwgcGF0aG5hbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICAgICAgICBsZXQgYm9keSA9ICcnO1xuXG4gICAgICAgIHJlcS5vbignZGF0YScsIChjaHVuaykgPT4ge1xuICAgICAgICAgICAgYm9keSArPSBjaHVuay50b1N0cmluZygpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXEub24oJ2VuZCcsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgLy8gRXh0cmFjdCB0b29sIG5hbWUgZnJvbSBwYXRoIGxpa2UgL2FwaS9ub2RlL3NldF9wb3NpdGlvblxuICAgICAgICAgICAgICAgIGNvbnN0IHBhdGhQYXJ0cyA9IHBhdGhuYW1lLnNwbGl0KCcvJykuZmlsdGVyKHAgPT4gcCk7XG4gICAgICAgICAgICAgICAgaWYgKHBhdGhQYXJ0cy5sZW5ndGggPCAzKSB7XG4gICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAgICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoNDAwKTtcbiAgICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnSW52YWxpZCBBUEkgcGF0aC4gVXNlIC9hcGkve2NhdGVnb3J5fS97dG9vbF9uYW1lfScgfSkpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgY2F0ZWdvcnkgPSBwYXRoUGFydHNbMV07XG4gICAgICAgICAgICAgICAgY29uc3QgdG9vbE5hbWUgPSBwYXRoUGFydHNbMl07XG4gICAgICAgICAgICAgICAgY29uc3QgZnVsbFRvb2xOYW1lID0gYCR7Y2F0ZWdvcnl9XyR7dG9vbE5hbWV9YDtcblxuICAgICAgICAgICAgICAgIC8vIFBhcnNlIHBhcmFtZXRlcnMgd2l0aCBlbmhhbmNlZCBlcnJvciBoYW5kbGluZ1xuICAgICAgICAgICAgICAgIGxldCBwYXJhbXM7XG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgcGFyYW1zID0gYm9keSA/IEpTT04ucGFyc2UoYm9keSkgOiB7fTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChwYXJzZUVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVHJ5IHRvIGZpeCBKU09OIGlzc3Vlc1xuICAgICAgICAgICAgICAgICAgICBjb25zdCBmaXhlZEJvZHkgPSB0aGlzLmZpeENvbW1vbkpzb25Jc3N1ZXMoYm9keSk7XG4gICAgICAgICAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwYXJhbXMgPSBKU09OLnBhcnNlKGZpeGVkQm9keSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLmxvZygnW01DUFNlcnZlcl0gRml4ZWQgQVBJIEpTT04gcGFyc2luZyBpc3N1ZScpO1xuICAgICAgICAgICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDQwMCk7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBlcnJvcjogJ0ludmFsaWQgSlNPTiBpbiByZXF1ZXN0IGJvZHknLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRldGFpbHM6IHBhcnNlRXJyb3IubWVzc2FnZSxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWNlaXZlZEJvZHk6IGJvZHkuc3Vic3RyaW5nKDAsIDIwMClcbiAgICAgICAgICAgICAgICAgICAgICAgIH0pKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIEV4ZWN1dGUgdG9vbFxuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZXhlY3V0ZVRvb2xDYWxsKGZ1bGxUb29sTmFtZSwgcGFyYW1zKTtcblxuICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCgyMDApO1xuICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgICAgICAgICAgICB0b29sOiBmdWxsVG9vbE5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHJlc3VsdDogcmVzdWx0XG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ1NpbXBsZSBBUEkgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG4gICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg1MDApO1xuICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICAgICAgZXJyb3I6IGVycm9yLm1lc3NhZ2UsXG4gICAgICAgICAgICAgICAgICAgIHRvb2w6IHBhdGhuYW1lXG4gICAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdldFNpbXBsaWZpZWRUb29sc0xpc3QoKTogYW55W10ge1xuICAgICAgICByZXR1cm4gdGhpcy50b29sc0xpc3QubWFwKHRvb2wgPT4ge1xuICAgICAgICAgICAgY29uc3QgcGFydHMgPSB0b29sLm5hbWUuc3BsaXQoJ18nKTtcbiAgICAgICAgICAgIGNvbnN0IGNhdGVnb3J5ID0gcGFydHNbMF07XG4gICAgICAgICAgICBjb25zdCB0b29sTmFtZSA9IHBhcnRzLnNsaWNlKDEpLmpvaW4oJ18nKTtcblxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBuYW1lOiB0b29sLm5hbWUsXG4gICAgICAgICAgICAgICAgY2F0ZWdvcnk6IGNhdGVnb3J5LFxuICAgICAgICAgICAgICAgIHRvb2xOYW1lOiB0b29sTmFtZSxcbiAgICAgICAgICAgICAgICBkZXNjcmlwdGlvbjogdG9vbC5kZXNjcmlwdGlvbixcbiAgICAgICAgICAgICAgICBhcGlQYXRoOiBgL2FwaS8ke2NhdGVnb3J5fS8ke3Rvb2xOYW1lfWAsXG4gICAgICAgICAgICAgICAgY3VybEV4YW1wbGU6IHRoaXMuZ2VuZXJhdGVDdXJsRXhhbXBsZShjYXRlZ29yeSwgdG9vbE5hbWUsIHRvb2wuaW5wdXRTY2hlbWEpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBwcml2YXRlIGdlbmVyYXRlQ3VybEV4YW1wbGUoY2F0ZWdvcnk6IHN0cmluZywgdG9vbE5hbWU6IHN0cmluZywgc2NoZW1hOiBhbnkpOiBzdHJpbmcge1xuICAgICAgICAvLyBHZW5lcmF0ZSBzYW1wbGUgcGFyYW1ldGVycyBiYXNlZCBvbiBzY2hlbWFcbiAgICAgICAgY29uc3Qgc2FtcGxlUGFyYW1zID0gdGhpcy5nZW5lcmF0ZVNhbXBsZVBhcmFtcyhzY2hlbWEpO1xuICAgICAgICBjb25zdCBqc29uU3RyaW5nID0gSlNPTi5zdHJpbmdpZnkoc2FtcGxlUGFyYW1zLCBudWxsLCAyKTtcblxuICAgICAgICByZXR1cm4gYGN1cmwgLVggUE9TVCBodHRwOi8vMTI3LjAuMC4xOjg1ODUvYXBpLyR7Y2F0ZWdvcnl9LyR7dG9vbE5hbWV9IFxcXFxcbiAgLUggXCJDb250ZW50LVR5cGU6IGFwcGxpY2F0aW9uL2pzb25cIiBcXFxcXG4gIC1kICcke2pzb25TdHJpbmd9J2A7XG4gICAgfVxuXG4gICAgcHJpdmF0ZSBnZW5lcmF0ZVNhbXBsZVBhcmFtcyhzY2hlbWE6IGFueSk6IGFueSB7XG4gICAgICAgIGlmICghc2NoZW1hIHx8ICFzY2hlbWEucHJvcGVydGllcykgcmV0dXJuIHt9O1xuXG4gICAgICAgIGNvbnN0IHNhbXBsZTogYW55ID0ge307XG4gICAgICAgIGZvciAoY29uc3QgW2tleSwgcHJvcF0gb2YgT2JqZWN0LmVudHJpZXMoc2NoZW1hLnByb3BlcnRpZXMgYXMgYW55KSkge1xuICAgICAgICAgICAgY29uc3QgcHJvcFNjaGVtYSA9IHByb3AgYXMgYW55O1xuICAgICAgICAgICAgc3dpdGNoIChwcm9wU2NoZW1hLnR5cGUpIHtcbiAgICAgICAgICAgICAgICBjYXNlICdzdHJpbmcnOlxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVba2V5XSA9IHByb3BTY2hlbWEuZGVmYXVsdCB8fCAnZXhhbXBsZV9zdHJpbmcnO1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBjYXNlICdudW1iZXInOlxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVba2V5XSA9IHByb3BTY2hlbWEuZGVmYXVsdCB8fCA0MjtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgY2FzZSAnYm9vbGVhbic6XG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZVtrZXldID0gcHJvcFNjaGVtYS5kZWZhdWx0IHx8IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgIGNhc2UgJ29iamVjdCc6XG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZVtrZXldID0gcHJvcFNjaGVtYS5kZWZhdWx0IHx8IHsgeDogMCwgeTogMCwgejogMCB9O1xuICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICBzYW1wbGVba2V5XSA9ICdleGFtcGxlX3ZhbHVlJztcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc2FtcGxlO1xuICAgIH1cblxuICAgIHB1YmxpYyB1cGRhdGVTZXR0aW5ncyhzZXR0aW5nczogTUNQU2VydmVyU2V0dGluZ3MpIHtcbiAgICAgICAgdGhpcy5zZXR0aW5ncyA9IHNldHRpbmdzO1xuICAgICAgICBpZiAodGhpcy5odHRwU2VydmVyKSB7XG4gICAgICAgICAgICB0aGlzLnN0b3AoKTtcbiAgICAgICAgICAgIHRoaXMuc3RhcnQoKTtcbiAgICAgICAgfVxuICAgIH1cbn1cclxuIl19