import os
from dotenv import load_dotenv
from google import genai

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError(
        "Thiếu GEMINI_API_KEY. Hãy copy `.env.example` -> `.env` và điền key."
    )

client = genai.Client(api_key=api_key)

print("--- Danh sách các model bạn có thể dùng: ---")
try:
    for m in client.models.list():
        # `m` có thể có các field khác nhau tùy version; chỉ in tên là đủ.
        print(getattr(m, "name", str(m)))
except Exception as e:
    print(f"Lỗi khi gọi API: {e}")