import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Theme } from '../theme'

interface Props {
  children: string
  t: Theme
}

export default function MarkdownView({ children, t }: Props) {
  const s = styles(t)
  const lines = children.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (!line.trim()) {
      elements.push(<View key={key++} style={{ height: 6 }} />)
      continue
    }

    if (line.startsWith('#### ')) {
      elements.push(<Text key={key++} style={s.h4}>{renderInline(line.slice(5), t)}</Text>)
    } else if (line.startsWith('### ')) {
      elements.push(<Text key={key++} style={s.h3}>{renderInline(line.slice(4), t)}</Text>)
    } else if (line.startsWith('## ')) {
      elements.push(<Text key={key++} style={s.h2}>{renderInline(line.slice(3), t)}</Text>)
    } else if (line.startsWith('# ')) {
      elements.push(<Text key={key++} style={s.h1}>{renderInline(line.slice(2), t)}</Text>)
    } else if (line.startsWith('* ') || line.startsWith('- ')) {
      elements.push(
        <View key={key++} style={s.bulletRow}>
          <Text style={s.bullet}>•</Text>
          <Text style={s.bulletText}>{renderInline(line.slice(2), t)}</Text>
        </View>
      )
    } else if (/^\d+\.\s/.test(line)) {
      const num = line.match(/^(\d+)\.\s/)![1]
      elements.push(
        <View key={key++} style={s.bulletRow}>
          <Text style={s.bullet}>{num}.</Text>
          <Text style={s.bulletText}>{renderInline(line.replace(/^\d+\.\s/, ''), t)}</Text>
        </View>
      )
    } else {
      elements.push(<Text key={key++} style={s.body}>{renderInline(line, t)}</Text>)
    }
  }

  return <View>{elements}</View>
}

function renderInline(text: string, t: Theme): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g
  let last = 0
  let match: RegExpExecArray | null
  let k = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<Text key={k++} style={{ color: t.textSub }}>{text.slice(last, match.index)}</Text>)
    }
    if (match[2]) {
      parts.push(<Text key={k++} style={{ color: t.text, fontWeight: '700' }}>{match[2]}</Text>)
    } else if (match[3]) {
      parts.push(<Text key={k++} style={{ color: t.text, fontStyle: 'italic' }}>{match[3]}</Text>)
    }
    last = match.index + match[0].length
  }

  if (last < text.length) {
    parts.push(<Text key={k++} style={{ color: t.textSub }}>{text.slice(last)}</Text>)
  }

  return parts.length ? parts : [<Text key={0} style={{ color: t.textSub }}>{text}</Text>]
}

const styles = (t: Theme) => StyleSheet.create({
  h1: { fontSize: 20, fontWeight: '800', color: t.text, marginTop: 14, marginBottom: 6 },
  h2: { fontSize: 18, fontWeight: '700', color: t.text, marginTop: 12, marginBottom: 5 },
  h3: { fontSize: 16, fontWeight: '700', color: t.text, marginTop: 10, marginBottom: 4 },
  h4: { fontSize: 15, fontWeight: '600', color: t.blue, marginTop: 8, marginBottom: 3 },
  body: { fontSize: 14, color: t.textSub, lineHeight: 22 },
  bulletRow: { flexDirection: 'row', marginTop: 4, paddingLeft: 4 },
  bullet: { fontSize: 14, color: t.blue, marginRight: 8, lineHeight: 22 },
  bulletText: { flex: 1, fontSize: 14, color: t.textSub, lineHeight: 22 },
})
