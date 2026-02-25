import * as http from 'http';
import * as url from 'url';
import { v4 as uuidv4 } from 'uuid';
import {
    MCPServerSettings,
    ServerStatus,
    MCPClient,
    ToolDefinition,
    MCPSession,
    MCPJSONRPCMessage,
    MCPJSONRPCResponse,
    MCPRequestId
} from './types';
import { SceneTools } from './tools/scene-tools';
import { NodeTools } from './tools/node-tools';
import { ComponentTools } from './tools/component-tools';
import { PrefabTools } from './tools/prefab-tools';
import { ProjectTools } from './tools/project-tools';
import { DebugTools } from './tools/debug-tools';
import { PreferencesTools } from './tools/preferences-tools';
import { ServerTools } from './tools/server-tools';
import { BroadcastTools } from './tools/broadcast-tools';
import { SceneAdvancedTools } from './tools/scene-advanced-tools';
import { SceneViewTools } from './tools/scene-view-tools';
import { ReferenceImageTools } from './tools/reference-image-tools';
import { AssetAdvancedTools } from './tools/asset-advanced-tools';
import { ValidationTools } from './tools/validation-tools';

type ParsedMCPPayload = {
    messages: MCPJSONRPCMessage[];
    isBatch: boolean;
};

export class MCPServer {
    private readonly mcpProtocolVersion = '2024-11-05';
    private readonly mcpServerVersion = '1.0.0';
    private readonly sseKeepAliveMs = 15000;

    private settings: MCPServerSettings;
    private httpServer: http.Server | null = null;
    private tools: Record<string, any> = {};
    private toolsList: ToolDefinition[] = [];
    private enabledTools: any[] = []; // 存储启用的工具列表
    private sessions: Map<string, MCPSession> = new Map();
    private streamConnections: Map<string, Set<http.ServerResponse>> = new Map();
    private streamHeartbeatTimers: Map<http.ServerResponse, NodeJS.Timeout> = new Map();

    constructor(settings: MCPServerSettings) {
        this.settings = settings;
        this.initializeTools();
    }

    private initializeTools(): void {
        try {
            console.log('[MCPServer] Initializing tools...');
            this.tools.scene = new SceneTools();
            this.tools.node = new NodeTools();
            this.tools.component = new ComponentTools();
            this.tools.prefab = new PrefabTools();
            this.tools.project = new ProjectTools();
            this.tools.debug = new DebugTools();
            this.tools.preferences = new PreferencesTools();
            this.tools.server = new ServerTools();
            this.tools.broadcast = new BroadcastTools();
            this.tools.sceneAdvanced = new SceneAdvancedTools();
            this.tools.sceneView = new SceneViewTools();
            this.tools.referenceImage = new ReferenceImageTools();
            this.tools.assetAdvanced = new AssetAdvancedTools();
            this.tools.validation = new ValidationTools();
            console.log('[MCPServer] Tools initialized successfully');
        } catch (error) {
            console.error('[MCPServer] Error initializing tools:', error);
            throw error;
        }
    }

    public async start(): Promise<void> {
        if (this.httpServer) {
            console.log('[MCPServer] Server is already running');
            return;
        }

        try {
            console.log(`[MCPServer] Starting HTTP server on port ${this.settings.port}...`);
            this.httpServer = http.createServer(this.handleHttpRequest.bind(this));

            await new Promise<void>((resolve, reject) => {
                this.httpServer!.listen(this.settings.port, '127.0.0.1', () => {
                    console.log(`[MCPServer] ✅ HTTP server started successfully on http://127.0.0.1:${this.settings.port}`);
                    console.log(`[MCPServer] Health check: http://127.0.0.1:${this.settings.port}/health`);
                    console.log(`[MCPServer] MCP endpoint: http://127.0.0.1:${this.settings.port}/mcp`);
                    resolve();
                });
                this.httpServer!.on('error', (err: any) => {
                    console.error('[MCPServer] ❌ Failed to start server:', err);
                    if (err.code === 'EADDRINUSE') {
                        console.error(`[MCPServer] Port ${this.settings.port} is already in use. Please change the port in settings.`);
                    }
                    reject(err);
                });
            });

            this.setupTools();
            console.log('[MCPServer] 🚀 MCP Server is ready for connections');
        } catch (error) {
            console.error('[MCPServer] ❌ Failed to start server:', error);
            throw error;
        }
    }

