const OpenAI = require('openai')
const { getExtractionConfig } = require('../config/extraction')
const { validateCategoryJudgment } = require('../validators/categoryJudgmentValidator')

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
    messages: [
      { role: 'system', content: '你是商品品类审核助手。只能返回 JSON。只能使用“可以”“存疑”“不可以”作为 categoryResult。必须依据提供的数据库规则进行语义判断；无法可靠判断时返回“存疑”，不得自行拆分或编造规则。' },
      { role: 'user', content: JSON.stringify({ schema: { categoryResult: '可以|存疑|不可以', matchedRule: '命中的规则名称或null', reason: '简短判断依据', confidence: '0到1之间数字' }, itemName, rules }) },
    ],
  })
  let parsed
  try { parsed = JSON.parse(response.choices?.[0]?.message?.content || '{}') } catch { throw new Error('Category AI returned invalid JSON') }
  const validation = validateCategoryJudgment(parsed)
  if (!validation.valid) throw new Error(validation.errors.join('; '))
  return { ...validation.data, rawResult: response }
}

module.exports = { classifyItem }
