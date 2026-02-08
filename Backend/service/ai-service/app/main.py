from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from supabase import create_client, Client
import google.generativeai as genai
from fastapi import UploadFile, File, Form
import io
from PIL import Image

load_dotenv()
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

app = FastAPI(title="Mekong Sight AI Service")

# Cấu hình CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Trong production nên giới hạn lại
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cấu hình Supabase
url: str = os.environ.get("SUPABASE_URL", "")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
supabase: Client = create_client(url, key)

# Cấu hình Gemini
GEMINI_API_KEY = "AIzaSyAyiE2S8DYYO2Sp78dG58OyZj2LrEHSxsM"
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        # Sử dụng gemini-2.5-flash là phiên bản mới nhất, nhanh và mạnh mẽ
        model = genai.GenerativeModel('gemini-2.5-flash')
        print("SUCCESS: Gemini AI initialized with model: gemini-2.5-flash")
    except Exception as e:
        print(f"ERROR: Failed to initialize Gemini: {str(e)}")
        model = None
else:
    print("WARNING: GEMINI_API_KEY not found in environment variables")
    model = None

SYSTEM_PROMPT = """
Bạn là một chuyên gia nông nghiệp hàng đầu tại Đồng bằng sông Cửu Long. 
Nhiệm vụ của bạn là hỗ trợ nông dân phân tích hình ảnh về tôm và lúa.
1. Nếu thấy dấu hiệu bệnh (đốm trắng, đầu vàng, hoại tử gan tụy trên tôm; đạo ôn, bạc lá, rầy nâu trên lúa...), hãy gọi tên bệnh và giải thích nguyên nhân.
2. Đưa ra hướng xử lý thực tế, ưu tiên biện pháp bền vững, hữu cơ hoặc sử dụng chế phẩm sinh học.
3. Luôn dùng ngôn ngữ gần gũi, lễ phép, chân chất với nông dân (gọi 'Bà con', 'Tôi').
4. Nếu ảnh mờ hoặc không đủ dữ kiện, hãy hướng dẫn bà con cách chụp lại rõ hơn (ví dụ: chụp cận cảnh lá lúa bị cháy, hoặc chụp con tôm trên khay).
5. Nếu không phải ảnh nông nghiệp, hãy nhẹ nhàng từ chối và nhắc bà con đây là trợ lý chuyên về Tôm - Lúa.
"""

# --- NGƯỠNG SINH HỌC THIẾT YẾU (Core Knowledge Base) ---
BIOLOGICAL_THRESHOLDS = {
    "shrimp_rice": { 
        "shrimp_phase": {"min_salinity": 5, "max_salinity": 35, "ideal_ph": [7.0, 9.0]},
        "rice_phase": {"critical_salinity": 2.0, "safe_sowing": 0.5, "red_alert": 3.0}
    },
    "rice_only": {
        "st24_25": {"limit": 2.0},
        "om_5451": {"limit": 3.0},
        "dai_thom_8": {"limit": 3.0}
    },
    "shrimp_only": {
        "su_chan_trang": {"salinity": [5, 35], "ph": [7, 9], "temp": [18, 33]},
        "cang_xanh": {"ph": [7, 8.5], "temp": [29, 31], "min_water": 60}
    }
}

class AnalysisRequest(BaseModel):
    farm_id: str
    analysis_type: str  # 'salinity_forecast' | 'crop_health' | 'seasonal_switch'

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "ai-service"}

