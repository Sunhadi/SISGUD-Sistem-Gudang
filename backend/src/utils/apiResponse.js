/** Response API seragam sesuai blueprint: { success, data, meta } */
function ok(res, data, meta) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(200).json(body);
}

function created(res, data, meta) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(201).json(body);
}

function noContent(res) {
  return res.status(204).end();
}

module.exports = { ok, created, noContent };
