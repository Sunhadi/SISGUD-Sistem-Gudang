/** Helper pagination: parsing query & bentuk meta */
function pageOpts(query = {}) {
  const page = Math.max(parseInt(query.page || '1', 10) || 1, 1);
  let limit = parseInt(query.limit || '20', 10) || 20;
  limit = Math.min(Math.max(limit, 1), 100);
  return { page, limit, offset: (page - 1) * limit };
}

function metaOf(page, limit, total) {
  return {
    page,
    limit,
    total,
    total_pages: Math.max(Math.ceil(total / limit), 1),
  };
}

module.exports = { pageOpts, metaOf };
