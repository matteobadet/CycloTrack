import { CheckCircle2, TrendingUp, Utensils, Activity, Map, Heart } from 'lucide-react'

interface Section {
  title: string
  content: string
  icon: React.ReactNode
  bg: string
  border: string
  iconColor: string
  titleColor: string
}

const SECTION_DEFS = [
  {
    keys: ['bilan de forme', 'forme'],
    title: 'Bilan de forme',
    icon: <Heart size={16} />,
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-700',
    iconColor: 'text-blue-500',
    titleColor: 'text-blue-800 dark:text-blue-300',
  },
  {
    keys: ['stratégie par montée', 'montée', 'col'],
    title: 'Stratégie par montée',
    icon: <TrendingUp size={16} />,
    bg: 'bg-orange-50 dark:bg-orange-900/20',
    border: 'border-orange-200 dark:border-orange-700',
    iconColor: 'text-orange-500',
    titleColor: 'text-orange-800 dark:text-orange-300',
  },
  {
    keys: ['objectifs par étape', 'étape de navigation', 'objectif'],
    title: 'Objectifs par étape',
    icon: <Map size={16} />,
    bg: 'bg-indigo-50 dark:bg-indigo-900/20',
    border: 'border-indigo-200 dark:border-indigo-700',
    iconColor: 'text-indigo-500',
    titleColor: 'text-indigo-800 dark:text-indigo-300',
  },
  {
    keys: ['plan global', 'phases', 'plan par'],
    title: 'Plan par phases',
    icon: <Activity size={16} />,
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-700',
    iconColor: 'text-purple-500',
    titleColor: 'text-purple-800 dark:text-purple-300',
  },
  {
    keys: ['préparation', 'veille', 'matin'],
    title: 'Préparation',
    icon: <CheckCircle2 size={16} />,
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-700',
    iconColor: 'text-emerald-500',
    titleColor: 'text-emerald-800 dark:text-emerald-300',
  },
  {
    keys: ['récupération'],
    title: 'Récupération',
    icon: <Utensils size={16} />,
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-700',
    iconColor: 'text-amber-500',
    titleColor: 'text-amber-800 dark:text-amber-300',
  },
]

function parseAdvice(text: string): Section[] {
  // Split on numbered headings like "1. Bilan de forme" or "### 2. Plan"
  const lines = text.split('\n')
  const sections: { heading: string; body: string[] }[] = []
  let current: { heading: string; body: string[] } | null = null

  for (const line of lines) {
    const headingMatch = line.match(/^#{1,3}\s*\d+\.\s+(.+)$/) || line.match(/^\*{0,2}\d+\.\s+\*{0,2}(.+?)\*{0,2}$/)
    if (headingMatch) {
      if (current) sections.push(current)
      current = { heading: headingMatch[1].replace(/\*/g, '').trim(), body: [] }
    } else if (current) {
      current.body.push(line)
    }
  }
  if (current) sections.push(current)

  return sections.map(s => {
    const headingLower = s.heading.toLowerCase()
    const def = SECTION_DEFS.find(d => d.keys.some(k => headingLower.includes(k))) ?? {
      title: s.heading,
      icon: <Activity size={16} />,
      bg: 'bg-gray-50 dark:bg-slate-700/40',
      border: 'border-gray-200 dark:border-slate-600',
      iconColor: 'text-gray-500',
      titleColor: 'text-gray-700 dark:text-slate-200',
    }
    return {
      title: s.heading,
      content: s.body.join('\n').trim(),
      ...def,
    }
  }).filter(s => s.content.length > 0)
}

function renderLine(line: string, i: number) {
  // Bullet point
  if (line.startsWith('- ') || line.startsWith('* ')) {
    const text = line.slice(2)
    return (
      <div key={i} className="flex gap-2 text-sm leading-relaxed">
        <span className="mt-1 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0 opacity-50" />
        <span dangerouslySetInnerHTML={{ __html: renderInline(text) }} />
      </div>
    )
  }
  // Sub-bullet
  if (line.startsWith('  - ') || line.startsWith('  * ')) {
    const text = line.slice(4)
    return (
      <div key={i} className="flex gap-2 text-sm leading-relaxed ml-4">
        <span className="mt-1 w-1 h-1 rounded-full bg-current flex-shrink-0 opacity-40" />
        <span dangerouslySetInnerHTML={{ __html: renderInline(text) }} />
      </div>
    )
  }
  // Table row
  if (line.startsWith('|')) {
    return null // handled by table block below
  }
  // Sub-heading (Phase X, Montée X…)
  if (line.match(/^\*{1,2}(Phase|Montée|Col|Étape)\s/i)) {
    const text = line.replace(/\*/g, '')
    return <p key={i} className="text-sm font-semibold mt-3 mb-1">{text}</p>
  }
  // Empty line
  if (line.trim() === '') return <div key={i} className="h-1" />

  return (
    <p key={i} className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: renderInline(line) }} />
  )
}

function renderInline(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
}

function renderTable(lines: string[]) {
  const rows = lines.filter(l => l.startsWith('|') && !l.match(/^\|[-| ]+\|$/))
  if (rows.length < 2) return null
  const [header, ...body] = rows
  const parseRow = (r: string) => r.split('|').filter((_, i, a) => i > 0 && i < a.length - 1).map(c => c.trim())
  const headers = parseRow(header)
  return (
    <div className="overflow-x-auto mt-2">
      <table className="text-xs w-full border-collapse">
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="text-left px-2 py-1 border-b border-current opacity-60 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, ri) => (
            <tr key={ri} className="border-b border-current opacity-0 dark:opacity-0" style={{ borderOpacity: 0.1 }}>
              {parseRow(r).map((c, ci) => (
                <td key={ci} className="px-2 py-1.5 align-top" dangerouslySetInnerHTML={{ __html: renderInline(c) }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionContent({ content }: { content: string }) {
  const lines = content.split('\n')

  // Group table lines together
  const blocks: { type: 'table' | 'lines'; lines: string[] }[] = []
  let cur: { type: 'table' | 'lines'; lines: string[] } | null = null

  for (const line of lines) {
    const isTable = line.startsWith('|')
    if (isTable) {
      if (!cur || cur.type !== 'table') { if (cur) blocks.push(cur); cur = { type: 'table', lines: [] } }
      cur.lines.push(line)
    } else {
      if (!cur || cur.type !== 'lines') { if (cur) blocks.push(cur); cur = { type: 'lines', lines: [] } }
      cur.lines.push(line)
    }
  }
  if (cur) blocks.push(cur)

  return (
    <div className="space-y-0.5">
      {blocks.map((block, bi) =>
        block.type === 'table'
          ? <div key={bi}>{renderTable(block.lines)}</div>
          : <div key={bi}>{block.lines.map((l, li) => renderLine(l, li))}</div>
      )}
    </div>
  )
}

export default function PlanAiAdvice({ advice }: { advice: string }) {
  const sections = parseAdvice(advice)

  if (sections.length === 0) {
    return (
      <p className="text-sm text-gray-600 dark:text-slate-400 whitespace-pre-wrap">{advice}</p>
    )
  }

  return (
    <div className="space-y-3">
      {sections.map((section, i) => (
        <div key={i} className={`rounded-xl border p-4 ${section.bg} ${section.border}`}>
          <div className={`flex items-center gap-2 font-semibold mb-3 ${section.titleColor}`}>
            <span className={section.iconColor}>{section.icon}</span>
            {section.title}
          </div>
          <div className={`text-gray-700 dark:text-slate-200`}>
            <SectionContent content={section.content} />
          </div>
        </div>
      ))}
    </div>
  )
}
