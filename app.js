// 全局状态
let allData = []; // 所有数据
let filteredData = []; // 筛选后的数据
let currentPage = 1;
let pageSize = 20;
let sortColumn = null;
let sortDirection = 'asc';
let overallWorkbook = null; // 存储总体得分表的Excel工作簿
let lastModifiedTime = null; // 上次修改时间
let autoRefreshInterval = null; // 自动刷新定时器
const REFRESH_INTERVAL = 30000; // 自动刷新间隔（30秒）

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    loadOverallData();
    startAutoRefresh();
    
    // 监听WebSocket数据更新事件
    if (typeof wsClient !== 'undefined') {
        wsClient.on('dataUpdated', async (data) => {
            console.log('收到数据更新通知，重新加载数据...');
            await loadOverallData();
        });
        
        // 监听连接成功事件
        wsClient.on('connected', () => {
            console.log('WebSocket已连接，启用实时更新');
        });
    }
});

// 加载总体得分表数据
async function loadOverallData() {
    showLoading(true);
    try {
        // 首先建立文件映射
        await fileMapper.scanFiles();
        fileMapper.printMapping();
        
        // 获取总体得分表文件
        const overallFile = fileMapper.getOverallFile();
        if (!overallFile) {
            throw new Error('未找到总体得分表文件');
        }
        
        const response = await fetch(`data/${overallFile.filename}`);
        const arrayBuffer = await response.arrayBuffer();
        const data = new Uint8Array(arrayBuffer);
        
        // 使用SheetJS解析Excel
        const workbook = XLSX.read(data, { type: 'array' });
        overallWorkbook = workbook;
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        // 处理数据，添加序号和统一字段名，并关联详情文件
        allData = jsonData.map((item, index) => {
            const unitName = item['归属单位名称'] || '';
            const website = item['目标网站'] || '';
            
            // 使用文件映射系统查找对应的详情文件
            const detailFile = fileMapper.getFileByUnitAndWebsite(unitName, website);
            
            return {
                '序号': index + 1,
                '归属单位名称': unitName,
                '目标网站': website,
                '综合得分': item['综合得分'] !== undefined ? parseFloat(item['综合得分']) : 0,
                '首页支持率': item['首页支持率'] !== undefined ? formatPercentage(item['首页支持率']) : '0.00%',
                '二级链接支持率': formatPercentage(item['二级链接支持率']),
                '三级链接支持率': formatPercentage(item['三级链接支持率']),
                '检测时间': item['检测时间'] || '',
                'detailFile': detailFile // 关联的详情文件信息
            };
        });
        
        filteredData = [...allData];
        updateStats();
        renderTable();
        updatePagination();
    } catch (error) {
        console.error('加载数据失败:', error);
        showError('加载数据失败，请刷新页面重试');
    } finally {
        showLoading(false);
    }
}

// 格式化百分比
function formatPercentage(value) {
    if (value === undefined || value === null) return '0.00%';
    if (typeof value === 'string' && value.includes('%')) return value;
    const num = parseFloat(value);
    if (isNaN(num)) return '0.00%';
    return (num * 100).toFixed(2) + '%';
}

// 更新统计数据
function updateStats() {
    const totalCount = allData.length;
    const avgScore = totalCount > 0 
        ? (allData.reduce((sum, item) => sum + item['综合得分'], 0) / totalCount).toFixed(1)
        : 0;
    const highScoreCount = allData.filter(item => item['综合得分'] >= 100).length;
    
    document.getElementById('totalCount').textContent = totalCount;
    document.getElementById('avgScore').textContent = avgScore;
    document.getElementById('highScoreCount').textContent = highScoreCount;
}

