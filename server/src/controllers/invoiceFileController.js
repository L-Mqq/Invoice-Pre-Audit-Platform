const invoiceFileService = require('../services/invoiceFileService')

async function sendFile(req, res, next, disposition) {
  try {
    const result = await invoiceFileService.getFileStream({
      fileId: req.params.fileId,
      disposition,
    })
    const encodedName = encodeURIComponent(result.file.original_name).replace(/['()]/g, escape)
    res.setHeader('Content-Type', result.file.mime_type || 'application/octet-stream')
    res.setHeader('Content-Length', result.file.file_size)
    res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodedName}`)
    result.stream.on('error', next)
    result.stream.pipe(res)
  } catch (error) {
    next(error)
  }
}

function preview(req, res, next) {
  return sendFile(req, res, next, 'inline')
}

function download(req, res, next) {
  return sendFile(req, res, next, 'attachment')
}

module.exports = { preview, download }
