import { CheckCircle2, TrendingUp, Lightbulb } from 'lucide-react'

interface Section {
  key: string
  title: string
  icon: React.ReactNode
  bg: string
  border: string
  iconColor: string
  titleColor: string
  bulletColor: string
}

const SECTIONS: Section[] = [
  {
    key: 'positifs',
    title: 'Points positifs',
    icon: <CheckCircle2 size={18} />,
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    titleColor: 'text-emerald-700 dark:text-emerald-300',
    bulletColor: 'bg-emerald-500',
  },
  {
    key: 'améliorer',
    title: 'Points à améliorer',
    icon: <TrendingUp size={18} />,
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/50',
    iconColor: 'text-amber-600 dark:text-amber-400',
    titleColor: 'text-amber-700 dark:text-amber-300',
    bulletColor: 'bg-amber-500',
  },
  {
    key: 'conseils',
    title: 'Conseils pour la prochaine sortie',
    icon: <Lightbulb size={18} />,
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800/50',
    iconColor: 'text-blue-600 dark:text-blue-400',
    titleColor: 'text-blue-700 dark:text-blue-300',
    bulletColor: 'bg-blue-500',
  },
]

function parseAnalysis(text: string): Record<string, string[]> {
  const result: Record<string, string[]> = {}

  // Split on section headers — either **Bold text** or ## Heading or ###
  const sectionPattern = /(?:\*\*([^*]+)\*\*|#{1,3}\s*([^\n]+))\s*\n/g
  const parts: { header: string; start: number }[] = []
  let m: RegExpExecArray | null

  while ((m = sectionPattern.exec(text)) !== null) {
    const header = (m[1] || m[2]).trim()
    parts.push({ header, start: m.index + m[0].length })
  }

  for (let i = 0; i < parts.length; i++) {
    const { header, start } = parts[i]
    const end = i + 1 < parts.length ? parts[i + 1].start - parts[i + 1].header.length - 4 : text.length
    const body = text.slice(start, end).trim()

    // Match to known section
    const section = SECTIONS.find(s =>
      header.toLowerCase().includes(s.key) ||
      s.title.toLowerCase().includes(header.toLowerCase().slice(0, 10))
    )
    if (!section) continue

    // Split body into bullet items
    const items = body
      .split(/\n/)
      .map(l => l.replace(/^[-*•]\s*/, '').replace(/\*\*([^*]+)\*\*/g, '$1').trim())
      .filter(Boolean)

    result[section.key] = items
  }

  return result
}

interface Props {
  analysis: string
}

export default function AiCoachAnalysis({ analysis }: Props) {
  const parsed = parseAnalysis(analysis)
  const hasAnySection = SECTIONS.some(s => parsed[s.key]?.length)

  if (!hasAnySection) {
    // Fallback: render as plain text if parsing fails
    return (
      <p className="text-sm text-gray-600 dark:text-slate-300 whitespace-pre-line leading-relaxed">
        {analysis}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {SECTIONS.map(section => {
        const items = parsed[section.key]
        if (!items?.length) return null
        return (
          <div
            key={section.key}
            className={`rounded-xl border p-4 ${section.bg} ${section.border}`}
          >
            <div className={`flex items-center gap-2 font-semibold mb-3 ${section.iconColor} ${section.titleColor}`}>
              {section.icon}
              <span className="text-sm tracking-wide uppercase">{section.title}</span>
            </div>
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-slate-300">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${section.bulletColor}`} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
