const { validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const result = validationResult(req);

    if (result.isEmpty()) {
      return next();
    }

    const errors = result.array().map((error) => ({
      field: error.path,
      message: error.msg
    }));

    return next(new ApiError(400, "Validation failed", errors));
  };
};

module.exports = validate;
