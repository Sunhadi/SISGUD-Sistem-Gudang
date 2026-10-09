const { ok } = require('../../utils/apiResponse');
const { validate } = require('../../middlewares/validate');
const service = require('./inventory.service');
const schemas = require('./inventory.schema');

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

exports.stocks = [
  validate({ query: schemas.stocksQuery }),
  wrap(async (req, res) => {
    const { data, meta } = await service.listStocks(req.query);
    ok(res, data, meta);
  }),
];

exports.summary = [
  validate({ query: schemas.summaryQuery }),
  wrap(async (req, res) => {
    const { data, meta } = await service.stockSummary(req.query);
    ok(res, data, meta);
  }),
];

exports.movements = [
  validate({ query: schemas.movementsQuery }),
  wrap(async (req, res) => {
    const { data, meta } = await service.listMovements(req.query);
    ok(res, data, meta);
  }),
];

exports.stockCard = [
  validate({ query: schemas.stockCardQuery }),
  wrap(async (req, res) => ok(res, await service.stockCard(Number(req.params.itemId), req.query))),
];

exports.lowStock = [
  validate({ query: schemas.lowStockQuery }),
  wrap(async (req, res) => {
    const { data, meta } = await paginateResult(await service.lowStock(), req.query);
    ok(res, data, meta);
  }),
];

exports.expiring = [
  validate({ query: schemas.expiringQuery }),
  wrap(async (req, res) => ok(res, await service.expiring(req.query.days))),
];

exports.transfer = [
  validate({ body: schemas.transferSchema }),
  wrap(async (req, res) => ok(res, await service.transferStock(req.body, req.user.id))),
];

exports.adjustment = [
  validate({ body: schemas.adjustmentSchema }),
  wrap(async (req, res) => ok(res, await service.adjustStock(req.body, req.user.id))),
];

// Helper: paginasi manual untuk hasil non-query (low-stock)
function paginateResult(rows, query) {
  const { pageOpts, metaOf } = require('../../utils/pagination');
  const { page, limit, offset } = pageOpts(query);
  const sliced = rows.slice(offset, offset + limit);
  return { data: sliced, meta: metaOf(page, limit, rows.length) };
}