    private setupTools(): void {
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
        } else {
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

    public getFilteredTools(enabledTools: any[]): ToolDefinition[] {
        if (!enabledTools || enabledTools.length === 0) {
            return this.toolsList; // 如果没有过滤配置，返回所有工具
        }

        const enabledToolNames = new Set(enabledTools.map(tool => `${tool.category}_${tool.name}`));
        return this.toolsList.filter(tool => enabledToolNames.has(tool.name));
    }

    public async executeToolCall(toolName: string, args: any): Promise<any> {
        const parts = toolName.split('_');
        const category = parts[0];
        const toolMethodName = parts.slice(1).join('_');

        // Discovery tools are handled by MCPServer directly.
        if (category === 'server' && (
            toolMethodName === 'search_tools' ||
            toolMethodName === 'list_tool_categories' ||
            toolMethodName === 'get_tool_detail'
        )) {
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

    public getClients(): MCPClient[] {
        return Array.from(this.sessions.values()).map(session => ({
            id: session.id,
            lastActivity: session.lastActivity,
            userAgent: session.userAgent
        }));
    }

    public getAvailableTools(): ToolDefinition[] {
        return this.toolsList;
    }

    private isToolExposed(toolName: string): boolean {
        return this.toolsList.some(tool => tool.name === toolName);
    }

    private getAllToolDefinitions(): ToolDefinition[] {
        const allTools: ToolDefinition[] = [];

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

    private async executeDiscoveryToolCall(toolMethodName: string, args: any): Promise<any> {
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

    private searchTools(args: any): any {
        const keywordRaw = typeof args?.keyword === 'string' ? args.keyword : '';
        const keyword = keywordRaw.trim().toLowerCase();
        if (!keyword) {
            return {
                success: false,
                error: 'keyword is required'
            };
        }

        const categoryFilter = typeof args?.category === 'string' ? args.category.trim() : '';
        const includeDisabled = args?.includeDisabled !== false;
        const limit = Math.min(Math.max(Number(args?.limit) || 10, 1), 50);
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

    private calculateToolMatchScore(keyword: string, category: string, toolName: string, description: string): number {
        const fullName = `${category}_${toolName}`.toLowerCase();
        const descriptionLower = (description || '').toLowerCase();
        const tokens = keyword.split(/[\s_-]+/).filter(Boolean);
        let score = 0;

        if (fullName === keyword) score += 120;
        if (toolName.toLowerCase() === keyword) score += 100;
        if (category.toLowerCase() === keyword) score += 80;
        if (fullName.startsWith(keyword)) score += 70;
        if (toolName.toLowerCase().includes(keyword)) score += 60;
        if (descriptionLower.includes(keyword)) score += 35;

        for (const token of tokens) {
            if (toolName.toLowerCase().includes(token)) score += 12;
            if (descriptionLower.includes(token)) score += 6;
            if (category.toLowerCase() === token) score += 10;
        }

        return score;
    }

    private listToolCategories(_args: any): any {
        const enabledToolNames = new Set(this.toolsList.map(tool => tool.name));
        const categories = new Map<string, { category: string; totalTools: number; enabledTools: number }>();

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

    private getToolDetail(args: any): any {
        const toolName = typeof args?.name === 'string' ? args.name.trim() : '';
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

    public updateEnabledTools(enabledTools: any[]): void {
        console.log(`[MCPServer] Updating enabled tools: ${enabledTools.length} tools`);
        this.enabledTools = enabledTools;
        this.setupTools(); // 重新设置工具列表
    }

    public getSettings(): MCPServerSettings {
        return this.settings;
    }

    private setCommonResponseHeaders(res: http.ServerResponse): void {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Mcp-Session-Id, Last-Event-ID');
        res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
    }

    private async handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
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
            } else if (pathname === '/mcp' && req.method === 'POST') {
                await this.handleMCPRequest(req, res);
            } else if (pathname === '/health' && req.method === 'GET') {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(200);
                res.end(JSON.stringify({
                    status: 'ok',
                    tools: this.toolsList.length,
                    sessions: this.sessions.size,
                    streams: this.streamConnections.size
                }));
            } else if (pathname?.startsWith('/api/') && req.method === 'POST') {
                await this.handleSimpleAPIRequest(req, res, pathname);
            } else if (pathname === '/api/tools' && req.method === 'GET') {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(200);
                res.end(JSON.stringify({ tools: this.getSimplifiedToolsList() }));
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Not found' }));
            }
        } catch (error) {
            console.error('[MCPServer][transport] HTTP request error:', error);
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }

    private async handleMCPStreamRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
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

        if (typeof (res as any).flushHeaders === 'function') {
            (res as any).flushHeaders();
        }

        this.registerStreamConnection(session.id, req, res);
        this.writeSSEComment(res, 'stream-open');
        console.log(`[MCPServer][transport] SSE stream connected: session=${session.id}`);
    }

    private registerStreamConnection(sessionId: string, req: http.IncomingMessage, res: http.ServerResponse): void {
        let connections = this.streamConnections.get(sessionId);
        if (!connections) {
            connections = new Set<http.ServerResponse>();
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

    private unregisterStreamConnection(sessionId: string, res: http.ServerResponse): void {
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

    private writeSSEComment(res: http.ServerResponse, text: string): void {
        if (res.writableEnded || res.destroyed) {
            return;
        }
        res.write(`: ${text}\n\n`);
    }

    private writeSSEEvent(res: http.ServerResponse, event: string, payload: any): void {
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

    private pushMessageToSession(sessionId: string, message: MCPJSONRPCResponse): void {
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

    private hasActiveStreamConnection(sessionId: string): boolean {
        const connections = this.streamConnections.get(sessionId);
        return !!connections && connections.size > 0;
    }

    private requestAcceptsEventStream(req: http.IncomingMessage): boolean {
        const accept = this.getHeaderValue(req, 'accept');
        return !!accept && accept.toLowerCase().includes('text/event-stream');
    }

    private getHeaderValue(req: http.IncomingMessage | undefined, headerName: string): string | undefined {
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

    private createSession(sessionId: string, req?: http.IncomingMessage): MCPSession {
        const now = new Date();
        const session: MCPSession = {
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

    private touchSession(session: MCPSession, req?: http.IncomingMessage): void {
        session.lastActivity = new Date();
        const userAgent = this.getHeaderValue(req, 'user-agent');
        if (userAgent) {
            session.userAgent = userAgent;
        }
    }

    private resolveSession(req: http.IncomingMessage, createIfMissing: boolean): MCPSession | null {
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

        return this.createSession(uuidv4(), req);
    }

    private async readRequestBody(req: http.IncomingMessage): Promise<string> {
        return await new Promise<string>((resolve, reject) => {
            let body = '';
            req.on('data', (chunk) => {
                body += chunk.toString();
            });
            req.on('end', () => resolve(body));
            req.on('error', reject);
        });
    }

    private parseMCPPayload(body: string): ParsedMCPPayload {
        let parsedBody: unknown;
        try {
            parsedBody = JSON.parse(body);
        } catch (parseError: any) {
            const fixedBody = this.fixCommonJsonIssues(body);
            try {
                parsedBody = JSON.parse(fixedBody);
                console.log('[MCPServer] Fixed JSON parsing issue');
            } catch {
                throw new Error(`JSON parsing failed: ${parseError.message}. Original body: ${body.substring(0, 500)}...`);
            }
        }

        if (Array.isArray(parsedBody)) {
            if (parsedBody.length === 0) {
                throw new Error('Batch request cannot be empty');
            }
            return {
                messages: parsedBody as MCPJSONRPCMessage[],
                isBatch: true
            };
        }

        if (!parsedBody || typeof parsedBody !== 'object') {
            throw new Error('Request body must be a JSON-RPC object or array');
        }

        return {
            messages: [parsedBody as MCPJSONRPCMessage],
            isBatch: false
        };
    }

    private async handleMCPRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        try {
            const rawBody = await this.readRequestBody(req);
            const { messages, isBatch } = this.parseMCPPayload(rawBody);
            const hasInitializeRequest = messages.some(message => message && typeof message === 'object' && message.method === 'initialize');
            const hasSessionHeader = !!this.getHeaderValue(req, 'mcp-session-id');

            const session = this.resolveSession(req, hasInitializeRequest || hasSessionHeader);
            if (hasInitializeRequest && session) {
                res.setHeader('Mcp-Session-Id', session.id);
            }

            const responses: MCPJSONRPCResponse[] = [];
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
        } catch (error: any) {
            console.error('[MCPServer][transport] Error handling MCP request:', error);
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(400);
            res.end(JSON.stringify(this.createErrorResponse(null, -32700, `Parse error: ${error.message}`)));
        }
    }

    private async handleMessage(
        message: MCPJSONRPCMessage,
        session: MCPSession | null,
        req: http.IncomingMessage
    ): Promise<MCPJSONRPCResponse | null> {
        if (!message || typeof message !== 'object' || Array.isArray(message)) {
            return this.createErrorResponse(null, -32600, 'Invalid Request: message must be an object');
        }

        const hasId = Object.prototype.hasOwnProperty.call(message, 'id');
        const isNotification = !hasId;
        const requestId: MCPRequestId = hasId ? (message.id ?? null) : null;
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
            let result: any;

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

                    const toolName = (params as any).name;
                    const args = Object.prototype.hasOwnProperty.call(params, 'arguments') ? (params as any).arguments : {};
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
        } catch (error: any) {
            const messageText = error instanceof Error ? error.message : String(error);
            if (isNotification) {
                console.warn(`[MCPServer][protocol] Notification '${method}' failed: ${messageText}`);
                return null;
            }
            return this.createErrorResponse(requestId, -32603, messageText);
        }
    }

    private handleNotification(
        method: string,
        params: any,
        session: MCPSession | null,
        req: http.IncomingMessage
    ): void {
        switch (method) {
            case 'initialized':
            case 'notifications/initialized':
                if (session) {
                    session.initialized = true;
                    this.touchSession(session, req);
                }
                console.log(`[MCPServer][protocol] Received initialized notification for session ${session?.id || 'unknown'}`);
                return;
            case 'notifications/cancelled':
                console.log(`[MCPServer][protocol] Received cancelled notification: ${JSON.stringify(params || {})}`);
                return;
            default:
                console.log(`[MCPServer][protocol] Ignored notification: ${method}`);
                return;
        }
    }

    private createResultResponse(id: MCPRequestId, result: any): MCPJSONRPCResponse {
        return {
            jsonrpc: '2.0',
            id,
            result
        };
    }

    private createErrorResponse(id: MCPRequestId, code: number, message: string): MCPJSONRPCResponse {
        return {
            jsonrpc: '2.0',
            id,
            error: {
                code,
                message
            }
        };
    }

    private fixCommonJsonIssues(jsonStr: string): string {
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

    public stop(): void {
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

    public getStatus(): ServerStatus {
        return {
            running: !!this.httpServer,
            port: this.settings.port,
            clients: this.sessions.size
        };
    }

    private async handleSimpleAPIRequest(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): Promise<void> {
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
                } catch (parseError: any) {
                    // Try to fix JSON issues
                    const fixedBody = this.fixCommonJsonIssues(body);
                    try {
                        params = JSON.parse(fixedBody);
                        console.log('[MCPServer] Fixed API JSON parsing issue');
                    } catch {
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
            } catch (error: any) {
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

    private getSimplifiedToolsList(): any[] {
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

    private generateCurlExample(category: string, toolName: string, schema: any): string {
        // Generate sample parameters based on schema
        const sampleParams = this.generateSampleParams(schema);
        const jsonString = JSON.stringify(sampleParams, null, 2);

        return `curl -X POST http://127.0.0.1:8585/api/${category}/${toolName} \\
  -H "Content-Type: application/json" \\
  -d '${jsonString}'`;
    }

    private generateSampleParams(schema: any): any {
        if (!schema || !schema.properties) return {};

        const sample: any = {};
        for (const [key, prop] of Object.entries(schema.properties as any)) {
            const propSchema = prop as any;
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

    public updateSettings(settings: MCPServerSettings) {
        this.settings = settings;
        if (this.httpServer) {
            this.stop();
            this.start();
        }
    }
}
