// 全局状态
let workbook = null; // Excel工作簿
let sheetNames = []; // 所有sheet名称
let currentSheet = ''; // 当前选中的sheet
let currentSheetData = []; // 当前sheet的数据
let currentPage = 1;
let pageSize = 20;
let unitName = '';
let unitWebsite = '';
let excelFileName = '';
let lastModifiedTime = null; // 上次修改时间
let autoRefreshInterval = null; // 自动刷新定时器
const REFRESH_INTERVAL = 30000; // 自动刷新间隔（30秒）

// 初始化
document.addEventListener('DOMContentLoaded', async function() {
    // 从URL参数获取单位信息
    const urlParams = new URLSearchParams(window.location.search);
    unitName = decodeURIComponent(urlParams.get('name') || '');
    unitWebsite = decodeURIComponent(urlParams.get('website') || '');
    const specifiedFile = decodeURIComponent(urlParams.get('file') || '');
    
    if (!unitName || !unitWebsite) {
        showError('缺少必要的参数');
        return;
    }
    
    // 更新页面标题
    document.getElementById('unitName').textContent = unitName;
    document.getElementById('unitWebsite').textContent = unitWebsite;
    
    // 建立文件映射
    await fileMapper.scanFiles();
    
    // 确定要加载的Excel文件名
    if (specifiedFile) {
        // 使用URL参数中指定的文件名
        excelFileName = specifiedFile;
        console.log(`使用指定的文件名: ${excelFileName}`);
    } else {
        // 通过文件映射系统查找对应的文件
        const fileInfo = fileMapper.getFileByUnitAndWebsite(unitName, unitWebsite);
        if (fileInfo) {
            excelFileName = fileInfo.filename;
            console.log(`通过映射找到文件: ${excelFileName}`);
        } else {
            // 使用默认命名规则（向后兼容）
            excelFileName = `${unitName}__${unitWebsite}__OK__48a7d34d.xlsx`;
            console.log(`使用默认文件名: ${excelFileName}`);
        }
    }
    
    // 加载详情数据
    await loadDetailData();
    
    // 启动自动刷新
    startAutoRefresh();
});

