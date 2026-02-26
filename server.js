/**
 * IPv6监测结果展示平台 - 文件监控与自动解析服务
 * 
 * 功能：
 * 1. 持续监控data目录的文件变动
 * 2. 文件变动时自动触发解析流程
 * 3. 通过WebSocket实时通知前端更新
 * 4. 提供手动触发解析的API
 * 5. 完整的日志记录
 */

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs').promises;
const xlsx = require('xlsx');
const cors = require('cors');
const winston = require('winston');
const moment = require('moment');

// ==================== 日志配置 ====================
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ level, message, timestamp }) => {
            return `[${timestamp}] [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
    ]
});

// ==================== 配置 ====================
const CONFIG = {
    PORT: 3000,
    DATA_DIR: path.join(__dirname, 'data'),
    LOG_DIR: path.join(__dirname, 'logs'),
    DEBOUNCE_DELAY: 1000, // 防抖延迟（毫秒）
    SUPPORTED_EXTENSIONS: ['.xlsx']
};

// ==================== 全局状态 ====================
let fileWatcher = null;
let wss = null;
let isParsing = false;
let parseQueue = [];

// ==================== Express应用 ====================
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ==================== 文件解析器 ====================
class FileParser {
    constructor() {
        this.fileCache = new Map();
    }

    /**
     * 解析文件名
     */
    parseFilename(filename) {
        const nameWithoutExt = filename.replace(/\.xlsx$/i, '');
        const parts = nameWithoutExt.split('__');

        if (parts.length >= 4) {
            return {
                filename: filename,
                unitName: parts[0],
                website: parts[1],
                status: parts[2],
                code: parts[3],
                isDetailFile: true
            };
        }

        if (filename.includes('总体得分表')) {
            return {
                filename: filename,
                unitName: null,
                website: null,
                status: null,
                code: null,
                isDetailFile: false,
                isOverallFile: true
            };
        }

        return null;
    }

    /**
     * 扫描目录并建立映射
     */
    async scanFiles() {
        logger.info('开始扫描文件...');
        const startTime = Date.now();

        try {
            const files = await fs.readdir(CONFIG.DATA_DIR);
            const xlsxFiles = files.filter(f => 
                CONFIG.SUPPORTED_EXTENSIONS.some(ext => f.toLowerCase().endsWith(ext))
            );

            const result = {
                detailFiles: [],
                overallFile: null,
                timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
                totalFiles: xlsxFiles.length
            };

            for (const filename of xlsxFiles) {
                const fileInfo = this.parseFilename(filename);
                if (fileInfo) {
                    if (fileInfo.isOverallFile) {
                        result.overallFile = fileInfo;
                        logger.info(`发现总体得分表: ${filename}`);
                    } else if (fileInfo.isDetailFile) {
                        result.detailFiles.push(fileInfo);
                    }
                }
            }

            // 保存文件列表
            await this.saveFileList(xlsxFiles);
            
            // 保存映射报告
            await this.saveMappingReport(result);

            const duration = Date.now() - startTime;
            logger.info(`文件扫描完成，共 ${xlsxFiles.length} 个文件，耗时 ${duration}ms`);

            return result;
        } catch (error) {
            logger.error(`扫描文件失败: ${error.message}`);
            throw error;
        }
    }

    /**
     * 保存文件列表
     */
    async saveFileList(files) {
        const fileListPath = path.join(CONFIG.DATA_DIR, 'file_list.json');
        await fs.writeFile(fileListPath, JSON.stringify(files, null, 2), 'utf-8');
        logger.info(`文件列表已更新: ${fileListPath}`);
    }

    /**
     * 保存映射报告
     */
    async saveMappingReport(data) {
        const reportPath = path.join(CONFIG.DATA_DIR, 'mapping_report.json');
        await fs.writeFile(reportPath, JSON.stringify(data, null, 2), 'utf-8');
        
        // 同时生成文本报告
        const textReportPath = path.join(CONFIG.DATA_DIR, 'mapping_report.txt');
        let textReport = '='.repeat(60) + '\n';
        textReport += '单位名称与详情文件映射关系报告\n';
        textReport += `生成时间: ${data.timestamp}\n`;
        textReport += '='.repeat(60) + '\n\n';
        
        if (data.overallFile) {
            textReport += `总体得分表: ${data.overallFile.filename}\n\n`;
        }
        
        textReport += `详情文件数量: ${data.detailFiles.length}\n`;
        textReport += `单位数量: ${new Set(data.detailFiles.map(f => f.unitName)).size}\n\n`;
        textReport += '-'.repeat(60) + '\n';
        textReport += '详细映射关系:\n';
        textReport += '-'.repeat(60) + '\n\n';

        // 按单位名称分组
        const unitMap = new Map();
        for (const file of data.detailFiles) {
            if (!unitMap.has(file.unitName)) {
                unitMap.set(file.unitName, []);
            }
            unitMap.get(file.unitName).push(file);
        }

        for (const [unitName, files] of unitMap) {
            textReport += `\n【${unitName}】\n`;
            files.forEach((file, idx) => {
                textReport += `  [${idx + 1}] ${file.filename}\n`;
                textReport += `      网站: ${file.website}\n`;
                textReport += `      状态: ${file.status}\n`;
                textReport += `      标识: ${file.code}\n`;
            });
        }

        await fs.writeFile(textReportPath, textReport, 'utf-8');
        logger.info(`映射报告已更新: ${reportPath}`);
    }

    /**
     * 解析Excel文件内容
     */
    async parseExcelFile(filename) {
        const filePath = path.join(CONFIG.DATA_DIR, filename);
        
        try {
            const workbook = xlsx.readFile(filePath);
            const result = {
                filename: filename,
                sheets: [],
                parseTime: moment().format('YYYY-MM-DD HH:mm:ss')
            };

            for (const sheetName of workbook.SheetNames) {
                const worksheet = workbook.Sheets[sheetName];
                const data = xlsx.utils.sheet_to_json(worksheet);
                result.sheets.push({
                    name: sheetName,
                    rowCount: data.length,
                    columns: data.length > 0 ? Object.keys(data[0]) : [],
                    sample: data.slice(0, 3) // 前3行作为示例
                });
            }

            return result;
        } catch (error) {
            logger.error(`解析Excel文件失败 ${filename}: ${error.message}`);
            throw error;
        }
    }
}

// ==================== WebSocket管理器 ====================
class WebSocketManager {
    constructor(server) {
        this.wss = new WebSocket.Server({ server });
        this.clients = new Set();
        this.setupWebSocket();
    }

    setupWebSocket() {
        this.wss.on('connection', (ws, req) => {
            const clientIp = req.socket.remoteAddress;
            logger.info(`WebSocket客户端连接: ${clientIp}`);
            this.clients.add(ws);

            // 发送欢迎消息
            this.sendToClient(ws, {
                type: 'connected',
                message: '已连接到文件监控服务',
                timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
            });

            ws.on('close', () => {
                logger.info(`WebSocket客户端断开: ${clientIp}`);
                this.clients.delete(ws);
            });

            ws.on('error', (error) => {
                logger.error(`WebSocket错误: ${error.message}`);
                this.clients.delete(ws);
            });

            // 处理客户端消息
            ws.on('message', async (message) => {
                try {
                    const data = JSON.parse(message);
                    await this.handleClientMessage(ws, data);
                } catch (error) {
                    logger.error(`处理客户端消息失败: ${error.message}`);
                }
            });
        });
    }

    async handleClientMessage(ws, data) {
        switch (data.type) {
            case 'ping':
                this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
                break;
            case 'requestScan':
                logger.info('客户端请求手动扫描');
                await triggerParse('manual');
                break;
            default:
                logger.warn(`未知消息类型: ${data.type}`);
        }
    }

    sendToClient(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    broadcast(data) {
        const message = JSON.stringify(data);
        let sentCount = 0;
        
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
                sentCount++;
            }
        });

        logger.info(`广播消息已发送给 ${sentCount} 个客户端`);
    }

    getClientCount() {
        return this.clients.size;
    }
}

// ==================== 文件监控器 ====================
class FileWatcher {
    constructor(parser, wsManager) {
        this.parser = parser;
        this.wsManager = wsManager;
        this.watcher = null;
        this.debounceTimer = null;
    }

    start() {
        logger.info(`开始监控目录: ${CONFIG.DATA_DIR}`);

        this.watcher = chokidar.watch(CONFIG.DATA_DIR, {
            ignored: /(^|[\/\\])\../, // 忽略隐藏文件
            persistent: true,
            ignoreInitial: true, // 忽略初始扫描
            awaitWriteFinish: {
                stabilityThreshold: 2000,
                pollInterval: 100
            }
        });

        this.watcher
            .on('add', (filePath) => this.handleFileChange('add', filePath))
            .on('change', (filePath) => this.handleFileChange('change', filePath))
            .on('unlink', (filePath) => this.handleFileChange('unlink', filePath))
            .on('error', (error) => logger.error(`监控错误: ${error.message}`))
            .on('ready', () => logger.info('文件监控已就绪'));
    }

    handleFileChange(eventType, filePath) {
        const filename = path.basename(filePath);
        
        // 只处理Excel文件
        if (!CONFIG.SUPPORTED_EXTENSIONS.some(ext => filename.toLowerCase().endsWith(ext))) {
            return;
        }

        logger.info(`检测到文件变动 [${eventType}]: ${filename}`);

        // 防抖处理
        clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            triggerParse(eventType, filename);
        }, CONFIG.DEBOUNCE_DELAY);
    }

    stop() {
        if (this.watcher) {
            this.watcher.close();
            logger.info('文件监控已停止');
        }
    }
}

// ==================== 解析触发器 ====================
async function triggerParse(triggerType, filename = null) {
    if (isParsing) {
        logger.info('解析正在进行中，加入队列');
        parseQueue.push({ triggerType, filename });
        return;
    }

    isParsing = true;
    const startTime = Date.now();

    try {
        logger.info(`开始解析流程 [触发方式: ${triggerType}]`);

        // 广播开始解析消息
        wss.broadcast({
            type: 'parseStart',
            triggerType: triggerType,
            filename: filename,
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
            message: filename ? `正在处理文件: ${filename}` : '正在扫描所有文件...'
        });

        // 执行文件扫描
        const result = await parser.scanFiles();

        // 如果有总体得分表，解析它
        if (result.overallFile) {
            logger.info(`解析总体得分表: ${result.overallFile.filename}`);
            const overallData = await parser.parseExcelFile(result.overallFile.filename);
            result.overallData = overallData;
        }

        const duration = Date.now() - startTime;

        // 广播解析完成消息
        wss.broadcast({
            type: 'parseComplete',
            triggerType: triggerType,
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
            duration: duration,
            summary: {
                totalFiles: result.totalFiles,
                detailFiles: result.detailFiles.length,
                overallFile: result.overallFile ? 1 : 0
            },
            message: `解析完成，共 ${result.totalFiles} 个文件，耗时 ${duration}ms`
        });

        logger.info(`解析完成，耗时 ${duration}ms`);

    } catch (error) {
        logger.error(`解析失败: ${error.message}`);
        
        wss.broadcast({
            type: 'parseError',
            triggerType: triggerType,
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
            error: error.message
        });
    } finally {
        isParsing = false;

        // 处理队列中的下一个任务
        if (parseQueue.length > 0) {
            const next = parseQueue.shift();
            setTimeout(() => triggerParse(next.triggerType, next.filename), 100);
        }
    }
}

// ==================== API路由 ====================

// 获取文件列表
app.get('/api/files', async (req, res) => {
    try {
        const fileListPath = path.join(CONFIG.DATA_DIR, 'file_list.json');
        const data = await fs.readFile(fileListPath, 'utf-8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: '无法读取文件列表' });
    }
});

// 获取映射报告
app.get('/api/mapping', async (req, res) => {
    try {
        const reportPath = path.join(CONFIG.DATA_DIR, 'mapping_report.json');
        const data = await fs.readFile(reportPath, 'utf-8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: '无法读取映射报告' });
    }
});

// 手动触发扫描
app.post('/api/scan', async (req, res) => {
    try {
        await triggerParse('api');
        res.json({ success: true, message: '扫描已触发' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 获取系统状态
app.get('/api/status', (req, res) => {
    res.json({
        isParsing: isParsing,
        queueLength: parseQueue.length,
        connectedClients: wss ? wss.getClientCount() : 0,
        uptime: process.uptime(),
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    });
});

// 获取日志
app.get('/api/logs', async (req, res) => {
    try {
        const logPath = path.join(CONFIG.LOG_DIR, 'combined.log');
        const data = await fs.readFile(logPath, 'utf-8');
        const lines = data.split('\n').filter(line => line.trim());
        const limit = parseInt(req.query.limit) || 100;
        res.json(lines.slice(-limit));
    } catch (error) {
        res.status(500).json({ error: '无法读取日志' });
    }
});

// ==================== 初始化 ====================
const parser = new FileParser();

async function init() {
    // 创建必要的目录
    await fs.mkdir(CONFIG.LOG_DIR, { recursive: true });
    await fs.mkdir(CONFIG.DATA_DIR, { recursive: true });

    // 创建HTTP服务器
    const server = http.createServer(app);

    // 初始化WebSocket
    wss = new WebSocketManager(server);

    // 初始化文件监控
    const watcher = new FileWatcher(parser, wss);
    watcher.start();

    // 启动服务器
    server.listen(CONFIG.PORT, () => {
        logger.info(`=================================`);
        logger.info(`服务已启动`);
        logger.info(`HTTP端口: ${CONFIG.PORT}`);
        logger.info(`数据目录: ${CONFIG.DATA_DIR}`);
        logger.info(`=================================`);
    });

    // 初始扫描
    await triggerParse('initial');
}

// 优雅关闭
process.on('SIGINT', async () => {
    logger.info('正在关闭服务...');
    if (fileWatcher) {
        fileWatcher.stop();
    }
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    logger.error(`未捕获的异常: ${error.message}`);
    logger.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error(`未处理的Promise拒绝: ${reason}`);
});

// 启动
init().catch(error => {
    logger.error(`初始化失败: ${error.message}`);
    process.exit(1);
});
