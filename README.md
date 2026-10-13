# 材料费发票智能预审与管理平台

这是一个面向材料费报销场景的发票预审与管理系统。系统支持上传单个 PDF、多个 PDF 或 ZIP 批次，提取发票和商品信息，并依据商品品类、单价、同销售方自然周累计、支付凭证及重复发票规则完成预审。管理员可在工作台中处理异常、补全资料、审核凭证、提交财务并维护最终报销状态。

当前版本仅实现 `admin` 管理员角色。数据库保留了其他角色枚举，但相关权限和页面尚未实现。

## 主要技术选型

| 层级     | 技术                                                            |
| -------- | --------------------------------------------------------------- |
| 前端     | Vue 3、TypeScript、Vite、Vue Router、Pinia、Element Plus、Axios |
| 后端     | Node.js、Express、JWT、Multer                                   |
| 数据库   | MySQL 8、`mysql2/promise`、原生参数化 SQL                       |
| 文件处理 | `unpdf`、`adm-zip`、本地文件存储                                |
| OCR      | 腾讯云 OCR `RecognizeGeneralInvoice`                            |
| AI       | Agnes OpenAI 兼容接口，默认模型 `agnes-2.5-flash`               |

后端采用 Controller、Service、Repository 分层。确定性业务规则由程序执行，AI 仅负责结构化抽取和品类辅助判断。

## 环境要求

- Node.js `22.18+`，或 `24.12+`
- npm（随 Node.js 安装）
- MySQL 8.0+
- 可用的腾讯云 OCR 凭证
- 可用的 Agnes API Key
- 能访问腾讯云 OCR 和 Agnes API 的网络环境

项目默认使用以下端口：

- 后端：`http://localhost:3000`
- 前端：Vite 默认地址，通常为 `http://localhost:5173`

## 目录结构

```text
.
├─ frontend/              # Vue 前端
├─ server/                # Express 后端
├─ sql/
│  ├─ schema.sql          # 最新空库初始化脚本
│  └─ migrations/         # 已有数据库的历史增量迁移
├─ docs/                  # 数据库及 OCR/AI 说明
├─ storage/               # 发票和凭证文件，本地运行时生成
└─ README.md
```

## 初始化数据库

最新的 [`sql/schema.sql`](sql/schema.sql) 已合并 `002–010` 迁移的最终结构和 149 条默认品类规则。

对于全新环境：

1. 使用有建库权限的 MySQL 账号连接数据库。
2. 完整执行 `sql/schema.sql`。
3. 确认创建了数据库 `invoice_pre_audit` 和 11 张业务表。
4. 确认 `category_rules` 中有 149 条初始规则。

注意：

- 全新数据库只执行一次 `schema.sql`。
- 不要在新库执行完 `schema.sql` 后再次运行 `002–010` 迁移。
- `schema.sql` 的建表语句可跳过已存在的表，但种子数据使用普通 `INSERT`；重复执行会重复写入 149 条品类规则。
- `sql/migrations` 用于按实际缺失版本升级旧数据库，不是新库初始化步骤。

## 配置后端

进入后端目录，复制配置模板：

```bash
cd server
copy .env.example .env
```

在 macOS 或 Linux 中使用：

```bash
cp .env.example .env
```

编辑 `server/.env`：

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=invoice_pre_audit
DB_USER=root
DB_PASSWORD=your-database-password
DB_CONNECTION_LIMIT=10
DB_TIMEZONE=+08:00

NODE_ENV=development
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=2h

TENCENTCLOUD_SECRET_ID=your-secret-id
TENCENTCLOUD_SECRET_KEY=your-secret-key
TENCENTCLOUD_OCR_REGION=ap-guangzhou