// 加载详情数据
async function loadDetailData() {
    showLoading(true);
    try {
        // 尝试加载对应的Excel文件
        const response = await fetch(`data/${excelFileName}`);
        
        if (!response.ok) {
            // 如果找不到特定文件，显示示例数据
            showSampleData();
            return;
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        
        // 使用SheetJS解析Excel
        workbook = XLSX.read(data, { type: 'array' });
        sheetNames = workbook.SheetNames;
        
        // 渲染Sheet标签
        renderSheetTabs();
        
        // 默认选中第一个sheet
        if (sheetNames.length > 0) {
            switchSheet(sheetNames[0]);
        }
        
        // 从第一个sheet获取单位信息
        updateUnitInfoFromSheet();
        
    } catch (error) {
        console.error('加载详情数据失败:', error);
        showSampleData();
    } finally {
        showLoading(false);
    }
}

// 显示示例数据（当找不到文件时）
function showSampleData() {
    document.getElementById('unitScore').textContent = '0';
    document.getElementById('unitTime').textContent = '-';
    
    sheetNames = ['支持度统计', '链路研判详情', '不支持链路整改清单', '外链情况'];
    renderSheetTabs();
    
    // 显示空数据提示
    currentSheetData = [];
    renderDetailTable();
    updateDetailPagination();
    
    // 显示提示信息
    const tbody = document.getElementById('detailTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="20" class="empty-state">
                <div class="empty-state-icon">📄</div>
                <div class="empty-state-text">未找到详细数据文件</div>
                <div style="margin-top: 8px; font-size: 14px;">文件名: ${escapeHtml(excelFileName)}</div>
            </td>
        </tr>
    `;
}

// 从sheet更新单位信息
function updateUnitInfoFromSheet() {
    try {
        const firstSheet = workbook.Sheets[sheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        if (jsonData.length > 0) {
            const firstRow = jsonData[0];
            const score = firstRow['综合得分'];
            const time = firstRow['检测时间'];
            
            if (score !== undefined) {
                document.getElementById('unitScore').textContent = score;
            }
            if (time) {
                document.getElementById('unitTime').textContent = time;
            }
        }
    } catch (error) {
        console.error('更新单位信息失败:', error);
    }
}

// 渲染Sheet标签
function renderSheetTabs() {
    const tabsContainer = document.getElementById('sheetTabs');
    tabsContainer.innerHTML = sheetNames.map(name => `
        <button class="sheet-tab ${name === currentSheet ? 'active' : ''}" 
                onclick="switchSheet('${name}')">
            ${escapeHtml(name)}
        </button>
    `).join('');
}

// 切换Sheet
function switchSheet(sheetName) {
    currentSheet = sheetName;
    currentPage = 1;
    
    // 更新标签样式
    document.querySelectorAll('.sheet-tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent.trim() === sheetName);
    });
    
    // 加载sheet数据
    if (workbook) {
        const sheet = workbook.Sheets[sheetName];
        currentSheetData = XLSX.utils.sheet_to_json(sheet);
    }
    
    renderDetailTable();
    updateDetailPagination();
}

// 渲染详情表格
function renderDetailTable() {
    const thead = document.getElementById('detailTableHead');
    const tbody = document.getElementById('detailTableBody');
    
    if (currentSheetData.length === 0) {
        thead.innerHTML = '';
        tbody.innerHTML = `
            <tr>
                <td class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <div class="empty-state-text">暂无数据</div>
                </td>
            </tr>
        `;
        return;
    }
    
    // 获取所有列名
    const columns = Object.keys(currentSheetData[0]);
    
    // 渲染表头
    thead.innerHTML = `
        <tr>
            <th class="col-index">序号</th>
            ${columns.map(col => `<th>${escapeHtml(col)}</th>`).join('')}
        </tr>
    `;
    
    // 分页数据
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageData = currentSheetData.slice(start, end);
    
    // 渲染数据行
    tbody.innerHTML = pageData.map((item, index) => {
        const actualIndex = start + index + 1;
        return `
            <tr>
                <td class="col-index">${actualIndex}</td>
                ${columns.map(col => {
                    let value = item[col];
                    // 处理长文本
                    if (typeof value === 'string' && value.length > 50) {
                        value = truncateText(value, 50);
                    }
                    return `<td title="${escapeHtml(String(item[col] || ''))}">${escapeHtml(String(value || ''))}</td>`;
                }).join('')}
            </tr>
        `;
    }).join('');
}

// 更新分页控件
function updateDetailPagination() {
    const totalItems = currentSheetData.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    
    document.getElementById('detailTotalItems').textContent = totalItems;
    document.getElementById('detailCurrentPage').textContent = currentPage;
    document.getElementById('detailTotalPages').textContent = totalPages || 1;
    
    // 更新按钮状态
    document.getElementById('detailBtnFirst').disabled = currentPage === 1;
    document.getElementById('detailBtnPrev').disabled = currentPage === 1;
    document.getElementById('detailBtnNext').disabled = currentPage >= totalPages;
    document.getElementById('detailBtnLast').disabled = currentPage >= totalPages;
}

// 改变每页显示数量
function changeDetailPageSize() {
    pageSize = parseInt(document.getElementById('detailPageSize').value);
    currentPage = 1;
    renderDetailTable();
    updateDetailPagination();
}

// 分页导航
function goToDetailFirstPage() {
    currentPage = 1;
    renderDetailTable();
    updateDetailPagination();
}

function goToDetailPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderDetailTable();
        updateDetailPagination();
    }
}

function goToDetailNextPage() {
    const totalPages = Math.ceil(currentSheetData.length / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        renderDetailTable();
        updateDetailPagination();
    }
}

function goToDetailLastPage() {
    currentPage = Math.ceil(currentSheetData.length / pageSize);
    renderDetailTable();
    updateDetailPagination();
}

// 下载详细Excel文件
async function downloadDetailExcel() {
    if (!workbook) {
        alert('数据尚未加载完成，请稍后再试');
        return;
    }
    
    try {
        XLSX.writeFile(workbook, excelFileName);
    } catch (error) {
        console.error('下载Excel失败:', error);
        alert('下载失败，请重试');
    }
}

// 返回列表页
function goBack() {
    window.location.href = 'index.html';
}

// HTML转义
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 截断文本
function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// 显示/隐藏加载遮罩
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

// 显示错误信息
function showError(message) {
    document.getElementById('unitName').textContent = '错误';
    const tbody = document.getElementById('detailTableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="20" class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-text">${message}</div>
            </td>
        </tr>
    `;
}

// 启动自动刷新
function startAutoRefresh() {
    // 清除已有的定时器
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    
    // 设置定时刷新
    autoRefreshInterval = setInterval(async () => {
        await checkAndRefreshData();
    }, REFRESH_INTERVAL);
    
    console.log(`自动刷新已启动，每 ${REFRESH_INTERVAL / 1000} 秒检测一次数据变化`);
}

// 停止自动刷新
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
        console.log('自动刷新已停止');
    }
}

