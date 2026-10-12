const OpenAI = require('openai')
const { getExtractionConfig } = require('../config/extraction')
const { validateCategoryJudgment } = require('../validators/categoryJudgmentValidator')

const CATEGORY_SCHEMA = {
  categoryResult: '可以|存疑|不可以',
  matchedRule: 'null',
  reason: '基于商品名称中明确出现信息的简短判断依据',
  confidence: '0 到 1 之间的数字',
}

const CATEGORY_SYSTEM_PROMPT = [
  '你是商品品类审核辅助助手，只能返回 JSON。',
  '规则关键词的直接命中由程序在调用你之前处理；当前商品未直接命中规则。数据库规则仅可作为品类定义参考，matchedRule 必须返回 null。',
  'categoryResult 只能是“可以”“存疑”“不可以”。',
  '只能依据商品名称中明确出现的名称、型号、规格和用途判断；不得用常识补全未出现的属性，不得猜测用途、功能或组成。',
  '只有商品名称明确表明其为电子元器件、通信模组、开发板、传感器、线材、接插件等材料性组件时，才能返回“可以”。',
  '只有商品名称明确表明其为整机、设备、仪器、电脑、显示器、办公用品、生活用品、服务或禁止品类时，才能返回“不可以”。',
  '名称宽泛、缺少型号规格用途，或无法区分组件与完整设备时，必须返回“存疑”。',
  '“智能模块”单独出现时必须返回“存疑”；不得仅因出现“智能”“模块”“控制”“通信”等词就返回“可以”。',
  '“设备”“系统”“终端”“主机”“套装”“仪器”“平台”等宽泛词，缺少明确型号、规格或用途时必须返回“存疑”。',
  '不得自行拆分商品，不得编造规则，不得根据单价判断品类。',
  'reason 只能引用商品名称中的明确证据；若返回“存疑”，必须说明缺少型号、规格或用途等信息。',
  '示例：商品“智能模块”应返回“存疑”，原因是名称宽泛且缺少型号、规格和用途。',
  '示例：商品“4G 通信模组 EC200U”可返回“可以”，原因是名称明确为通信模组且包含型号。',
].join('\n')

function createCategoryMessages({
  itemName,
  rules,
}) {
  return [
    {
      role: 'system',
      content: CATEGORY_SYSTEM_PROMPT,
    },
    {
      role: 'user',
      content: JSON.stringify({
        schema: CATEGORY_SCHEMA,
        itemName,
        rules,
      }),
    },
  ]
}

// 调用 Agnes AI；
function getClient() {
  const { agnes } = getExtractionConfig()
  if (!agnes.apiKey) throw new Error('AGNES_API_KEY is required')
  return { client: new OpenAI({ apiKey: agnes.apiKey, baseURL: agnes.baseURL, timeout: agnes.timeout }), model: agnes.model }
}

// 按固定 JSON 结构返回品类结果
async function classifyItem({ itemName, rules }) {
  if (!itemName || !String(itemName).trim()) throw new Error('itemName is required')
  const { client, model } = getClient()
  const response = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: createCategoryMessages({
      itemName,
      rules,
    }),
  })
  let parsed
  try { parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}') } catch { throw new Error('Category AI returned invalid JSON') }
  const validation = validateCategoryJudgment(parsed)
  if (!validation.valid) throw new Error(validation.errors.join('; '))
  return { ...validation.data, rawResult: response }
}

module.exports = {
  CATEGORY_SYSTEM_PROMPT,
  classifyItem,
  createCategoryMessages,
}