AGNES_API_KEY=your-agnes-api-key
AGNES_BASE_URL=https://apihub.agnes-ai.com/v1
AGNES_MODEL=agnes-2.5-flash
AGNES_TIMEOUT_MS=30000
```

OCR 页数、文件体积、限流和重试参数请参考 [`server/.env.example`](server/.env.example)。`server/.env` 已被 Git 忽略，不要提交真实密钥。

开发和测试环境可以通过 `BUSINESS_NOW` 固定业务时间，以验证自然周边界；生产环境会忽略该覆盖值。

## 安装与启动

### 1. 启动后端

```bash
cd server
npm install
npm run db:check
npm run dev
```

生产式启动命令：

```bash
npm start
```

健康检查：

```text
GET http://localhost:3000/api/health
```

### 2. 启动前端

另开一个终端：

```bash
cd frontend
npm install
npm run dev
```

前端默认访问 `http://localhost:3000/api`。如后端部署在其他地址，可在 `frontend/.env.local` 中配置：

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

### 3. 创建管理员并登录

首次运行可在登录页注册管理员账号。当前注册流程创建的账号角色为 `admin`。注册完成后登录即可进入审核工作台。

## AI 与 OCR 方案

发票处理链路如下：

```text
PDF 上传
  → unpdf 尝试提取文本并读取页数
  → 文本不足或不可可靠使用时调用腾讯云 OCR
  → Agnes 按固定 JSON Schema 结构化
  → 程序校验必填字段、日期、金额和商品明细
  → 长期品类规则优先匹配，未命中时由 AI 辅助分类
  → 确定性规则引擎完成价格、累计、凭证和状态判断
  → 写入 MySQL，并保留原始 AI 结果及操作日志
```

AI 结构化输出包括发票号码、开票日期、销售方、销售方税号、价税合计及商品名称、数量、单价和金额。输出经过服务端校验；缺失或不可靠的数据进入人工补全流程。

品类判断只接受 `可以`、`存疑`、`不可以`：

- 管理员维护的长期关键词规则优先于 AI。
- AI 返回非法结果、调用失败或无法可靠判断时统一转为“存疑”。
- AI 原始结果与人工结果分开保存，人工确认不会覆盖原始证据。

腾讯 OCR 调用实现了请求限流、指数退避重试、PDF 多页开关和 Base64 体积限制。详细参数参见 [`docs/ocr-ai-config.md`](docs/ocr-ai-config.md)。

## 核心业务规则

### 商品单价

- `< 500` 元：材料，继续执行自然周累计规则。
- `500 <= 单价 < 1000` 元：低值品，必须提供完整支付凭证。
- `>= 1000` 元：资产，当前发票不能走材料费流程。

系统使用高精度十进制处理商品单价，数据库字段为 `DECIMAL(24,13)`，避免电子发票单价在入库时被截断。

### 自然周累计

自然周为周一至周日，按以下条件分组：

- 销售方纳税人识别号
- 发票提交审核时间
- 发票价税合计

只统计资质审核通过的有效发票：

- 累计 `<= 1000` 元：正常继续。
- 累计 `> 1000` 且 `<= 3000` 元：进入周累计凭证补齐流程。
- 累计 `> 3000` 元：当前发票直接不通过。

周累计凭证审核完成前会重新计算累计金额，相关查询和状态变更使用事务及必要的行锁。

### 支付凭证

- 一张发票可以建立多个凭证组。
- 每个凭证组只属于一张发票。
- 完整凭证组必须同时包含订单截图和支付记录。
- 凭证由管理员人工审核。
- 周累计超过 1000 元时，系统跟踪同一销售方、同一自然周内关联发票的凭证完成进度。

### 状态维度

系统分别保存三类状态：

- 资质审核：待审核、待补凭证、待人工处理、审核通过、审核不通过、已取消。
- 财务提交：未提交、已提交。
- 最终报销：未完成、报销成功、报销失败。

三个维度独立维护，避免财务或报销状态覆盖资质审核结果。

## 数据库设计思路

数据库共 11 张业务表：

