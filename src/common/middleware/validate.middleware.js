const { validationResult } = require("express-validator");
const ApiError = require("../utils/ApiError");

const validate = (validations = []) => {
  return async (req, res, next) => {
    try {
      // ==========================
      // VALIDATION CONFIG CHECK
      // ==========================
      // This prevents server crash when a route calls:
      // validate(undefined)
      // Usually this means the validation function is not exported/imported correctly.
      if (!Array.isArray(validations)) {
        return next(
          new ApiError(
            500,
            "Invalid validation configuration. Expected an array of validations."
          )
        );
      }

      // ==========================
      // RUN EXPRESS VALIDATORS
      // ==========================
      await Promise.all(
        validations.map((validation) => {
          if (!validation || typeof validation.run !== "function") {
            throw new ApiError(
              500,
              "Invalid validation rule found. Check route validation imports/exports."
            );
          }

          return validation.run(req);
        })
      );

      // ==========================
      // COLLECT VALIDATION ERRORS
      // ==========================
      const result = validationResult(req);

      if (result.isEmpty()) {
        return next();
      }

      const errors = result.array().map((error) => ({
        field: error.path || error.param || "unknown",
        message: error.msg
      }));

      return next(new ApiError(400, "Validation failed", errors));
    } catch (error) {
      return next(error);
    }
  };
};

module.exports = validate;