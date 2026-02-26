/**
 * WebSocket客户端 - 实时接收文件变动通知
 */

class WebSocketClient {
    constructor() {
        this.ws = null;
        this.reconnectInterval = 5000;
        this.reconnectTimer = null;
        this.isConnected = false;
        this.messageHandlers = new Map();
        this.serverUrl = this.getWebSocketUrl();
    }

    getWebSocketUrl() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        // 使用3000端口（Node.js服务端口）
        const port = '3000';
        return `${protocol}//${host.split(':')[0]}:${port}`;
    }

    connect() {
        try {
            console.log('正在连接WebSocket服务器:', this.serverUrl);
            this.ws = new WebSocket(this.serverUrl);

            this.ws.onopen = () => {
                console.log('WebSocket连接成功');
                this.isConnected = true;
                this.hideConnectionStatus();
                this.emit('connected', {});
                
                // 发送ping保持连接
                this.startPing();
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('收到WebSocket消息:', data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('解析WebSocket消息失败:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket连接关闭');
                this.isConnected = false;
                this.stopPing();
                this.showConnectionStatus('disconnected');
                this.scheduleReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket错误:', error);
                this.showConnectionStatus('error');
            };
        } catch (error) {
            console.error('创建WebSocket连接失败:', error);
            this.scheduleReconnect();
        }
    }

    handleMessage(data) {
        // 根据消息类型处理
        switch (data.type) {
            case 'connected':
                this.showNotification(data.message, 'info');
                break;
            case 'parseStart':
                this.showNotification(data.message, 'info', 0);
                this.showLoading(true);
                break;
            case 'parseComplete':
                this.showNotification(data.message, 'success');
                this.showLoading(false);
                // 触发数据刷新
                this.emit('dataUpdated', data);
                break;
            case 'parseError':
                this.showNotification(`解析失败: ${data.error}`, 'error');
                this.showLoading(false);
                break;
            case 'pong':
                // 心跳响应
                break;
            default:
                console.log('未知消息类型:', data.type);
        }

        // 触发注册的事件处理器
        this.emit(data.type, data);
    }

    send(data) {
        if (this.isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        } else {
            console.warn('WebSocket未连接，无法发送消息');
        }
    }

    requestScan() {
        this.send({ type: 'requestScan' });
    }

    startPing() {
        this.pingTimer = setInterval(() => {
            this.send({ type: 'ping', timestamp: Date.now() });
        }, 30000);
    }

    stopPing() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
    }

    scheduleReconnect() {
        if (this.reconnectTimer) return;
        
        console.log(`${this.reconnectInterval / 1000}秒后尝试重新连接...`);
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
        }, this.reconnectInterval);
    }

    on(eventType, handler) {
        if (!this.messageHandlers.has(eventType)) {
            this.messageHandlers.set(eventType, []);
        }
        this.messageHandlers.get(eventType).push(handler);
    }

    off(eventType, handler) {
        if (this.messageHandlers.has(eventType)) {
            const handlers = this.messageHandlers.get(eventType);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    emit(eventType, data) {
        if (this.messageHandlers.has(eventType)) {
            this.messageHandlers.get(eventType).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('事件处理器错误:', error);
                }
            });
        }
    }

    showNotification(message, type = 'info', duration = 3000) {
        // 创建通知元素
        let notification = document.getElementById('wsNotification');
        if (!notification) {
            notification = document.createElement('div');
            notification.id = 'wsNotification';
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 24px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 1002;
                font-size: 14px;
                transition: all 0.3s ease;
                opacity: 0;
                transform: translateY(-20px);
                max-width: 400px;
                word-break: break-word;
            `;
            document.body.appendChild(notification);
        }

        // 设置颜色
        const colors = {
            info: { bg: '#1890ff', text: 'white' },
            success: { bg: '#52c41a', text: 'white' },
            error: { bg: '#f5222d', text: 'white' },
            warning: { bg: '#faad14', text: 'white' }
        };
        const color = colors[type] || colors.info;
        
        notification.style.background = color.bg;
        notification.style.color = color.text;
        notification.textContent = message;
        notification.style.opacity = '1';
        notification.style.transform = 'translateY(0)';

        // 自动隐藏
        if (duration > 0) {
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateY(-20px)';
            }, duration);
        }
    }

    showLoading(show) {
        let loadingOverlay = document.getElementById('wsLoadingOverlay');
        if (!loadingOverlay) {
            loadingOverlay = document.createElement('div');
            loadingOverlay.id = 'wsLoadingOverlay';
            loadingOverlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255, 255, 255, 0.8);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 1001;
                transition: opacity 0.3s ease;
            `;
            loadingOverlay.innerHTML = `
                <div style="
                    width: 48px;
                    height: 48px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #1890ff;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin-bottom: 16px;
                "></div>
                <p style="color: #262626; font-size: 14px;">正在解析文件...</p>
            `;
            document.body.appendChild(loadingOverlay);
        }

        loadingOverlay.style.opacity = show ? '1' : '0';
        loadingOverlay.style.pointerEvents = show ? 'auto' : 'none';
    }

    showConnectionStatus(status) {
        let statusIndicator = document.getElementById('wsStatusIndicator');
        if (!statusIndicator) {
            statusIndicator = document.createElement('div');
            statusIndicator.id = 'wsStatusIndicator';
            statusIndicator.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 12px;
                z-index: 1002;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 8px;
            `;
            document.body.appendChild(statusIndicator);
        }

        const configs = {
            connected: { bg: '#f6ffed', color: '#52c41a', text: '● 已连接', border: '1px solid #b7eb8f' },
            disconnected: { bg: '#fff2f0', color: '#f5222d', text: '● 未连接', border: '1px solid #ffa39e' },
            error: { bg: '#fff7e6', color: '#faad14', text: '● 连接错误', border: '1px solid #ffd591' }
        };

        const config = configs[status] || configs.disconnected;
        statusIndicator.style.background = config.bg;
        statusIndicator.style.color = config.color;
        statusIndicator.style.border = config.border;
        statusIndicator.textContent = config.text;
    }

    hideConnectionStatus() {
        const statusIndicator = document.getElementById('wsStatusIndicator');
        if (statusIndicator) {
            statusIndicator.style.opacity = '0';
        }
    }

    disconnect() {
        this.stopPing();
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.ws) {
            this.ws.close();
        }
    }
}

// 创建全局实例
const wsClient = new WebSocketClient();

// 页面加载时自动连接
document.addEventListener('DOMContentLoaded', () => {
    wsClient.connect();
});

// 页面关闭时断开连接
window.addEventListener('beforeunload', () => {
    wsClient.disconnect();
});

// 导出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WebSocketClient, wsClient };
}
