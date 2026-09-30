const voucherFileService = require('../services/voucherFileService')

// 获取预览凭证文件
async function sendVoucherFile(req, res, next, disposition) {
  try {
    const result = await voucherFileService.getVoucherFileStream({
      voucherId: req.params.voucherId,
      disposition,
    })
    const encodedName = encodeURIComponent(result.voucher.original_name).replace(
      /['()]/g,
      escape,
    )

    res.setHeader(
      'Content-Type',
      result.voucher.mime_type || 'application/octet-stream',
    )
    res.setHeader('Content-Length', result.voucher.file_size)
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename*=UTF-8''${encodedName}`,
    )

    result.stream.on('error', next)
    result.stream.pipe(res)
  } catch (error) {
    next(error)
  }
}

function preview(req, res, next) {
  return sendVoucherFile(req, res, next, 'inline')
}

function download(req, res, next) {
  return sendVoucherFile(req, res, next, 'attachment')
}

module.exports = {
  download,
  preview,
}
