# SafeWeather

Frontend: `main.html` + `main.css` + `main.js`  
Backend AI (Gemini): `app.py`

## Chạy frontend

- Mở `main.html` bằng trình duyệt (khuyên dùng VSCode Live Server), hoặc chạy debug bằng cấu hình `Open main.html`.

## Chạy backend AI

### 1) Cài Python dependencies

```bash
pip install -r requirements.txt
```

### 2) Tạo file cấu hình môi trường

- Copy `.env.example` thành `.env` và điền `GEMINI_API_KEY`.

### 3) Chạy server

```bash
python app.py
```

Server mặc định chạy `http://localhost:5000`.

## Kiểm tra model Gemini đang dùng

```bash
python check_models.py
```

