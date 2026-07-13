// src/utils/dateHelper.js

/**
 * Convert date string (YYYY-MM-DD) to ISO DateTime format
 * @param {string} dateString - Date string in format YYYY-MM-DD
 * @returns {Date|null} - Date object or null if invalid
 */
const parseDate = (dateString) => {
  if (!dateString) return null;
  // If already a Date object, return it
  if (dateString instanceof Date) return dateString;
  // Convert string to Date: handle both "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SS" formats
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;
  return date;
};

/**
 * Convert datetime string to ISO DateTime format
 * @param {string} dateTimeString - DateTime string in various formats
 * @returns {Date|null} - Date object or null if invalid
 */
const parseDateTime = (dateTimeString) => {
  if (!dateTimeString) return null;
  if (dateTimeString instanceof Date) return dateTimeString;
  
  const date = new Date(dateTimeString);
  if (isNaN(date.getTime())) return null;
  return date;
};

/**
 * Process patient data and convert date strings to proper DateTime format
 * @param {Object} data - Patient data object
 * @returns {Object} - Processed data with converted dates
 */
const processPatientData = (data) => {
  if (!data) return {};
  
  return {
    ...data,
    dob: data.dob ? parseDate(data.dob) : undefined,
  };
};

/**
 * Process admission/discharge data
 * @param {Object} data - Admission data object
 * @returns {Object} - Processed data with converted dates
 */
const processAdmissionData = (data) => {
  if (!data) return {};
  
  return {
    ...data,
    admission_date: data.admission_date ? parseDateTime(data.admission_date) : undefined,
    discharge_date: data.discharge_date ? parseDateTime(data.discharge_date) : undefined,
    follow_up_date: data.follow_up_date ? parseDate(data.follow_up_date) : undefined,
  };
};

/**
 * Process appointment data
 * @param {Object} data - Appointment data object
 * @returns {Object} - Processed data with converted dates
 */
const processAppointmentData = (data) => {
  if (!data) return {};
  
  return {
    ...data,
    appointment_date: data.appointment_date ? parseDateTime(data.appointment_date) : undefined,
  };
};

/**
 * Process prescription data
 * @param {Object} data - Prescription data object
 * @returns {Object} - Processed data with converted dates
 */
const processPrescriptionData = (data) => {
  if (!data) return {};
  
  return {
    ...data,
    valid_till: data.valid_till ? parseDate(data.valid_till) : undefined,
  };
};

/**
 * Process lab order data
 * @param {Object} data - Lab order data object
 * @returns {Object} - Processed data with converted dates
 */
const processLabOrderData = (data) => {
  if (!data) return {};
  
  return {
    ...data,
    target_collection_date: data.target_collection_date ? parseDate(data.target_collection_date) : undefined,
  };
};

/**
 * Safe filter out undefined values from an object
 * @param {Object} data - Object to filter
 * @returns {Object} - Filtered object without undefined values
 */
const filterUndefined = (data) => {
  if (!data) return {};
  const filtered = {};
  Object.keys(data).forEach(key => {
    if (data[key] !== undefined) {
      filtered[key] = data[key];
    }
  });
  return filtered;
};

module.exports = {
  parseDate,
  parseDateTime,
  processPatientData,
  processAdmissionData,
  processAppointmentData,
  processPrescriptionData,
  processLabOrderData,
  filterUndefined,
};
