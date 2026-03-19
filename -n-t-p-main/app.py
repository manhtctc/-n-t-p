import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
import google.generativeai as genai

app = Flask(__name__)
# CORS cho phép Frontend gọi vào Backend
CORS(app)

load_dotenv()

# 1. CẤU HÌNH AI
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash") 

if not GEMINI_API_KEY:
    raise RuntimeError(
        "Thiếu GEMINI_API_KEY. Hãy copy `.env.example` -> `.env` và điền key."
    )

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel(MODEL_NAME)

# 2. ĐỊNH NGHĨA ROUTE (Phải nằm TRÊN dòng app.run)
@app.route('/ai/analyze', methods=["POST"])
def analyze_weather():
    try:
        data = request.json
        weather_data = data.get('weather', {})
        user_query = data.get('query', '')
        style = data.get('style', 'serious')

        # Định nghĩa "nhân cách" AI dựa trên style
        if style == 'genz':
            persona = "Bạn là chuyên gia thời tiết Gen Z lầy lội, dùng từ ngữ như: slay, keo lỳ, chill, mãi mận, ổn áp, cướp cái vía..."
        else:
            persona = "Bạn là trợ lý thời tiết SafeWeather chuyên nghiệp, nghiêm túc và tận tâm."

        prompt = f"""
        {persona}
        
        DỮ LIỆU THỜI TIẾT THỰC TẾ:
        - Nhiệt độ: {weather_data.get('temp', 'N/A')}°C
        - Trạng thái: {weather_data.get('weatherDesc', 'Không rõ')}
        - Độ ẩm: {weather_data.get('humidity', 'N/A')}%
        - Tốc độ gió: {weather_data.get('windSpeed', 'N/A')} km/h
        
        CÂU HỎI NGƯỜI DÙNG: "{user_query}"
        
        YÊU CẦU: Dựa trên dữ liệu thực tế này, hãy trả lời câu hỏi và đưa ra lời khuyên phù hợp với phong cách đã định.
        """

        response = model.generate_content(prompt)
        return jsonify({"answer": response.text})
    
    except Exception as e:
        print(f"Lỗi phía Server: {e}")
        return jsonify({"answer": f"Lỗi hệ thống: {str(e)}"}), 500

# 3. CHẠY SERVER (Dòng này luôn nằm ở cuối cùng)
if __name__ == '__main__':
    print("--- Server đang chạy tại cổng 5000 ---")
    app.run(debug=True, port=5000)