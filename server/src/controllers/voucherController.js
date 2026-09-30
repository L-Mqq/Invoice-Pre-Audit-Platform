const voucherService = require('../services/voucherService')

// 获取列表
async function listVoucherGroups(req, res, next) {
  try {
    const result = await voucherService.listVoucherGroups({
      invoiceId: req.params.invoiceId,
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

// 创建凭证组
async function createVoucherGroup(req, res, next) {
  try {
    const result = await voucherService.createVoucherGroup({
      invoiceId: req.params.invoiceId,
      groupName: req.body?.groupName,
      operatorId: req.user.id,
    })

    res.status(201).json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

// 上传凭证文件
async function uploadVoucherFile(req, res, next) {
  try {
    const result = await voucherService.uploadVoucherFile({
      groupId: req.params.groupId,
      voucherType: req.params.voucherType,
      file: req.file,
      operatorId: req.user.id,
    })

    res.status(201).json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

// 审核凭证
async function reviewVoucherGroup(req, res, next) {
  try {
    const result = await voucherService.reviewVoucherGroup({
      groupId: req.params.groupId,
      reviewStatus: req.body?.reviewStatus,
      note: req.body?.note,
      operatorId: req.user.id,
    })

    res.json({
      success: true,
      data: result,
    })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  createVoucherGroup,
  listVoucherGroups,
  reviewVoucherGroup,
  uploadVoucherFile,
}