// 检测数据变化并刷新
async function checkAndRefreshData() {
    try {
        // 获取文件信息
        const response = await fetch(`data/${excelFileName}`, { method: 'HEAD' });
        
        if (!response.ok) {
            return; // 文件不存在，不刷新
        }
        
        const lastModified = response.headers.get('last-modified');
        
        // 如果是首次加载，记录修改时间
        if (!lastModifiedTime) {
            lastModifiedTime = lastModified;
            return;
        }
        
        // 如果文件有更新
        if (lastModified && lastModified !== lastModifiedTime) {
            console.log('检测到数据文件更新，正在重新加载...');
            lastModifiedTime = lastModified;
            
            // 保存当前状态
            const currentSheetName = currentSheet;
            const currentPageNum = currentPage;
            
            // 重新加载数据
            await loadDetailData();
            
            // 恢复选中的sheet
            if (currentSheetName && sheetNames.includes(currentSheetName)) {
                switchSheet(currentSheetName);
                currentPage = currentPageNum;
                renderDetailTable();
                updateDetailPagination();
            }
            
            // 显示更新提示
            showUpdateNotification();
        }
    } catch (error) {
        console.error('检测数据变化失败:', error);
    }
}

// 显示更新提示
function showUpdateNotification() {
    // 创建提示元素
    let notification = document.getElementById('updateNotification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'updateNotification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #52c41a;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1001;
            font-size: 14px;
            transition: all 0.3s ease;
            opacity: 0;
            transform: translateY(-20px);
        `;
        document.body.appendChild(notification);
    }
    
    notification.textContent = '✓ 数据已更新';
    notification.style.opacity = '1';
    notification.style.transform = 'translateY(0)';
    
    // 3秒后隐藏
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(-20px)';
    }, 3000);
}

// 手动刷新数据
async function manualRefresh() {
    console.log('手动刷新数据...');
    
    // 优先使用WebSocket触发服务器端扫描
    if (typeof wsClient !== 'undefined' && wsClient.isConnected) {
        wsClient.requestScan();
        console.log('已通过WebSocket请求服务器扫描');
    } else {
        // 降级使用本地刷新
        console.log('WebSocket未连接，使用本地刷新');
        lastModifiedTime = null;
        await loadDetailData();
        showUpdateNotification();
    }
}

// 页面可见性变化时控制自动刷新
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        // 页面不可见时停止刷新
        stopAutoRefresh();
    } else {
        // 页面可见时启动刷新
        startAutoRefresh();
        // 立即检查一次数据变化
        checkAndRefreshData();
    }
});