@app.post("/api/ai/analyze")
async def analyze_farm(request: AnalysisRequest, background_tasks: BackgroundTasks):
    # Tạo record để theo dõi task
    try:
        # Giả lập user_id (trong thực tế lấy từ JWT)
        farm_res = supabase.table("farms").select("user_id").eq("id", request.farm_id).single().execute()
        user_id = farm_res.data['user_id']
        
        supabase.table("analysis_requests").insert({
            "user_id": user_id,
            "farm_id": request.farm_id,
            "analysis_type": request.analysis_type,
            "status": "pending"
        }).execute()
        
        background_tasks.add_task(process_analysis, request.farm_id, request.analysis_type)
        return {"success": True, "message": "AI Analysis started"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai/recommendations/{farm_id}")
async def get_recommendations(farm_id: str):
    """
    Lấy khuyến nghị AI mới nhất cho trang trại
    """
    try:
        response = supabase.table("season_recommendations") \
            .select("*") \
            .eq("farm_id", farm_id) \
            .order("created_at", desc=True) \
            .limit(1) \
            .execute()
        
        if not response.data:
            return {"success": True, "data": None}
            
        return {"success": True, "data": response.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai/analysis-requests/{farm_id}")
async def get_analysis_history(farm_id: str):
    """
    Lấy lịch sử yêu cầu phân tích của trang trại
    """
    try:
        response = supabase.table("analysis_requests") \
            .select("*") \
            .eq("farm_id", farm_id) \
            .order("created_at", desc=True) \
            .limit(10) \
            .execute()
        return {"success": True, "data": response.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/chat")
async def chat_with_image(
    message: str = Form(...),
    image: UploadFile = File(None)
):
    """
    Chat với Gemini sử dụng hình ảnh (tùy chọn) để dự đoán/phân tích
    """
    try:
        if not GEMINI_API_KEY:
            return {"success": False, "message": "Gemini API Key is not configured"}

        content = [SYSTEM_PROMPT, message]
        
        if image:
            image_data = await image.read()
            img = Image.open(io.BytesIO(image_data))
            content.append(img)
            
        response = model.generate_content(content)
        
        return {
            "success": True, 
            "reply": response.text,
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        print(f"Gemini Chat Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def process_analysis(farm_id: str, analysis_type: str):
    try:
        # 1. Lấy thông tin farm để biết loại hình canh tác
        farm_res = supabase.table("farms").select("*").eq("id", farm_id).single().execute()
        farm = farm_res.data
        if not farm: return

        # 2. Lấy dữ liệu sensor 24h qua
        sensor_res = supabase.table("sensor_readings") \
            .select("salinity, ph, temperature, timestamp") \
            .eq("device_id", supabase.table("iot_devices").select("id").eq("farm_id", farm_id).limit(1).execute().data[0]['id']) \
            .order("timestamp", desc=True) \
            .limit(48) \
            .execute()
        
        readings = sensor_res.data
        if not readings: return

        current = readings[0]
        avg_salinity = np.mean([r['salinity'] for r in readings])
        
        # 3. LOGIC QUYẾT ĐỊNH DỰA TRÊN NGƯỠNG (Biological Logic)
        recommendation = ""
        explanation = ""
        severity = "info"

        farm_type = farm['farm_type']
        
        if farm_type == 'shrimp_rice':
            thresholds = BIOLOGICAL_THRESHOLDS["shrimp_rice"]
            
            # Giai đoạn HIỆN TẠI (Dựa trên tháng hoặc dữ liệu lịch sử)
            month = datetime.now().month
            is_dry_season = month in [1, 2, 3, 4, 5, 6] # Mùa khô - Tôm
            
            if is_dry_season:
                # Logic cho TÔM
                if current['salinity'] < thresholds["shrimp_phase"]["min_salinity"]:
                    recommendation = "Cảnh báo độ mặn THẤP cho Tôm"
                    explanation = f"Độ mặn hiện tại {current['salinity']}‰ thấp hơn ngưỡng 5‰. Có thể do mưa trái mùa, hãy hạn chế lấy nước và bổ sung khoáng."
                    severity = "warning"
                else:
                    recommendation = "Môi trường nuôi Tôm an toàn"
                    explanation = f"Độ mặn {current['salinity']}‰ nằm trong ngưỡng tối ưu (5-35‰)."
            else:
                # Logic cho LÚA
                if current['salinity'] > thresholds["rice_phase"]["critical_salinity"]:
                    recommendation = "CẢNH BÁO XÂM NHẬP MẶN"
                    explanation = f"Độ mặn {current['salinity']}‰ vượt ngưỡng an toàn cho lúa (2‰). Đóng cống ngăn mặn khẩn cấp!"
                    severity = "critical"
                elif 0.5 < current['salinity'] <= 1.0:
                    recommendation = "Đang trong giai đoạn rửa mặn"
                    explanation = "Độ mặn đang giảm dần. Vui lòng đợi dưới 0.5‰ để gieo sạ an toàn."
                else:
                    recommendation = "Vùng nuôi an toàn cho Lúa"
                    explanation = "Các chỉ số môi trường đang ở mức lý tưởng."

        # 4. Lưu kết quả
        supabase.table("season_recommendations").insert({
            "farm_id": farm_id,
            "current_salinity_avg": avg_salinity,
            "salinity_trend": "stable",
            "recommended_action": recommendation,
            "explanation": explanation,
            "status": "suggested"
        }).execute()

    except Exception as e:
        print(f"AI Error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # Sử dụng reload=True để tự động cập nhật code khi sửa file
    # Chỉ định app_dir="app" vì main.py nằm trong thư mục app/
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, app_dir="app")
