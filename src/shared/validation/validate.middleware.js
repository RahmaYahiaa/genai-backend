export function validateSchemas(schemas) {
  return (req, _res, next) => {
    try {
      const validated = {};
      if (schemas.body) validated.body = schemas.body.parse(req.body ?? {});
      if (schemas.query) validated.query = schemas.query.parse(req.query ?? {});
      if (schemas.params) validated.params = schemas.params.parse(req.params ?? {});
      req.validated = { ...(req.validated ?? {}), ...validated };
      next();
    } catch (error) {
      next(error);
    }
  };
}