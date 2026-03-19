// const express = require("express");
// const cors = require("cors");
// const dotenv = require("dotenv");
// const OpenAI = require("openai");

// dotenv.config();

// const app = express();
// app.use(cors());
// app.use(express.json());

// if (!process.env.OPENAI_API_KEY) {
//   console.error("❌ Thiếu OPENAI_API_KEY");
//   process.exit(1);
// }

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// app.get("/", (req, res) => {
//   res.json({ message: "SafeWeather AI Backend Running 🚀" });
// });

// app.post("/ai-advice", async (req, res) => {
//   try {
//     const { weather } = req.body;

//     if (!weather) {
//       return res.status(400).json({ error: "Missing weather data" });
//     }

//     const prompt = `
// Bạn là chuyên gia thời tiết.

// Nhiệt độ: ${weather.temp}°C
// Mô tả: ${weather.desc}
// Gió: ${weather.wind} m/s
// Độ ẩm: ${weather.humidity}%

// Đưa ra:
// 1. Mức độ
// 2. Lý do
// 3. 3 lời khuyên
// `;

//     const completion = await openai.chat.completions.create({
//       model: "gpt-4.1-mini",
//       messages: [
//         { role: "system", content: "Chuyên gia thời tiết" },
//         { role: "user", content: prompt }
//       ]
//     });

//     res.json({
//       success: true,
//       advice: completion.choices[0].message.content
//     });

//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: "AI error" });
//   }
// });

// const PORT = 3000;
// app.listen(PORT, () => {
//   console.log(`🚀 Server chạy tại http://localhost:${PORT}`);
// });