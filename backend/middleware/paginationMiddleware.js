export const paginateResults = (model) => async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const sort = req.query.sort || '-createdAt';
  const filter = req.query.filter ? JSON.parse(req.query.filter) : {};

  try {
    const startIndex = (page - 1) * limit;
    
    // Build search query if search parameter is provided
    const searchQuery = search
      ? { $text: { $search: search } }
      : {};

    // Combine search query with other filters
    const query = { ...searchQuery, ...filter };

    const results = await model
      .find(query)
      .sort(sort)
      .limit(limit)
      .skip(startIndex)
      .exec();

    const total = await model.countDocuments(query);

    res.paginatedResults = {
      results,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total
    };

    next();
  } catch (error) {
    next(error);
  }
};