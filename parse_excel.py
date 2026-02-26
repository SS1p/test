import pandas as pd
import json
import os

def parse_overall_score_file(file_path):
    """解析总体得分表"""
    try:
        df = pd.read_excel(file_path)
        print(f"总体得分表列名: {df.columns.tolist()}")
        print(f"数据行数: {len(df)}")
        print("前5行数据:")
        print(df.head())
        
        # 转换为JSON格式
        data = df.to_dict('records')
        return data
    except Exception as e:
        print(f"解析总体得分表失败: {e}")
        return None

def parse_detail_file(file_path):
    """解析详细文件"""
    try:
        # 获取所有sheet名称
        excel_file = pd.ExcelFile(file_path)
        sheet_names = excel_file.sheet_names
        print(f"详细文件包含的sheet: {sheet_names}")
        
        # 解析每个sheet
        all_sheets = {}
        for sheet_name in sheet_names:
            df = pd.read_excel(file_path, sheet_name=sheet_name)
            print(f"\nSheet '{sheet_name}' 列名: {df.columns.tolist()}")
            print(f"数据行数: {len(df)}")
            print("前3行数据:")
            print(df.head(3))
            
            # 转换为JSON格式
            all_sheets[sheet_name] = df.to_dict('records')
        
        return all_sheets
    except Exception as e:
        print(f"解析详细文件失败: {e}")
        return None

if __name__ == "__main__":
    data_dir = "data"
    
    # 解析总体得分表
    overall_file = os.path.join(data_dir, "总体得分表_20260216_114402.xlsx")
    if os.path.exists(overall_file):
        print("=== 解析总体得分表 ===")
        overall_data = parse_overall_score_file(overall_file)
        
        if overall_data:
            # 保存为JSON文件供前端使用
            with open(os.path.join(data_dir, "overall_data.json"), "w", encoding="utf-8") as f:
                json.dump(overall_data, f, ensure_ascii=False, indent=2)
            print("总体得分表数据已保存为JSON文件")
    
    # 解析详细文件
    detail_file = os.path.join(data_dir, "成都市成华区融媒体中心__www.chrmpaper.com__OK__48a7d34d.xlsx")
    if os.path.exists(detail_file):
        print("\n=== 解析详细文件 ===")
        detail_data = parse_detail_file(detail_file)
        
        if detail_data:
            # 保存为JSON文件供前端使用
            with open(os.path.join(data_dir, "detail_data.json"), "w", encoding="utf-8") as f:
                json.dump(detail_data, f, ensure_ascii=False, indent=2)
            print("详细文件数据已保存为JSON文件")