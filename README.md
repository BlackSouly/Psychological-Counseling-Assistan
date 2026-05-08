# Psychological Counseling Assistant

本项目是一个面向专业心理咨询师的本地网页工具，用于对会谈文本进行 AI 辅助分析。`V1` 聚焦纯文本流程，不包含语音上传与 ASR。

## 当前能力

- 来访者档案管理
- 来访者处理状态标注
- 会谈文本输入与分析
- 结构化情绪分析
- 独立风险预警通道
- REBT 风格结构化解读
- 历史记录时间线
- 专业反馈、评分与彩色批注
- 本地 JSON 存储

## 技术栈

- 前端：React 18 + TypeScript + Vite + Vitest
- 后端：FastAPI + Pydantic + httpx + pytest
- 模型接入：Anthropic-compatible Messages API

## 目录结构

```text
.
├─ backend/
│  ├─ app/
│  │  ├─ api/
│  │  ├─ models/
│  │  └─ services/
│  └─ tests/
├─ frontend/
│  ├─ src/
│  │  ├─ components/
│  │  └─ __tests__/
├─ docs/
├─ plans/
└─ prd (6).md
```

## 运行前准备

### 1. 前端依赖

在 `frontend/` 目录安装依赖：

```powershell
cd frontend
npm install
```

### 2. 后端 Python 依赖

建议使用 Python 3.11+。在 `backend/` 目录安装依赖：

```powershell
cd backend
pip install fastapi uvicorn pydantic httpx pytest
```

### 3. 模型环境变量

当前项目默认按 Anthropic-compatible 协议调用。若使用 DeepSeek Pro，可在启动后端前设置：

```powershell
$env:ANTHROPIC_BASE_URL="https://api.deepseek.com/anthropic"
$env:ANTHROPIC_MODEL="deepseek-v4-pro"
$env:ANTHROPIC_API_KEY="你的 DeepSeek API Key"
```

说明：

- 后端启动时会校验 AI 配置
- 禁止使用 `x666.me` 这类已屏蔽网关
- 若未配置 `ANTHROPIC_API_KEY`，默认服务不会启动

## 本地启动

### 启动后端

在 `backend/` 目录执行：

```powershell
cd backend
uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
```

后端健康检查：

- [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

### 启动前端

在 `frontend/` 目录执行：

```powershell
cd frontend
npm run dev
```

前端默认地址：

- [http://127.0.0.1:5173](http://127.0.0.1:5173)

Vite 已配置 `/api` 代理到 `http://127.0.0.1:8000`。

## 测试

### 后端测试

```powershell
cd backend
pytest tests -q
```

### 前端测试

```powershell
cd frontend
npm test
```

## 数据存储

- 来访者与会谈记录保存在 `backend/data/`
- 每位来访者对应一个独立目录
- `profile.json` 保存档案信息
- 每次分析会生成一条独立会谈记录 JSON

注意：

- `backend/data/` 已被 `.gitignore` 排除，不会进入仓库
- 本地日志文件也已排除

## 产品边界

本工具是“AI 辅助评估工具”，不是自动诊断系统。当前版本明确不做：

- 语音上传与 ASR
- 深层人格推断
- 防御机制细粒度识别
- 成因归因分析
- 来访者端应用

## GitHub

当前仓库已推送到：

- [https://github.com/BlackSouly/Psychological-Counseling-Assistan](https://github.com/BlackSouly/Psychological-Counseling-Assistan)
