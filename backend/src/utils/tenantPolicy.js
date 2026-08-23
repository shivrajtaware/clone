const withTenantWhere = (where = {}, hospitalId) => ({ ...where, hospital_id: hospitalId });

const scopeTenantData = (data, hospitalId) => ({ ...data, hospital_id: hospitalId });

module.exports = { withTenantWhere, scopeTenantData };
