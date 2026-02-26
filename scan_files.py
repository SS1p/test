#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
文件扫描脚本
扫描data目录下的所有Excel文件，生成文件列表供前端使用
"""

import os
import json
import re

def scan_data_files(data_dir='data'):
    """扫描数据目录下的所有Excel文件"""
    
    files = {
        'detailFiles': [],
        'overallFile': None
    }
    
    if not os.path.exists(data_dir):
        print(f"错误: 目录 {data_dir} 不存在")
        return files
    
    # 遍历目录
    for filename in os.listdir(data_dir):
        if not filename.endswith('.xlsx'):
            continue
            
        filepath = os.path.join(data_dir, filename)
        if not os.path.isfile(filepath):
            continue
        
        # 检查是否是总体得分表
        if '总体得分表' in filename:
            files['overallFile'] = {
                'filename': filename,
                'type': 'overall'
            }
            continue
        
        # 解析详情文件名
        # 格式: {单位名称}__{网站}__{状态}__{标识码}.xlsx
        name_without_ext = filename.replace('.xlsx', '')
        parts = name_without_ext.split('__')
        
        if len(parts) >= 4:
            file_info = {
                'filename': filename,
                'unitName': parts[0],
                'website': parts[1],
                'status': parts[2],
                'code': parts[3],
                'type': 'detail'
            }
            files['detailFiles'].append(file_info)
            print(f"解析文件: {filename}")
            print(f"  单位: {file_info['unitName']}")
            print(f"  网站: {file_info['website']}")
            print(f"  状态: {file_info['status']}")
            print(f"  标识: {file_info['code']}")
            print()
    
    return files

def generate_js_file_list(files, output_file='data/file_list.json'):
    """生成JavaScript可用的文件列表"""
    
    # 提取所有文件名
    file_list = []
    
    # 添加总体得分表
    if files['overallFile']:
        file_list.append(files['overallFile']['filename'])
    
    # 添加所有详情文件
    for detail_file in files['detailFiles']:
        file_list.append(detail_file['filename'])
    
    # 保存为JSON
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(file_list, f, ensure_ascii=False, indent=2)
    
    print(f"\n文件列表已保存到: {output_file}")
    print(f"共 {len(file_list)} 个文件")
    
    return file_list

def generate_mapping_report(files, output_file='data/mapping_report.txt'):
    """生成映射关系报告"""
    
    # 按单位名称分组
    unit_map = {}
    for detail_file in files['detailFiles']:
        unit_name = detail_file['unitName']
        if unit_name not in unit_map:
            unit_map[unit_name] = []
        unit_map[unit_name].append(detail_file)
    
    # 生成报告
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("=" * 60 + "\n")
        f.write("单位名称与详情文件映射关系报告\n")
        f.write("=" * 60 + "\n\n")
        
        f.write(f"总体得分表: {files['overallFile']['filename'] if files['overallFile'] else '未找到'}\n\n")
        f.write(f"详情文件数量: {len(files['detailFiles'])}\n")
        f.write(f"单位数量: {len(unit_map)}\n\n")
        
        f.write("-" * 60 + "\n")
        f.write("详细映射关系:\n")
        f.write("-" * 60 + "\n\n")
        
        for unit_name in sorted(unit_map.keys()):
            files_list = unit_map[unit_name]
            f.write(f"\n【{unit_name}】\n")
            for idx, file_info in enumerate(files_list, 1):
                f.write(f"  [{idx}] {file_info['filename']}\n")
                f.write(f"      网站: {file_info['website']}\n")
                f.write(f"      状态: {file_info['status']}\n")
                f.write(f"      标识: {file_info['code']}\n")
    
    print(f"映射报告已保存到: {output_file}")

def main():
    print("开始扫描数据文件...\n")
    
    # 扫描文件
    files = scan_data_files()
    
    # 生成文件列表
    generate_js_file_list(files)
    
    # 生成映射报告
    generate_mapping_report(files)
    
    print("\n扫描完成!")
    print(f"发现 {len(files['detailFiles'])} 个详情文件")
    if files['overallFile']:
        print(f"发现总体得分表: {files['overallFile']['filename']}")

if __name__ == '__main__':
    main()
