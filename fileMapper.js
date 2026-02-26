/**
 * 文件映射系统 - 建立单位名称与详情文件的智能映射关系
 * 
 * 功能说明：
 * 1. 扫描data目录下的所有详情文件
 * 2. 解析文件名，提取单位名称、网站、状态、标识码
 * 3. 建立单位名称到文件名的映射关系
 * 4. 提供智能匹配功能，支持模糊匹配
 */

class FileMapper {
    constructor() {
        this.fileMap = new Map(); // 单位名称 -> 文件信息
        this.files = []; // 所有文件列表
        this.overallFile = null; // 总体得分表文件
    }

    /**
     * 解析文件名
     * 文件名格式: {单位名称}__{网站}__{状态}__{标识码}.xlsx
     */
    parseFilename(filename) {
        // 移除.xlsx后缀
        const nameWithoutExt = filename.replace(/\.xlsx$/i, '');
        
        // 按__分割
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
        
        // 检查是否是总体得分表
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
     * 扫描并建立映射
     * 从JSON文件加载文件列表，如果加载失败则使用预定义列表
     */
    async scanFiles() {
        let predefinedFiles = [];
        
        try {
            // 尝试从JSON文件加载文件列表
            const response = await fetch('data/file_list.json');
            if (response.ok) {
                predefinedFiles = await response.json();
                console.log('从file_list.json加载文件列表成功');
            } else {
                throw new Error('无法加载file_list.json');
            }
        } catch (error) {
            console.warn('无法加载file_list.json，使用预定义列表:', error);
            // 预定义的文件列表（备用）
            predefinedFiles = [
                '总体得分表_20260216_114402.xlsx',
                '中共成都市双流区委史志办公室__www.slsz.org.cn__OK__f53b2416.xlsx',
                '四川省双流棠湖中学__www.tanghu.net__OK__6ee5c90f.xlsx',
                '四川省双流艺体中学__www.yitischool.cn__OK__c78ccb27.xlsx',
                '四川省成都市双流区东升第一初级中学__www.sldsyz.cn__OK__54fdd611.xlsx',
                '四川省成都市第二中学（北京师范大学成都实验中学）__www.cd2z.cn__OK__f1cf72c8.xlsx',
                '成都市公共资源交易服务中心（成都市政府采购中心）__cdggzy.chengdu.gov.cn__OK__2ce058e8.xlsx',
                '成都市公共资源交易服务中心（成都市政府采购中心）__www.cdggzy.com__OK__eff7a365.xlsx',
                '成都市农林科学院__www.cdnky.com__OK__e2606ac5.xlsx',
                '成都市双流区互联网信息中心__www.slwmw.cn__OK__90b225c1.xlsx',
                '成都市双流区图书馆__www.sllib.cn__OK__eb7cf15a.xlsx',
                '成都市双流区融媒体中心(成都市双流区广播电视台)__www.sltv.net__OK__31e3b74e.xlsx',
                '成都市工业互联网发展中心__www.cdiisp.com__OK__12003444.xlsx',
                '成都市成华区图书馆__www.chlib.org__OK__c092b0df.xlsx',
                '成都市成华区文物保护管理所__www.chwkyzt.cn__OK__1ce43760.xlsx',
                '成都市成华区融媒体中心__www.chrmpaper.com__OK__48a7d34d.xlsx',
                '成都市文化数据中心（成都市文物信息中心、成都市文化遗产保护研究中心）__www.zhbwg.org.cn__OK__2c4240c0.xlsx',
                '成都市新津区图书馆__www.xjtsg.com__OK__530784d1.xlsx',
                '成都市泡桐树中学__cdpts.cn__OK__dc8612e4.xlsx',
                '成都市特种设备检验检测研究院（成都市特种设备应急处置中心）__www.cdsei.net__OK__f26e0477.xlsx',
                '成都市社会组织社区和社工人才服务中心__cdnpo.cdszhmz.cn__OK__50deabcf.xlsx',
                '成都市金牛交子幼儿园__www.jnjzyey.com__OK__a6c20fcc.xlsx',
                '成都市金融发展促进中心__www.cdmfrs.cn__OK__6a808fbc.xlsx',
                '成都市龙泉驿区东安湖学校__www.cddah.net__OK__5ad1729c.xlsx'
            ];
        }

        this.files = [];
        this.fileMap.clear();

        for (const filename of predefinedFiles) {
            const fileInfo = this.parseFilename(filename);
            if (fileInfo) {
                this.files.push(fileInfo);
                
                if (fileInfo.isOverallFile) {
                    this.overallFile = fileInfo;
                } else if (fileInfo.isDetailFile) {
                    // 建立单位名称到文件的映射
                    // 支持一个单位对应多个文件（不同网站）
                    if (!this.fileMap.has(fileInfo.unitName)) {
                        this.fileMap.set(fileInfo.unitName, []);
                    }
                    this.fileMap.get(fileInfo.unitName).push(fileInfo);
                }
            }
        }

        console.log(`文件映射建立完成，共 ${this.fileMap.size} 个单位，${this.files.length} 个文件`);
        return this.fileMap;
    }

    /**
     * 根据单位名称获取对应的详情文件
     * @param {string} unitName - 单位名称
     * @returns {Array|null} - 文件信息数组，如果没有找到返回null
     */
    getFilesByUnitName(unitName) {
        // 精确匹配
        if (this.fileMap.has(unitName)) {
            return this.fileMap.get(unitName);
        }

        // 模糊匹配 - 尝试部分匹配
        for (const [key, files] of this.fileMap.entries()) {
            // 单位名称包含查询名称，或查询名称包含单位名称
            if (key.includes(unitName) || unitName.includes(key)) {
                console.log(`模糊匹配: "${unitName}" -> "${key}"`);
                return files;
            }
        }

        return null;
    }

    /**
     * 根据单位名称和网站获取特定文件
     * @param {string} unitName - 单位名称
     * @param {string} website - 网站地址
     * @returns {Object|null} - 文件信息，如果没有找到返回null
     */
    getFileByUnitAndWebsite(unitName, website) {
        const files = this.getFilesByUnitName(unitName);
        if (!files) return null;

        // 查找匹配网站的文件
        return files.find(f => f.website === website) || files[0]; // 默认返回第一个
    }

    /**
     * 获取总体得分表文件
     */
    getOverallFile() {
        return this.overallFile;
    }

    /**
     * 获取所有单位名称列表
     */
    getAllUnitNames() {
        return Array.from(this.fileMap.keys());
    }

    /**
     * 检查单位是否有对应的详情文件
     * @param {string} unitName - 单位名称
     */
    hasDetailFile(unitName) {
        return this.fileMap.has(unitName) || this.getFilesByUnitName(unitName) !== null;
    }

    /**
     * 打印映射关系（调试用）
     */
    printMapping() {
        console.log('========== 文件映射关系 ==========');
        for (const [unitName, files] of this.fileMap.entries()) {
            console.log(`\n单位: ${unitName}`);
            files.forEach((file, index) => {
                console.log(`  [${index + 1}] ${file.filename}`);
                console.log(`      网站: ${file.website}`);
                console.log(`      状态: ${file.status}`);
                console.log(`      标识: ${file.code}`);
            });
        }
        console.log('\n==================================');
    }
}

// 创建全局实例
const fileMapper = new FileMapper();

// 导出（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FileMapper, fileMapper };
}
