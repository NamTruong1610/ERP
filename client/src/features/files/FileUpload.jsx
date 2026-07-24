import { useRef, useState } from 'react'
import { initiateUpload, confirmUpload } from '../../api/files'

const ACCEPTED_TYPES = {
  'image/jpeg':      { label: 'JPEG', fileType: 'IMAGE' },
  'image/png':       { label: 'PNG',  fileType: 'IMAGE' },
  'image/webp':      { label: 'WebP', fileType: 'IMAGE' },
  'application/pdf': { label: 'PDF',  fileType: 'PDF'   },
  'application/dicom':           { label: 'DICOM', fileType: 'DICOM' },
  'application/octet-stream':    { label: 'DICOM', fileType: 'DICOM' },
}

const MAX_BYTES = 50 * 1024 * 1024  // 50 MB

export default function FileUpload({ patientId, onUploaded }) {
  const inputRef  = useRef(null)
  const [status,  setStatus]  = useState(null)   // null | 'uploading' | 'error'
  const [message, setMessage] = useState('')
  const [progress, setProgress] = useState(0)

  const reset = () => { setStatus(null); setMessage(''); setProgress(0) }

  const handleFile = async (file) => {
    if (!file) return

    // Client-side validation
    if (!ACCEPTED_TYPES[file.type]) {
      setStatus('error')
      setMessage('Unsupported file type. Accepted: JPEG, PNG, WebP, PDF, DICOM.')
      return
    }
    if (file.size > MAX_BYTES) {
      setStatus('error')
      setMessage(`File too large. Maximum size is 50 MB.`)
      return
    }

    setStatus('uploading')
    setMessage('Preparing upload…')
    setProgress(10)

    try {
      // Step 1 — get presigned URL from backend
      const { uploadUrl, fileId } = await initiateUpload(patientId, {
        fileName:  file.name,
        mimeType:  file.type,
        sizeBytes: file.size,
      })

      setMessage('Uploading…')
      setProgress(40)

      // Step 2 — PUT directly to R2 (no auth header, no axios)
      const uploadRes = await fetch(uploadUrl, {
        method:  'PUT',
        body:    file,
        headers: { 'Content-Type': file.type },
      })

      if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.status}`)
      }

      setMessage('Confirming…')
      setProgress(80)

      // Step 3 — confirm with backend
      await confirmUpload(fileId)

      setProgress(100)
      setMessage('Upload complete')
      setStatus(null)

      // Notify parent to refresh file list
      onUploaded()

      // Reset after brief success flash
      setTimeout(reset, 1500)

    } catch (err) {
      setStatus('error')
      setMessage(err.response?.data?.message || err.message || 'Upload failed')
    } finally {
      // Clear input so the same file can be re-uploaded if needed
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp,.pdf,.dcm,application/dicom,application/octet-stream"
        style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files?.[0])}
      />

      <button
        className="btn btn-sm btn-primary"
        onClick={() => { reset(); inputRef.current?.click() }}
        disabled={status === 'uploading'}
      >
        <i className="ti ti-upload" aria-hidden="true" />
        {status === 'uploading' ? 'Uploading…' : 'Upload file'}
      </button>

      {/* Progress / error message */}
      {status === 'uploading' && (
        <div style={{ marginTop: '8px' }}>
          <div style={{
            height: '4px', borderRadius: '2px',
            background: 'var(--border)', overflow: 'hidden'
          }}>
            <div style={{
              height: '100%', width: `${progress}%`,
              background: 'var(--primary)',
              transition: 'width 0.3s ease'
            }} />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {message}
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="feedback-error" style={{ marginTop: '8px', fontSize: '13px' }}>
          {message}
        </div>
      )}

      {!status && progress === 100 && (
        <div style={{ fontSize: '12px', color: 'var(--success-text)', marginTop: '4px' }}>
          {message}
        </div>
      )}
    </div>
  )
}