import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Camera } from 'lucide-react'
import { createAnimal, updateAnimal } from '../lib/animalsApi'

export default function AddAnimal() {
  const navigate = useNavigate()
  const location = useLocation()
  const editAnimal = location.state?.editAnimal
  const prefill = location.state?.prefill

  const [name, setName] = useState(editAnimal?.name || prefill?.common_name || '')
  const [speciesLabel, setSpeciesLabel] = useState(editAnimal?.species_label || prefill?.common_name || '')
  const [breed, setBreed] = useState(editAnimal?.attributes?.breed || '')
  const [age, setAge] = useState(editAnimal?.estimated_age || '')
  const [sex, setSex] = useState(editAnimal?.sex || '')
  const [healthStatus, setHealthStatus] = useState(editAnimal?.attributes?.health_status || 'not_tracked')
  const [notes, setNotes] = useState(editAnimal?.notes || '')
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(editAnimal?.photo_url || null)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !speciesLabel.trim()) {
      setErrorMsg('Name and species are required.')
      return
    }
    setSaving(true)
    setErrorMsg('')

    const fields = {
      name: name.trim(),
      species_label: speciesLabel.trim(),
      breed: breed.trim() || null,
      estimated_age: age.trim() || null,
      sex: sex || null,
      health_status: healthStatus,
      notes: notes.trim() || null,
    }

    if (photoFile) {
      fields.photo_base64 = await fileToBase64(photoFile)
      fields.photo_mime_type = photoFile.type
    }

    const res = editAnimal
      ? await updateAnimal(editAnimal.id, fields)
      : await createAnimal(fields)

    setSaving(false)

    if (res.error) {
      setErrorMsg(res.error)
      return
    }

    navigate(editAnimal ? `/animals/${editAnimal.id}` : '/my-animals')
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] pb-10">
      <div className="flex items-center gap-3 px-6 pt-8 pb-4">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center">
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-display text-2xl">{editAnimal ? 'Edit Animal' : 'Create Animal Profile'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="px-6 space-y-4">
        <label className="block">
          <span className="w-24 h-24 rounded-2xl bg-[var(--surface-secondary)] border border-[var(--border)] flex items-center justify-center overflow-hidden cursor-pointer mx-auto mb-2">
            {photoPreview ? (
              <img src={photoPreview} alt="" className="w-full h-full object-cover" />
            ) : (
              <Camera size={24} className="text-[var(--surface-text-muted)]" />
            )}
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
          <p className="text-center text-xs text-[var(--text-muted)]">Tap to add a photo</p>
        </label>

        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Max" className="input" />
        </Field>

        <Field label="Species">
          <input value={speciesLabel} onChange={(e) => setSpeciesLabel(e.target.value)} placeholder="e.g. Domestic Dog" className="input" />
        </Field>

        <Field label="Breed (optional)">
          <input value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="e.g. Golden Retriever" className="input" />
        </Field>

        <div className="flex gap-3">
          <Field label="Age (optional)" className="flex-1">
            <input value={age} onChange={(e) => setAge(e.target.value)} placeholder="e.g. 2 years" className="input" />
          </Field>
          <Field label="Sex (optional)" className="flex-1">
            <select value={sex} onChange={(e) => setSex(e.target.value)} className="input">
              <option value="">Not set</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </Field>
        </div>

        <Field label="Health status">
          <select value={healthStatus} onChange={(e) => setHealthStatus(e.target.value)} className="input">
            <option value="not_tracked">Not tracked</option>
            <option value="healthy">Healthy</option>
            <option value="needs_attention">Needs attention</option>
          </select>
        </Field>

        <Field label="Notes (optional)">
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="input resize-none" />
        </Field>

        {errorMsg && <p className="text-[var(--error)] text-sm">{errorMsg}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[var(--accent)] text-[var(--bg)] font-medium py-3 rounded-full disabled:opacity-50"
        >
          {saving ? 'Saving...' : editAnimal ? 'Save Changes' : 'Create Profile'}
        </button>
      </form>

      <style>{`
        .input {
          width: 100%;
          background: var(--input-bg);
          border: 1px solid var(--border);
          color: var(--text);
          border-radius: 12px;
          padding: 10px 14px;
        }
      `}</style>
    </div>
  )
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs text-[var(--text-muted)] mb-1">{label}</label>
      {children}
    </div>
  )
}