| 表                                    | 用途                                 |
| ------------------------------------- | ------------------------------------ |
| `users`                               | 用户、角色和启用状态                 |
| `upload_batches`                      | 单 PDF、多 PDF 或 ZIP 上传批次       |
| `invoice_files`                       | 原始文件、哈希、提取状态和批次关联   |
| `invoices`                            | 发票主数据及三个状态维度             |
| `invoice_items`                       | 商品明细、价格分类及 AI/人工品类结果 |
| `category_rules`                      | 管理员维护的长期品类关键词规则       |
| `voucher_groups`                      | 发票凭证组及人工审核结果             |
| `vouchers`                            | 订单截图、支付记录等凭证文件         |
| `weekly_voucher_requirements`         | 销售方自然周凭证补齐任务             |
| `weekly_voucher_requirement_invoices` | 周任务与关联发票的完成进度           |
| `operation_logs`                      | 人工修改、审核和状态变更审计日志     |

设计原则：

- 业务 SQL 集中在 Repository 层，全部使用参数绑定。
- 发票、原始文件、商品明细和上传批次分表，支持单文件失败隔离及追溯。
- AI 原始结果、人工结果和最终结果分开保存。
- 自然周任务单独建模，支持同一销售方同周多张发票共同补凭证。
- 通过外键、唯一索引、生成列及 `CHECK` 约束保证关键数据一致性。
- 文件只保存相对存储标识，通过鉴权接口预览或下载，不向前端返回服务器绝对路径。

数据库字段详情参见 [`sql/schema.sql`](sql/schema.sql)。

## 已实现功能

- 管理员注册、登录、JWT 鉴权和会话恢复
- 审核工作台、待办统计、异常列表和快捷入口
- 单 PDF、多 PDF、单 ZIP 上传
- ZIP 内 PDF 递归路径发现及逐文件独立处理
- PDF 原生文本提取和腾讯云 OCR 兜底
- Agnes 固定 Schema 发票结构化及服务端校验
- 识别失败或字段缺失后的人工资料补全
- 商品单价分类、长期品类规则和 AI 辅助品类判断
- 商品品类人工确认及原始结果保留
- 重复发票检测、多候选逐一确认和人工判定
- 同销售方自然周累计及 1000/3000 元边界处理
- 低值品凭证和跨发票周累计凭证任务
- 凭证组创建、文件上传、预览、下载和人工审核
- 发票列表、详情、状态筛选和文件预览/下载
- 按销售方和自然周查看财务组、整组提交财务
- 最终报销成功或失败状态维护
- 品类规则分组、启停、编辑、删除、测试匹配和操作日志
- 操作日志及关键状态变更留痕

## 测试与检查命令

后端提供以下脚本：

```bash
cd server
npm run db:check
npm run test:invoice-validator
npm run test:price-judgment
npm run test:category-prompt
npm run test:invoice-prompt
npm run test:duplicate-category-recovery
npm run test:unit-price-precision
```

部分 OCR/AI 测试脚本需要真实凭证、外部服务和 `storage` 中的测试文件。前端可执行：

```bash
cd frontend
npm run type-check
npm run build
```

### 财务提交时间边界测试

使用 `BUSINESS_NOW` 可以在开发或测试环境模拟当前业务时间，验证自然周结束前后能否提交财务。该变量只在 `NODE_ENV=development` 或 `NODE_ENV=test` 时生效；每次修改后都需要重启后端。

请使用独立的测试数据库，在 `server/.env` 中临时设置：

```env
NODE_ENV=test
BUSINESS_NOW=2026-10-18T23:59:59+08:00
```

准备同一销售方、自然周为 `2026-10-12` 至 `2026-10-18` 的测试发票，并确保该组发票均已审核通过、没有待处理的周累计凭证任务、累计金额不超过 3000 元。此时提交财务应被拒绝，提示自然周尚未结束。

随后将时间改为下周一零点并重启后端：

```env
BUSINESS_NOW=2026-10-19T00:00:00+08:00
```

