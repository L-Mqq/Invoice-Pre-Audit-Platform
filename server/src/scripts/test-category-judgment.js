const { findRule } = require('../services/categoryJudgmentService')

const rules = [
  { ruleName: '摄像设备', keyword: '摄像头', categoryResult: '不可以' },
  { ruleName: '网络设备', keyword: '无线AP', categoryResult: '可以' },
]

const samples = ['公共安全设备 摄像头套装', '公共安全设备 数字图像接收模块']
for (const itemName of samples) {
  console.log({ itemName, matchedRule: findRule(itemName, rules) })
}
