const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中間件
app.use(cors());
app.use(express.json());

// 連接到 MongoDB
mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/campus-crypto", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch(err => console.error("❌ MongoDB connection error:", err));

// 問卷回答 Schema
const surveyResponseSchema = new mongoose.Schema({
  taskId: { type: Number, required: true },
  studentAddress: { type: String, required: true },
  answers: { type: Object, required: true },
  submittedAt: { type: Date, default: Date.now },
});

const SurveyResponse = mongoose.model("SurveyResponse", surveyResponseSchema);

// 驗證 JWT 中間件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: "Access token required" });

  jwt.verify(token, process.env.JWT_SECRET || "your-secret-key", (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

// API 路由

// 測試路由
app.get("/", (req, res) => {
  res.json({ message: "Backend Server is Running!", timestamp: new Date() });
});

// 提交問卷回答
app.post("/api/survey/submit", async (req, res) => {
  try {
    const { taskId, studentAddress, answers } = req.body;

    if (!taskId || !studentAddress || !answers) {
      return res.status(400).json({ error: "Missing required fields: taskId, studentAddress, answers" });
    }

    // 檢查是否已提交過
    const existing = await SurveyResponse.findOne({ taskId, studentAddress });
    if (existing) {
      return res.status(409).json({ error: "Survey already submitted for this task" });
    }

    // 儲存回答
    const response = new SurveyResponse({
      taskId,
      studentAddress,
      answers,
    });

    await response.save();

    res.json({
      success: true,
      message: "Survey submitted successfully",
      data: {
        id: response._id,
        taskId,
        studentAddress,
        submittedAt: response.submittedAt,
      }
    });
  } catch (error) {
    console.error("Survey submit error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 查詢特定任務的問卷回答
app.get("/api/survey/:taskId/responses", authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { studentAddress } = req.query;

    const query = { taskId: parseInt(taskId) };
    if (studentAddress) {
      query.studentAddress = studentAddress;
    }

    const responses = await SurveyResponse.find(query).sort({ submittedAt: -1 });

    res.json({
      success: true,
      data: responses.map(r => ({
        id: r._id,
        taskId: r.taskId,
        studentAddress: r.studentAddress,
        answers: r.answers,
        submittedAt: r.submittedAt,
      }))
    });
  } catch (error) {
    console.error("Survey responses query error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 查詢學生已提交的問卷
app.get("/api/student/:address/surveys", async (req, res) => {
  try {
    const { address } = req.params;

    const responses = await SurveyResponse.find({ studentAddress: address }).sort({ submittedAt: -1 });

    res.json({
      success: true,
      data: responses.map(r => ({
        id: r._id,
        taskId: r.taskId,
        answers: r.answers,
        submittedAt: r.submittedAt,
      }))
    });
  } catch (error) {
    console.error("Student surveys query error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 統計問卷回答數量
app.get("/api/survey/:taskId/stats", authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;

    const count = await SurveyResponse.countDocuments({ taskId: parseInt(taskId) });

    res.json({
      success: true,
      data: {
        taskId: parseInt(taskId),
        totalResponses: count,
      }
    });
  } catch (error) {
    console.error("Survey stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