再次提交同一组，预期可以提交成功；组内审核通过发票的 `finance_status` 应变为 `submitted`。还应分别准备以下反例，确认即使已到下周一仍会被拒绝：

- 组内存在待审核、待人工处理或待补凭证的发票；
- 周累计凭证补齐任务尚未完成；
- 审核通过发票的同周累计金额超过 3000 元；
- 该组已经提交过财务。

测试完成后，请清空 `BUSINESS_NOW`、恢复原有 `NODE_ENV`，并重启后端，避免固定时间影响正常业务。

## 已知问题与限制

- 当前仅开放管理员角色，普通用户、审核人员和财务人员的独立权限尚未实现。
- 目前任何能访问登录页的人都可以注册管理员账号。正式上线前，应改为仅允许指定人员创建账号，例如由现有管理员在后台创建，或要求填写一次性邀请码。
- 当前登录 JWT 保存在浏览器 `localStorage`，一旦页面存在 XSS 漏洞，恶意脚本可能读取并盗用管理员令牌。生产环境应改由后端通过 `HttpOnly`、`Secure`、`SameSite` Cookie 保存会话令牌，前端启用带凭证请求，并配合 CSRF 防护、严格的 CORS 白名单和内容安全策略（CSP）。
- 当前访问令牌默认有效期为 2 小时；到期后接口会返回未登录，前端会清除令牌并跳回登录页，可能中断正在填写或审核的工作。生产环境建议采用短期访问令牌加长期刷新令牌：在访问令牌即将到期时静默刷新，刷新令牌使用 `HttpOnly` Cookie 保存并实施轮换和撤销；同时在续期失败前给出明确提示，并在跳转登录前保护或提示保存未提交的数据。
- 重复发票目前主要按销售方税号和发票号码识别，只能作为疑似重复提示；尚未接入税务验真，也不会结合发票代码、开票日期和金额等信息自动确认。
- 当前由管理员完成上传、品类确认、凭证审核和财务提交等操作，尚未实现不同人员分别审核、提交的职责分离。
- 发票作废、红冲、部分退货或金额变更等后续业务场景尚无专门处理流程，目前需要人工取消或重新处理。
- 品类规则可以修改，但尚未提供严格的规则版本和生效时间管理；追溯历史发票的判断依据需依赖操作日志。
- 同一销售方、同一自然周内只要仍有待审核或待补凭证发票，整组就不能提交财务。这是当前的保守策略；若实际业务允许已通过发票先提交，需要调整规则。
- `schema.sql` 面向全新空库且只应执行一次；重复执行会重复插入 149 条品类规则。
- 当前支持单个 ZIP 或一组 PDF，不支持 PDF 与 ZIP 混合上传，也不递归解压 ZIP 中的 ZIP。
- 上传内容使用内存缓冲：发票单文件上限 20 MB、单次最多 50 个文件；凭证单文件上限 10 MB。大批量场景需要改为流式处理或任务队列。
- 文件保存在本机 `storage`，尚未接入对象存储、备份、生命周期管理和多实例共享。
- OCR 和 AI 依赖外部服务，可能受到网络、配额、限流、模型输出及费用影响；异常数据仍需人工确认。
- `TENCENTCLOUD_OCR_CONCURRENCY` 已出现在配置模板中，但当前 OCR 实现采用串行限流队列，尚未使用该并发参数。
- 开发环境默认允许跨域访问；生产环境应限制 CORS 来源、启用 HTTPS，并配置安全的长随机 `JWT_SECRET`。

## 安全注意事项

- 不要提交 `server/.env`、真实发票、支付凭证或任何云服务密钥。
- 若密钥曾出现在日志、截图、聊天或提交历史中，应立即撤销并重新生成。
- 生产环境应使用最小权限数据库账号和腾讯云子账号权限。
- `storage` 包含敏感业务文件，应限制文件系统权限并制定备份和清理策略。
