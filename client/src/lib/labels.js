export const actionLabel = (action) => {
  const map = {
    LOGIN_SUCCESS: 'Logged in',
    LOGOUT: 'Logged out',
    PATIENT_CREATED: 'Created a patient',
    PATIENT_UPDATED: 'Updated a patient',
    PATIENT_DELETED: 'Deleted a patient',
    APPOINTMENT_CREATED: 'Created an appointment',
    APPOINTMENT_UPDATED: 'Updated an appointment',
    APPOINTMENT_CANCELLED: 'Cancelled an appointment',
    APPOINTMENT_DELETED: 'Deleted an appointment',
    TREATMENT_CREATED: 'Recorded a treatment',
    TREATMENT_UPDATED: 'Updated a treatment',
    FILE_UPLOADED: 'Uploaded a file',
    PASSWORD_CHANGED: 'Changed password',
    EMAIL_CHANGED: 'Changed email',
    MFA_ENABLED: 'Enabled 2FA',
    MFA_DISABLED: 'Disabled 2FA',
  }
  return map[action] ?? action.toLowerCase().replace(/_/g, ' ')
}