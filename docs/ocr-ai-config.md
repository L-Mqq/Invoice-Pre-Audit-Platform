# OCR 与 AI 结构化配置

系统接收 PDF、多个 PDF 或 ZIP 中的 PDF。后端优先提取 PDF 原生文本，再使用 Agnes 将文本结构化为固定发票 Schema；原生文本为空、结构化失败、字段校验失败或得到空模板时，才调用腾讯云 OCR 兜底。

当前上传接口不接收图片文件。腾讯云 OCR 的图片能力属于服务能力，但不等于本项目已提供图片上传入口。

## 处理链路

```text
PDF 或 ZIP 内的 PDF
  ↓
unpdf 提取原生文本和页数
  ↓
Agnes 按固定 JSON Schema 结构化
  ↓
程序校验发票字段、金额和商品明细
  ├─ 校验通过：进入品类和预审规则
  └─ 文本为空或结构化结果不可用：腾讯云 OCR
                                     ↓
                         Agnes 基于 OCR JSON 再次结构化
                                     ↓
                         程序校验并进入人工补全或预审
```

AI 原始结构化调用结果保存到 `invoices.ai_raw_result`。当前没有用于长期保存“腾讯 OCR 原始响应”或“OCR 文本”的独立数据库字段；如需追溯该证据，应先设计字段、存储策略和脱敏方案。

## 配置

在 `server/.env` 中配置。可从 `server/.env.example` 复制：

```env
# 腾讯云 OCR 凭证与地域
TENCENTCLOUD_SECRET_ID=your-secret-id
TENCENTCLOUD_SECRET_KEY=your-secret-key
TENCENTCLOUD_OCR_REGION=ap-guangzhou

# 腾讯云 OCR 请求参数
TENCENTCLOUD_OCR_ENABLE_PDF=true
TENCENTCLOUD_OCR_ENABLE_MULTIPLE_PAGE=true
TENCENTCLOUD_OCR_ENABLE_OTHER=true
TENCENTCLOUD_OCR_MAX_PAGES=30
TENCENTCLOUD_OCR_MAX_BASE64_SIZE=10485760
TENCENTCLOUD_OCR_CONCURRENCY=5
TENCENTCLOUD_OCR_RATE_LIMIT=5
TENCENTCLOUD_OCR_MAX_RETRIES=3
TENCENTCLOUD_OCR_RETRY_BASE_DELAY_MS=500

# Agnes OpenAI 兼容接口
AGNES_API_KEY=your-agnes-api-key
AGNES_BASE_URL=https://apihub.agnes-ai.com/v1
AGNES_MODEL=agnes-2.5-flash
AGNES_TIMEOUT_MS=30000
```

参数说明：

| 参数 | 含义 |
|---|---|
| `TENCENTCLOUD_OCR_ENABLE_PDF` | 是否让腾讯云 OCR 处理 PDF |
| `TENCENTCLOUD_OCR_ENABLE_MULTIPLE_PAGE` | 是否开启多页识别 |
| `TENCENTCLOUD_OCR_ENABLE_OTHER` | 是否返回其他票据类型结果 |
| `TENCENTCLOUD_OCR_MAX_PAGES` | 单份 PDF 可进入 OCR 的最大页数，默认 30 |
| `TENCENTCLOUD_OCR_MAX_BASE64_SIZE` | OCR 请求 Base64 内容最大字节数，默认 10 MB |
| `TENCENTCLOUD_OCR_RATE_LIMIT` | 本地限流队列每秒最大请求数，默认 5 |
| `TENCENTCLOUD_OCR_MAX_RETRIES` | 可重试错误的最大重试次数，默认 3 |
| `TENCENTCLOUD_OCR_RETRY_BASE_DELAY_MS` | 指数退避基础延迟，默认 500 毫秒 |
| `AGNES_TIMEOUT_MS` | Agnes 请求超时，默认 30 秒 |

`TENCENTCLOUD_OCR_CONCURRENCY` 当前虽保留在配置模板中，但 OCR 实现使用串行限流队列，尚未读取该参数控制并发。

## 输出和校验

Agnes 通过 OpenAI 兼容的 `/chat/completions` 接口调用，并使用 JSON 输出模式。结构化字段包括：

- 发票号码、开票日期；
- 销售方名称和销售方纳税人识别号；
- 购买方信息、价税合计、税额和不含税金额；
- 商品名称、数量、单价和商品行金额。

服务端随后校验必填字段、日期、非负数值、数量乘单价与行金额的一致性、商品明细合计与不含税金额的一致性，以及税额、不含税金额与价税合计的一致性。无法可靠识别或校验不通过的数据会进入人工补全流程。

## 安全要求

- 腾讯云 `SecretId`、`SecretKey` 和 Agnes API Key 只保存在服务端 `.env`，不要写入前端、数据库、日志或 Git。
- 建议为腾讯云账号使用最小权限的子账号或 API 密钥。
- 若密钥曾出现在聊天记录、截图、日志或提交历史中，应立即撤销并重新生成。
- OCR 和 AI 输入可能包含发票及支付信息，应在生产环境评估供应商合规要求、数据脱敏、访问控制和留存期限。
