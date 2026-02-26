# IPv6监测结果展示平台 - 完整使用说明

## 目录

1. [项目概述与功能说明](#一项目概述与功能说明)
2. [环境配置与依赖安装](#二环境配置与依赖安装)
3. [服务启动步骤](#三服务启动步骤)
4. [核心功能使用](#四核心功能使用)
5. [常见问题与异常排查](#五常见问题与异常排查)
6. [日志查看与分析](#六日志查看与分析)
7. [性能优化建议](#七性能优化建议)

---

## 一、项目概述与功能说明

### 1.1 项目简介

IPv6监测结果展示平台是一个**全自动化的数据展示与管理系统**，用于展示和管理IPv6监测结果数据。系统采用前后端分离架构，支持实时数据更新和文件自动解析。

### 1.2 核心功能

#### 1.2.1 数据展示功能
- **首页**：展示所有监测单位的列表，包含综合得分、支持率等关键指标
- **详情页**：展示单个单位的详细监测数据，支持多Sheet切换
- **表格功能**：支持排序、筛选、分页，响应式设计

#### 1.2.2 文件自动解析功能
- **自动监测**：持续监控data目录，检测文件创建、修改、删除
- **智能映射**：自动建立单位名称与详情文件的映射关系
- **实时通知**：文件变动后实时通知前端更新

#### 1.2.3 Excel下载功能
- 下载总体得分表
- 下载单位详情文件
- 数据格式规范，排版整齐

### 1.3 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端层                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  index.html  │  │  detail.html │  │   ws-client.js   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ WebSocket / HTTP
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Node.js服务层                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ FileWatcher  │  │ WebSocketMgr │  │   FileParser    │  │
│  │  (chokidar)  │  │    (ws)      │  │    (xlsx)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      数据层 (data/)                          │
│  ├── 总体得分表_20260216_114402.xlsx                        │
│  ├── {单位}__{网站}__OK__{code}.xlsx                        │
│  ├── file_list.json                                         │
│  └── mapping_report.json                                    │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 文件命名规范

**总体得分表**：
```
总体得分表_{日期}_{时间}.xlsx
例如：总体得分表_20260216_114402.xlsx
```

**单位详情文件**：
```
{单位名称}__{网站}__{状态}__{标识码}.xlsx
例如：成都市龙泉驿区东安湖学校__www.cddah.net__OK__5ad1729c.xlsx
```

---

## 二、环境配置与依赖安装

### 2.1 系统要求

| 项目 | 最低要求 | 推荐配置 |
|------|----------|----------|
| 操作系统 | Windows 7 / Linux / macOS | Windows 10 / Ubuntu 20.04 |
| Node.js | v14.0.0 | v18.0.0+ |
| 内存 | 2GB | 4GB+ |
| 磁盘空间 | 1GB | 5GB+ |
| 浏览器 | Chrome 80+ | Chrome 最新版 |

### 2.2 安装Node.js

**Windows系统：**

1. 访问 https://nodejs.org/
2. 下载 LTS 版本的安装包
3. 运行安装程序，按提示完成安装
4. 验证安装：
   ```powershell
   node --version
   npm --version
   ```

**Linux系统（Ubuntu）：**

```bash
# 使用NodeSource安装
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

### 2.3 项目依赖安装

**步骤1：进入项目目录**

```powershell
cd d:\Dev\Project\Coding\down
```

**步骤2：安装依赖**

```powershell
# 设置PowerShell执行策略（Windows）
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

# 安装依赖
npm install
```

**步骤3：验证安装**

安装完成后，项目目录下会生成 `node_modules` 文件夹：

```powershell
# 查看安装的包
ls node_modules

# 检查关键依赖
ls node_modules | findstr chokidar
ls node_modules | findstr express
ls node_modules | findstr ws
```

### 2.4 项目结构说明

```
d:\Dev\Project\Coding\down\
│
├── data/                           # 数据目录（存放Excel文件）
│   ├── 总体得分表_20260216_114402.xlsx
│   ├── file_list.json             # 自动生成的文件列表
│   └── mapping_report.json        # 自动生成的映射报告
│
├── logs/                          # 日志目录（自动创建）
│   ├── combined.log               # 所有日志
│   └── error.log                  # 错误日志
│
├── node_modules/                  # 依赖包目录
│
├── index.html                     # 首页
├── detail.html                    # 详情页
├── app.js                         # 首页逻辑
├── detail.js                      # 详情页逻辑
├── fileMapper.js                  # 文件映射系统
├── ws-client.js                   # WebSocket客户端
├── styles.css                     # 样式文件
│
├── server.js                      # Node.js服务端
├── package.json                   # 项目配置
├── package-lock.json              # 依赖锁定文件
│
├── scan_files.py                  # Python文件扫描脚本
├── parse_excel.py                 # Python Excel解析脚本
│
└── 项目使用说明.md                # 本文档
```

---

## 三、服务启动步骤

### 3.1 开发环境启动

**方式1：使用Node.js直接启动**

```powershell
# 进入项目目录
cd d:\Dev\Project\Coding\down

# 启动服务
node server.js
```

启动成功后会显示：
```
[2026-02-25 17:29:10] [INFO]: =================================
[2026-02-25 17:29:10] [INFO]: 服务已启动
[2026-02-25 17:29:10] [INFO]: HTTP端口: 3000
[2026-02-25 17:29:10] [INFO]: 数据目录: D:\Dev\Project\Coding\down\data
[2026-02-25 17:29:10] [INFO]: =================================
```

**方式2：使用nodemon（推荐开发使用）**

```powershell
# 安装nodemon（全局安装）
npm install -g nodemon

# 使用nodemon启动（自动重启）
npm run dev
```

### 3.2 生产环境启动

**使用PM2进程管理器（推荐生产环境）**

```powershell
# 安装PM2
npm install -g pm2

# 使用PM2启动
pm2 start server.js --name ipv6-monitor

# 查看状态
pm2 status

# 查看日志
pm2 logs ipv6-monitor

# 重启服务
pm2 restart ipv6-monitor

# 停止服务
pm2 stop ipv6-monitor
```

### 3.3 验证服务启动

**检查服务状态：**

```powershell
# 查看系统状态
curl http://localhost:3000/api/status

# 预期返回：
{
  "isParsing": false,
  "queueLength": 0,
  "connectedClients": 0,
  "uptime": 123.456,
  "timestamp": "2026-02-25 17:30:00"
}
```

**访问前端页面：**

1. 打开浏览器
2. 访问 http://localhost:3000
3. 应该能看到单位列表页面

### 3.4 停止服务

**方式1：Ctrl+C**

在运行服务的命令行窗口按 `Ctrl+C` 组合键

**方式2：使用PM2**

```powershell
pm2 stop ipv6-monitor
```

---

## 四、核心功能使用

### 4.1 数据文件准备

**步骤1：准备总体得分表**

总体得分表必须包含以下列：
- 归属单位名称
- 目标网站
- 首页支持率
- 二级链接支持率
- 三级链接支持率
- 综合得分
- 检测时间

**步骤2：准备单位详情文件**

详情文件命名格式：
```
{单位名称}__{网站}__OK__{唯一标识}.xlsx
```

示例：
```
成都市龙泉驿区东安湖学校__www.cddah.net__OK__5ad1729c.xlsx
```

**注意事项：**
- 单位名称必须与总体得分表中的"归属单位名称"完全一致
- 网站必须与总体得分表中的"目标网站"一致
- 唯一标识可以是任意字符串（建议使用8位随机码）

### 4.2 添加数据文件

**方法1：直接复制文件**

```powershell
# 复制文件到data目录
copy "成都市新单位__www.example.com__OK__12345678.xlsx" "d:\Dev\Project\Coding\down\data\"
```

**方法2：使用文件管理器**

1. 打开文件管理器
2. 导航到 `d:\Dev\Project\Coding\down\data\`
3. 将Excel文件拖入该目录

**自动处理：**

文件放入后，系统会自动：
1. 检测文件变动
2. 解析文件名建立映射
3. 更新文件列表
4. 通知前端刷新

### 4.3 使用Web界面

**4.3.1 首页功能**

| 功能 | 操作方式 | 说明 |
|------|----------|------|
| 搜索 | 在搜索框输入关键词 | 支持单位名称和网站搜索 |
| 排序 | 点击表头 | 支持升序/降序切换 |
| 分页 | 点击分页按钮 | 支持首页/末页/上一页/下一页 |
| 调整页数 | 选择每页显示条数 | 可选10/20/50/100条 |
| 查看详情 | 点击"查看详情"按钮 | 跳转到详情页 |
| 下载Excel | 点击"下载Excel"按钮 | 下载总体得分表 |
| 刷新数据 | 点击"刷新"按钮 | 手动触发数据刷新 |

**4.3.2 详情页功能**

| 功能 | 操作方式 | 说明 |
|------|----------|------|
| 切换Sheet | 点击Sheet标签 | 显示不同工作表数据 |
| 分页浏览 | 点击分页按钮 | 大数据量分页显示 |
| 下载文件 | 点击"下载Excel文件"按钮 | 下载该单位详情文件 |
| 返回列表 | 点击"返回列表"按钮 | 回到首页 |

### 4.4 手动触发解析

**方式1：点击页面刷新按钮**

在首页或详情页点击工具栏的"刷新"按钮

**方式2：调用API**

```powershell
# 使用curl调用API
curl -X POST http://localhost:3000/api/scan

# 预期返回
{"success":true,"message":"扫描已触发"}
```

**方式3：使用Python脚本**

```python
import requests

response = requests.post('http://localhost:3000/api/scan')
print(response.json())
```

### 4.5 查看映射关系

**查看文件列表：**

```powershell
curl http://localhost:3000/api/files
```

**查看映射报告：**

```powershell
curl http://localhost:3000/api/mapping
```

**查看文本报告：**

直接打开 `data/mapping_report.txt` 文件

---

## 五、常见问题与异常排查

### 5.1 服务启动问题

#### 问题1：端口被占用

**现象：**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**解决方案：**

```powershell
# 查找占用3000端口的进程
netstat -ano | findstr :3000

# 结束进程（将{PID}替换为实际的进程ID）
taskkill /PID {PID} /F

# 或者修改server.js中的端口号
```

#### 问题2：权限不足

**现象：**
```
Error: EACCES: permission denied
```

**解决方案：**

```powershell
# 以管理员身份运行PowerShell
# 右键点击PowerShell -> 以管理员身份运行

# 或者修改目录权限
icacls "d:\Dev\Project\Coding\down" /grant Users:F
```

#### 问题3：依赖安装失败

**现象：**
```
npm ERR! code ENOENT
npm ERR! syscall open
```

**解决方案：**

```powershell
# 清除npm缓存
npm cache clean --force

# 删除node_modules重新安装
rm -rf node_modules
rm package-lock.json
npm install
```

### 5.2 WebSocket连接问题

#### 问题1：连接失败

**现象：**
浏览器控制台显示：
```
WebSocket connection failed
```

**排查步骤：**

1. 检查Node.js服务是否运行
   ```powershell
   curl http://localhost:3000/api/status
   ```

2. 检查防火墙设置
   ```powershell
   # 查看防火墙状态
   netsh advfirewall show currentprofile
   
   # 临时关闭防火墙（测试用）
   netsh advfirewall set allprofiles state off
   ```

3. 检查端口是否开放
   ```powershell
   telnet localhost 3000
   ```

#### 问题2：频繁断开重连

**现象：**
浏览器控制台显示：
```
WebSocket连接关闭
5秒后尝试重新连接...
```

**解决方案：**

1. 检查网络稳定性
2. 查看服务器日志是否有错误
3. 增加心跳检测间隔（修改ws-client.js）

### 5.3 文件监控问题

#### 问题1：文件变动未检测

**现象：**
放入新文件后系统没有反应

**排查步骤：**

1. 检查文件是否在正确的目录
   ```powershell
   ls d:\Dev\Project\Coding\down\data\
   ```

2. 检查文件扩展名
   ```powershell
   # 必须是.xlsx格式
   ls *.xlsx
   ```

3. 查看日志
   ```powershell
   tail -f logs/combined.log
   ```

4. 手动触发扫描
   ```powershell
   curl -X POST http://localhost:3000/api/scan
   ```

#### 问题2：文件名解析失败

**现象：**
```
[ERROR]: 无法解析文件名: xxx.xlsx
```

**解决方案：**

检查文件名格式是否符合规范：
```
正确：成都市单位__www.example.com__OK__12345678.xlsx
错误：成都市单位_www.example.com_OK_12345678.xlsx  （分隔符不对）
错误：成都市单位.xlsx  （缺少分隔符）
```

### 5.4 数据展示问题

#### 问题1：表格数据为空

**现象：**
页面显示"暂无数据"

**排查步骤：**

1. 检查总体得分表是否存在
   ```powershell
   ls data/总体得分表*.xlsx
   ```

2. 检查Excel文件格式
   - 必须包含"归属单位名称"列
   - 必须包含"目标网站"列

3. 查看浏览器控制台是否有错误

#### 问题2：详情文件找不到

**现象：**
点击"查看详情"显示"未找到详细数据文件"

**解决方案：**

1. 检查文件名是否与总体得分表匹配
2. 运行扫描脚本
   ```powershell
   python scan_files.py
   ```
3. 刷新页面

### 5.5 Excel解析问题

#### 问题1：Excel文件损坏

**现象：**
```
[ERROR]: 解析Excel文件失败: xxx.xlsx
```

**解决方案：**

1. 用Excel打开文件检查是否正常
2. 重新保存文件（另存为.xlsx格式）
3. 检查文件是否被其他程序占用

#### 问题2：编码问题

**现象：**
中文显示乱码

**解决方案：**

1. 确保Excel文件使用UTF-8编码
2. 重新保存文件时选择正确的编码

---

## 六、日志查看与分析

### 6.1 日志文件位置

```
logs/
├── combined.log    # 所有日志（包含INFO、WARN、ERROR）
└── error.log       # 仅错误日志
```

### 6.2 日志格式

```
[2026-02-25 17:29:10] [INFO]: 开始扫描文件...
[2026-02-25 17:29:10] [WARN]: 文件未找到: xxx.xlsx
[2026-02-25 17:29:10] [ERROR]: 解析失败: xxx.xlsx
```

### 6.3 查看日志的方法

**方式1：直接查看文件**

```powershell
# 查看最新100行日志
tail -n 100 logs/combined.log

# 实时查看日志（类似tail -f）
Get-Content logs/combined.log -Wait
```

**方式2：通过API查看**

```powershell
# 查看最新50条日志
curl "http://localhost:3000/api/logs?limit=50"
```

**方式3：使用PM2查看**

```powershell
# 如果使用PM2启动
pm2 logs ipv6-monitor

# 查看最新100行
pm2 logs ipv6-monitor --lines 100
```

### 6.4 日志分析技巧

**查找错误：**

```powershell
# 查找所有错误
grep "ERROR" logs/combined.log

# 查找特定文件的错误
grep "xxx.xlsx" logs/combined.log
```

**统计信息：**

```powershell
# 统计错误数量
grep -c "ERROR" logs/combined.log

# 统计扫描次数
grep -c "开始扫描文件" logs/combined.log
```

**时间范围查询：**

```powershell
# 查询特定时间段的日志
grep "2026-02-25 17:" logs/combined.log
```

### 6.5 常见日志信息

| 日志内容 | 级别 | 含义 |
|----------|------|------|
| 服务已启动 | INFO | 服务正常启动 |
| 开始扫描文件 | INFO | 开始文件解析 |
| 文件扫描完成 | INFO | 扫描成功完成 |
| 检测到文件变动 | INFO | 监控到文件变化 |
| 解析完成 | INFO | 解析流程完成 |
| 文件未找到 | WARN | 引用的文件不存在 |
| 无法解析文件名 | WARN | 文件名格式错误 |
| 解析Excel文件失败 | ERROR | Excel文件损坏或格式错误 |
| WebSocket错误 | ERROR | 连接异常 |

---

## 七、性能优化建议

### 7.1 系统配置优化

**增加Node.js内存限制：**

```powershell
# 启动时增加内存限制（默认1.4GB，增加到4GB）
node --max-old-space-size=4096 server.js
```

**使用PM2集群模式：**

```powershell
# 启动4个实例
pm2 start server.js -i 4 --name ipv6-monitor
```

### 7.2 文件监控优化

**调整防抖延迟：**

在 `server.js` 中修改：
```javascript
const CONFIG = {
    DEBOUNCE_DELAY: 2000,  // 增加到2秒，减少频繁触发
    // ...
};
```

**忽略临时文件：**

```javascript
// 在chokidar配置中增加忽略规则
chokidar.watch(CONFIG.DATA_DIR, {
    ignored: [
        /(^|[\/\\])\../,  // 忽略隐藏文件
        /~\$.*\.xlsx$/     // 忽略Excel临时文件
    ],
    // ...
});
```

### 7.3 前端性能优化

**启用浏览器缓存：**

```javascript
// 在app.js中增加缓存机制
const dataCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟
```

**虚拟滚动（大数据量）：**

当表格数据超过1000行时，建议使用虚拟滚动：
```javascript
// 使用第三方库如react-window或vue-virtual-scroller
```

### 7.4 数据库优化（可选）

如果数据量很大，建议将数据存入数据库：

```javascript
// 使用SQLite或MySQL存储解析后的数据
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data.db');
```

### 7.5 监控与告警

**设置健康检查：**

```powershell
# 每分钟检查一次服务状态
while ($true) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/status" -TimeoutSec 5
        Write-Host "服务正常: $(Get-Date)"
    } catch {
        Write-Host "服务异常: $(Get-Date)" -ForegroundColor Red
        # 发送告警通知
    }
    Start-Sleep -Seconds 60
}
```

**日志轮转：**

使用 `winston-daily-rotate-file` 实现日志自动轮转：

```javascript
const DailyRotateFile = require('winston-daily-rotate-file');

transports.push(
    new DailyRotateFile({
        filename: 'logs/application-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d'
    })
);
```

### 7.6 定期维护

**建议的维护任务：**

| 任务 | 频率 | 命令 |
|------|------|------|
| 清理旧日志 | 每周 | `find logs -name "*.log" -mtime +7 -delete` |
| 备份数据 | 每天 | `cp -r data data.backup.$(date +%Y%m%d)` |
| 检查磁盘空间 | 每天 | `df -h` |
| 更新依赖 | 每月 | `npm update` |
| 重启服务 | 每周 | `pm2 restart ipv6-monitor` |

---

## 附录

### A. 常用命令速查

```powershell
# 启动服务
node server.js

# 使用PM2启动
pm2 start server.js --name ipv6-monitor

# 查看状态
pm2 status

# 查看日志
pm2 logs ipv6-monitor

# 重启服务
pm2 restart ipv6-monitor

# 停止服务
pm2 stop ipv6-monitor

# 触发扫描
curl -X POST http://localhost:3000/api/scan

# 查看系统状态
curl http://localhost:3000/api/status

# 查看日志
curl "http://localhost:3000/api/logs?limit=50"
```

### B. 配置文件说明

**package.json：**
```json
{
  "name": "ipv6-monitor-server",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

**server.js 配置项：**
```javascript
const CONFIG = {
    PORT: 3000,                    // HTTP服务端口
    DATA_DIR: './data',            // 数据文件目录
    LOG_DIR: './logs',             // 日志文件目录
    DEBOUNCE_DELAY: 1000,          // 文件监控防抖延迟（毫秒）
    SUPPORTED_EXTENSIONS: ['.xlsx'] // 支持的文件扩展名
};
```

### C. 联系与支持

如有问题，请：
1. 查看日志文件 `logs/combined.log`
2. 检查本文档的常见问题章节
3. 查看系统架构说明文档

---

**文档版本：** v1.0  
**最后更新：** 2026-02-25  
**适用系统：** IPv6监测结果展示平台 v1.0
