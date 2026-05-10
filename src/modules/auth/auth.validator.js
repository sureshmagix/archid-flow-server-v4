const { body } = require("express-validator");

const signupValidator = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Name is required")
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters"),

  body("mobile")
    .trim()
    .notEmpty()
    .withMessage("Mobile number is required")
    .isLength({ min: 8, max: 15 })
    .withMessage("Mobile number must be between 8 and 15 characters"),

  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .isEmail()
    .withMessage("Valid email is required")
    .normalizeEmail(),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters"),

  body("confirmPassword")
    .notEmpty()
    .withMessage("Confirm password is required")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }

      return true;
    })
];

const loginValidator = [
  body("identifier")
    .trim()
    .notEmpty()
    .withMessage("Identifier is required. Use email or mobile number"),

  body("password")
    .notEmpty()
    .withMessage("Password is required")
];

module.exports = {
  signupValidator,
  loginValidator
};
