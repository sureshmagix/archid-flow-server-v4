const ROLES = {
  SUPER_ADMIN: "super_admin",
  CUSTOMER_ADMIN: "customer_admin",
  CUSTOMER_CONTROL_USER: "customer_control_user",
  CUSTOMER_VIEW_USER: "customer_view_user"
};

const ROLE_VALUES = Object.values(ROLES);

module.exports = {
  ROLES,
  ROLE_VALUES
};