# OCR 与 AI 结构化配置

本项目建议使用腾讯云 OCR 识别文字，再使用 Agnes `agnes-2.5-flash` 将 OCR 文本转换为固定发票 Schema。

## 需要填写的参数

在 `server/.env` 中加入以下配置：

```env
# 腾讯云 OCR
TENCENTCLOUD_SECRET_ID=你的腾讯云SecretId
TENCENTCLOUD_SECRET_KEY=你的腾讯云SecretKey
TENCENTCLOUD_OCR_REGION=ap-guangzhou

# Agnes
AGNES_API_KEY=你的新Agnes密钥
AGNES_BASE_URL=https://apihub.agnes-ai.com/v1
AGNES_MODEL=agnes-2.5-flash
AGNES_TIMEOUT_MS=30000
```

腾讯云需要在访问管理控制台创建 SecretId 和 SecretKey，并为账号授予 OCR 最小权限。不要把密钥放到前端、数据库、日志或 Git。

Agnes 使用 OpenAI 兼容接口，模型名为 `agnes-2.5-flash`，服务端通过 `Authorization: Bearer <AGNES_API_KEY>` 调用 `/chat/completions`。

## 处理链路

```text
PDF/图片
  ↓
腾讯云 OCR
  ↓
保存 OCR 原始文本
  ↓
Agnes 按固定 Schema 结构化
  ↓
程序校验字段和金额
  ↓
写入 invoices / invoice_items
```

## 你需要输入的内容

1. 腾讯云 `SecretId`
2. 腾讯云 `SecretKey`
3. 腾讯云 OCR 服务地域，默认可使用 `ap-guangzhou`
4. Agnes 新生成的 API Key

之前在聊天中发送的 Agnes 密钥已经暴露，不能继续使用，请先撤销并重新生成。
