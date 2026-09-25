const fs = require('node:fs/promises')
const path = require('node:path')

const filePath = path.resolve(
  __dirname,
  '../../../storage/03cde7c7-a060-4c2e-bc0e-202f04f6cbf0/6d43aef4-3f0e-42ea-ac98-6d4ef37c17d0-test1.pdf',
)

async function main() {
  const buffer = await fs.readFile(filePath)
  const { extractText, getDocumentProxy } = await import('unpdf')
  const document = await getDocumentProxy(new Uint8Array(buffer))

  try {
    const result = await extractText(document, { mergePages: true })

    console.log('✅ unpdf 正常')
    console.log('文本长度:', result.text.length)
    console.log('页数:', Number(result.totalPages) || 0)
  } finally {
    
    
  }
}

main().catch((error) => {
  console.error('❌ unpdf 报错')
  console.error('错误信息:', error.message)
  console.error('错误堆栈:', error.stack)
  process.exitCode = 1
})