// 渲染表格
function renderTable() {
    const tbody = document.getElementById('tableBody');
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageData = filteredData.slice(start, end);
    
    if (pageData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-state">
                    <div class="empty-state-icon">📊</div>
                    <div class="empty-state-text">暂无数据</div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = pageData.map((item, index) => {
        const score = item['综合得分'];
        const scoreClass = score >= 80 ? 'score-high' : score >= 60 ? 'score-medium' : 'score-low';
        const actualIndex = start + index + 1;
        
        // 检查是否有对应的详情文件
        const hasDetailFile = item.detailFile !== null && item.detailFile !== undefined;
        
        // 构建详情页链接参数
        const detailParams = new URLSearchParams({
            name: item['归属单位名称'],
            website: item['目标网站']
        });
        
        // 如果有详情文件，添加文件名参数
        if (hasDetailFile) {
            detailParams.set('file', item.detailFile.filename);
        }
        
        return `
            <tr>
                <td class="col-index">${actualIndex}</td>
                <td title="${escapeHtml(item['归属单位名称'])}">${escapeHtml(truncateText(item['归属单位名称'], 30))}</td>
                <td>${escapeHtml(item['目标网站'])}</td>
                <td class="score ${scoreClass}">${score}</td>
                <td>${item['首页支持率']}</td>
                <td>${item['二级链接支持率']}</td>
                <td>${item['三级链接支持率']}</td>
                <td>${item['检测时间']}</td>
                <td class="col-action">
                    ${hasDetailFile 
                        ? `<a href="detail.html?${detailParams.toString()}" class="btn-link">查看详情</a>`
                        : `<span style="color: #8c8c8c; font-size: 12px;">暂无详情</span>`
                    }
                </td>
            </tr>
        `;
    }).join('');
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

// 更新分页控件
function updatePagination() {
    const totalItems = filteredData.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    
    document.getElementById('totalItems').textContent = totalItems;
    document.getElementById('currentPage').textContent = currentPage;
    document.getElementById('totalPages').textContent = totalPages || 1;
    
    // 更新按钮状态
    document.getElementById('btnFirst').disabled = currentPage === 1;
    document.getElementById('btnPrev').disabled = currentPage === 1;
    document.getElementById('btnNext').disabled = currentPage >= totalPages;
    document.getElementById('btnLast').disabled = currentPage >= totalPages;
}

// 排序功能
function sortTable(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    
    filteredData.sort((a, b) => {
        let valueA = a[column];
        let valueB = b[column];
        
        // 处理百分比字符串
        if (typeof valueA === 'string' && valueA.includes('%')) {
            valueA = parseFloat(valueA.replace('%', ''));
            valueB = parseFloat(valueB.replace('%', ''));
        }
        
        // 处理数字
        if (typeof valueA === 'number' && typeof valueB === 'number') {
            return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
        }
        
        // 处理字符串
        valueA = String(valueA || '').toLowerCase();
        valueB = String(valueB || '').toLowerCase();
        
        if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
        if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    currentPage = 1;
    renderTable();
    updatePagination();
    updateSortIcons();
}

// 更新排序图标
function updateSortIcons() {
    document.querySelectorAll('.col-sortable .sort-icon').forEach(icon => {
        icon.textContent = '↕';
    });
    
    if (sortColumn) {
        const headers = document.querySelectorAll('.col-sortable');
        headers.forEach(header => {
            if (header.textContent.includes(sortColumn)) {
                const icon = header.querySelector('.sort-icon');
                if (icon) {
                    icon.textContent = sortDirection === 'asc' ? '↑' : '↓';
                }
            }
        });
    }
}

// 筛选功能
function filterData() {
    const keyword = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (!keyword) {
        filteredData = [...allData];
    } else {
        filteredData = allData.filter(item => {
            return item['归属单位名称'].toLowerCase().includes(keyword) ||
                   item['目标网站'].toLowerCase().includes(keyword);
        });
    }
    
    currentPage = 1;
    renderTable();
    updatePagination();
}

// 监听搜索框回车事件
document.getElementById('searchInput')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        filterData();
    }
});

// 改变每页显示数量
function changePageSize() {
    pageSize = parseInt(document.getElementById('pageSize').value);
    currentPage = 1;
    renderTable();
    updatePagination();
}

// 分页导航
function goToFirstPage() {
    currentPage = 1;
    renderTable();
    updatePagination();
}

function goToPrevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
        updatePagination();
    }
}

function goToNextPage() {
    const totalPages = Math.ceil(filteredData.length / pageSize);
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
        updatePagination();
    }
}

function goToLastPage() {
    currentPage = Math.ceil(filteredData.length / pageSize);
    renderTable();
    updatePagination();
}

// 下载总体得分表Excel
function downloadOverallExcel() {
    if (!overallWorkbook) {
        alert('数据尚未加载完成，请稍后再试');
        return;
    }
    
    try {
        // 使用原始工作簿数据生成Excel文件
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(allData);
        XLSX.utils.book_append_sheet(wb, ws, '总体得分表');
        
        // 生成文件名
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const filename = `总体得分表_${date}.xlsx`;
        
        XLSX.writeFile(wb, filename);
    } catch (error) {
        console.error('下载Excel失败:', error);
        alert('下载失败，请重试');
    }
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
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = `
        <tr>
            <td colspan="9" class="empty-state">
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
        const response = await fetch('data/总体得分表_20260216_114402.xlsx', { method: 'HEAD' });
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
            const currentKeyword = document.getElementById('searchInput').value;
            const currentSortColumn = sortColumn;
            const currentSortDirection = sortDirection;
            
            // 重新加载数据
            await loadOverallData();
            
            // 恢复搜索状态
            if (currentKeyword) {
                document.getElementById('searchInput').value = currentKeyword;
                filterData();
            }
            
            // 恢复排序状态
            if (currentSortColumn) {
                sortColumn = currentSortColumn;
                sortDirection = currentSortDirection;
                sortTable(sortColumn);
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
        await loadOverallData();
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