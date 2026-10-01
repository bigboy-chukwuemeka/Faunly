import { CheckCircle2, Volume2, Leaf, Utensils, Bird, ChevronRight, ImageUp } from 'lucide-react'

const CONFIDENCE_STYLE = {
  high: { label: 'High Confidence', className: 'bg-[var(--accent-tint)] text-[var(--accent-green)]' },
  medium: { label: 'Medium Confidence', className: 'bg-[var(--accent-tint)] text-[var(--accent)]' },
  low: { label: 'Low Confidence', className: 'bg-[var(--error)]/15 text-[var(--error)]' },
}

export default function IdentificationResultCard({ result, expanded, onToggleExpand, onRetryPhoto, onListen }) {
  const confidenceStyle = CONFIDENCE_STYLE[result.confidence] || CONFIDENCE_STYLE.medium
  const hasLowConfidenceAlternatives = result?.confidence !== 'high' && result?.alternatives?.length > 0

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <span className={`inline-flex items-center gap-1 text-sm font-medium px-3 py-1 rounded-full ${confidenceStyle.className}`}>
          <CheckCircle2 size={14} /> {confidenceStyle.label}
        </span>
        {typeof result.confidence_percent === 'number' && (
          <span className="text-sm font-medium bg-[var(--surface-secondary)] text-[var(--surface-text)] border border-[var(--border)] px-3 py-1 rounded-full">
            {result.confidence_percent}%
          </span>
        )}
      </div>

      <div className="flex items-start justify-between mb-3 gap-3">
        <div>
          <h2 className="font-display text-3xl">{result.common_name}</h2>
          {result.scientific_name && (
            <p className="italic text-[var(--surface-text-muted)]">{result.scientific_name}</p>
          )}
        </div>
        {onListen && (
          <button
            onClick={onListen}
            className="flex-shrink-0 flex items-center gap-1 text-sm bg-[var(--accent-tint)] text-[var(--accent)] px-3 py-2 rounded-full whitespace-nowrap"
          >
            <Volume2 size={16} /> Listen
          </button>
        )}
      </div>

      {result.description && (
        <p className="mb-4">{result.description}</p>
      )}

      {hasLowConfidenceAlternatives && (
        <div className="bg-[var(--error)]/10 border border-[var(--error)]/30 rounded-2xl p-4 mb-5">
          <p className="text-xs font-medium text-[var(--error)] mb-2">Not sure? It could also be:</p>
          <ul className="text-sm space-y-1">
            {result.alternatives.map((alt, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>{alt.common_name}</span>
                <span className="text-[var(--surface-text-muted)] text-xs text-right">{alt.confidence_note}</span>
              </li>
            ))}
          </ul>
          {onRetryPhoto && (
            <label className="mt-3 inline-flex items-center gap-1 text-xs text-[var(--accent)] cursor-pointer">
              <ImageUp size={12} /> Try a clearer photo
              <input type="file" accept="image/*" className="hidden" onChange={onRetryPhoto} />
            </label>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 mb-5">
        <FactCard icon={<Leaf size={18} />} label="Habitat" value={result.facts?.habitat} />
        <FactCard icon={<Utensils size={18} />} label="Diet" value={result.facts?.diet} />
        <FactCard icon={<Bird size={18} />} label="Behavior" value={result.facts?.behavior} />
      </div>

      {(result.key_facts?.length || result.key_facts?.lifespan || result.facts?.conservation_status) && (
        <div className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-2xl p-4 mb-5">
          <h3 className="font-medium mb-2">Key Facts</h3>
          <ul className="text-sm space-y-1 list-disc list-inside">
            {result.key_facts?.length && <li><strong>Length:</strong> {result.key_facts.length}</li>}
            {result.key_facts?.lifespan && <li><strong>Lifespan:</strong> {result.key_facts.lifespan}</li>}
            {result.facts?.conservation_status && <li><strong>Conservation Status:</strong> {result.facts.conservation_status}</li>}
          </ul>
        </div>
      )}

      <div className="mb-5">
        <h3 className="font-medium mb-2">More Information</h3>
        <div className="bg-[var(--surface-secondary)] border border-[var(--border)] divide-y divide-[var(--border)] rounded-2xl">
          <AccordionRow
            title="Detailed Description"
            subtitle="Appearance, features and unique traits"
            content={result.detailed_description}
            isOpen={expanded === 'description'}
            onToggle={() => onToggleExpand('description')}
          />
          <AccordionRow
            title="Conservation Status"
            subtitle="Population and threats"
            content={result.conservation_detail}
            isOpen={expanded === 'conservation'}
            onToggle={() => onToggleExpand('conservation')}
          />
          <AccordionRow
            title="Care Information"
            subtitle="How to support and protect"
            content={result.care_information}
            isOpen={expanded === 'care'}
            onToggle={() => onToggleExpand('care')}
          />
        </div>
      </div>
    </>
  )
}

function FactCard({ icon, label, value }) {
  if (!value) return null
  return (
    <div className="bg-[var(--surface-secondary)] border border-[var(--border)] rounded-2xl p-3">
      <div className="w-8 h-8 rounded-full bg-[var(--accent-tint)] text-[var(--accent)] flex items-center justify-center mb-2">
        {icon}
      </div>
      <p className="text-xs font-medium">{label}</p>
      <p className="text-xs text-[var(--surface-text-muted)] mt-1">{value}</p>
    </div>
  )
}

function AccordionRow({ title, subtitle, content, isOpen, onToggle }) {
  if (!content) return null
  return (
    <div>
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left">
        <span>
          <span className="block font-medium">{title}</span>
          <span className="block text-xs text-[var(--surface-text-muted)]">{subtitle}</span>
        </span>
        <ChevronRight size={16} className={`transition-transform flex-shrink-0 ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && <p className="px-4 pb-4 text-sm text-[var(--surface-text-muted)]">{content}</p>}
    </div>
  )
}
