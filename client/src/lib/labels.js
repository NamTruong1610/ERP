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

export const USER_STATUS_BADGE = {
  ACTIVE: 'badge-active',
  SUSPENDED: 'badge-suspended',
  PENDING_ACTIVATION: 'badge-pending',
  PENDING_MFA_SETUP: 'badge-pending',
  PENDING_MFA_VERIFICATION: 'badge-pending',
}

export const INVOICE_STATUS_BADGE = {
  DRAFT: 'badge-pending',
  ISSUED: 'badge-completed',
  PARTIALLY_PAID: 'badge-partial',
  PAID: 'badge-paid',
  OVERDUE: 'badge-overdue',
  CANCELLED: 'badge-danger',
  VOIDED: 'badge-danger'
}

export const APPOINTMENT_STATUS_BADGE = {
  SCHEDULED: 'badge-scheduled',
  COMPLETED: 'badge-completed',
  CANCELLED: 'badge-cancelled'
}

export const FILE_ICON = {
  IMAGE: 'ti-photo',
  PDF:   'ti-file-type-pdf',
  DICOM: 'ti-scan',
}