import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const STORAGE_PREFIX = 'parking-assist-records:'
const COMMON_NOTES = ['サービス券1枚使用', '料金未発生', '操作ミス', '発行できず', '精算時間不明']
const STATUS = {
  parking: { label: '駐車中', tone: 'parking' },
  issued: { label: '証明書発行済み', tone: 'issued' },
  settled: { label: '精算済み', tone: 'settled' },
}

function getDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateLabel(date = new Date()) {
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  return `${date.getMonth() + 1}/${date.getDate()}（${weekdays[date.getDay()]}）`
}

function formatTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatDateTimeInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function parseDateTimeInput(value) {
  return value ? new Date(value).toISOString() : null
}

function getElapsedSeconds(record, now = Date.now()) {
  const started = new Date(record.startedAt).getTime()
  const ended = record.issuedAt ? new Date(record.issuedAt).getTime() : now
  if (!Number.isFinite(started) || !Number.isFinite(ended)) return 0
  return Math.max(0, Math.floor((ended - started) / 1000))
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0)
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`
}

function getNotes(record) {
  return [...(record.notePresets || []), record.memo?.trim()].filter(Boolean).join('、')
}

function getResultLabel(record, now) {
  if (getElapsedSeconds(record, now) > 90) return '90秒超'
  return '正常'
}

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function loadRecords(dateKey) {
  try {
    const value = localStorage.getItem(`${STORAGE_PREFIX}${dateKey}`)
    const parsed = value ? JSON.parse(value) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function Icon({ name, size = 20 }) {
  const paths = {
    clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7v5l3.5 2" /></>,
    check: <><path d="m5 12.5 4.2 4.2L19 7" /></>,
    edit: <><path d="M4 20h4l10.8-10.8a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m14.5 7.5 3 3" /></>,
    trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" /></>,
    copy: <><rect x="8" y="8" width="10" height="11" rx="1.5" /><path d="M6 15H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h7A1.5 1.5 0 0 1 13.5 5v1" /></>,
    note: <><path d="M5 3.5h10l3 3V20H5z" /><path d="M15 3.5V7h3M8 11h7M8 14.5h7M8 18h4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.8-4L3 10" /><path d="M3 5v5h5M4 13a8 8 0 0 0 14.8 4L21 14" /><path d="M21 19v-5h-5" /></>,
    arrow: <path d="m9 18 6-6-6-6" />,
  }
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function StatusBadge({ status, children }) {
  const meta = STATUS[status] || STATUS.parking
  return <span className={`status-badge ${meta.tone}`}>{children || meta.label}</span>
}

function EmptyState({ title, detail }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name="clock" size={24} /></div><strong>{title}</strong><span>{detail}</span></div>
}

function RecordRow({ record, now, action, actionLabel, actionTone = 'primary', onNote, onEdit, onDelete }) {
  const elapsed = getElapsedSeconds(record, now)
  const overLimit = elapsed > 90
  const notes = getNotes(record)
  return <article className={`record-row ${overLimit ? 'is-over-limit' : ''}`}>
    <div className="row-main">
      <div className="spot-number"><span>{record.spot}</span><small>番</small></div>
      <div className="row-data">
        <div className="row-topline"><StatusBadge status={record.status} /><span className={`result-label ${overLimit ? 'warning' : 'normal'}`}>{getResultLabel(record, now)}</span></div>
        <div className="metric-line"><span><small>経過</small><strong>{elapsed}秒</strong></span><span><small>証明書発行</small><strong>{formatTime(record.issuedAt)}</strong></span>{record.status !== 'parking' && <span><small>精算</small><strong>{formatTime(record.settledAt)}</strong></span>}</div>
        {notes && <div className="row-note"><Icon name="note" size={15} />{notes}</div>}
      </div>
      {action && <button type="button" className={`action-button ${actionTone}`} onClick={() => action(record)}>{actionLabel}</button>}
    </div>
    {(onNote || onEdit || onDelete) && <div className="row-actions">
      {onNote && <button type="button" className="subtle-button" onClick={() => onNote(record)}><Icon name="note" size={16} />メモ</button>}
      {onEdit && <button type="button" className="subtle-button" onClick={() => onEdit(record)}><Icon name="edit" size={16} />編集</button>}
      {onDelete && <button type="button" className="subtle-button danger" onClick={() => onDelete(record)}><Icon name="trash" size={16} />削除</button>}
    </div>}
  </article>
}

function ParkingGrid({ records, onStart }) {
  const occupied = new Map(records.filter((record) => record.status !== 'settled').map((record) => [record.spot, record]))
  return <div className="parking-grid" aria-label="駐車位置番号">
    {Array.from({ length: 21 }, (_, index) => index + 1).map((spot) => {
      const record = occupied.get(spot)
      const disabled = Boolean(record)
      return <button key={spot} type="button" className={`spot-button ${record?.status === 'parking' ? 'active' : ''} ${record?.status === 'issued' ? 'waiting' : ''}`} disabled={disabled} onClick={() => onStart(spot)} aria-label={`${spot}番${record ? `・${STATUS[record.status].label}` : '・新しく記録開始'}`}>
        <strong>{spot}</strong>
        {record && <small>{record.status === 'parking' ? '対応中' : '待ち'}</small>}
      </button>
    })}
  </div>
}

function NoteSheet({ record, onSave, onClose }) {
  const [presets, setPresets] = useState(record?.notePresets || [])
  const [memo, setMemo] = useState(record?.memo || '')
  if (!record) return null
  const togglePreset = (note) => setPresets((current) => current.includes(note) ? current.filter((item) => item !== note) : [...current, note])
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="note-sheet-title">
      <div className="sheet-handle" />
      <div className="sheet-heading"><div><span className="eyebrow">{record.spot}番の記録</span><h2 id="note-sheet-title">例外メモを選択</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="閉じる"><Icon name="close" /></button></div>
      <div className="note-options">{COMMON_NOTES.map((note) => <button key={note} type="button" className={`note-option ${presets.includes(note) ? 'selected' : ''}`} onClick={() => togglePreset(note)}>{presets.includes(note) && <Icon name="check" size={18} />}{note}</button>)}</div>
      <label className="field-label" htmlFor="free-memo">自由メモ（任意）</label>
      <textarea id="free-memo" className="text-input memo-input" value={memo} onChange={(event) => setMemo(event.target.value)} placeholder="メモを入力してください" rows="3" />
      <div className="sheet-footer"><button type="button" className="secondary-button" onClick={onClose}>キャンセル</button><button type="button" className="primary-button" onClick={() => onSave(record.id, { notePresets: presets, memo })}>メモを保存</button></div>
    </section>
  </div>
}

function EditModal({ record, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    spot: record.spot,
    startedAt: formatDateTimeInput(record.startedAt),
    issuedAt: formatDateTimeInput(record.issuedAt),
    settledAt: formatDateTimeInput(record.settledAt),
    notePresets: record.notePresets || [],
    memo: record.memo || '',
  })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const togglePreset = (note) => update('notePresets', form.notePresets.includes(note) ? form.notePresets.filter((item) => item !== note) : [...form.notePresets, note])
  const submit = (event) => {
    event.preventDefault()
    const startedAt = parseDateTimeInput(form.startedAt) || record.startedAt
    const issuedAt = parseDateTimeInput(form.issuedAt)
    const settledAt = parseDateTimeInput(form.settledAt)
    onSave(record.id, { spot: Math.min(21, Math.max(1, Number(form.spot) || record.spot)), startedAt, issuedAt, settledAt, status: settledAt ? 'settled' : issuedAt ? 'issued' : 'parking', notePresets: form.notePresets, memo: form.memo })
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="edit-modal" role="dialog" aria-modal="true" aria-labelledby="edit-modal-title">
      <div className="modal-heading"><div><span className="eyebrow">記録を修正</span><h2 id="edit-modal-title">{record.spot}番の詳細</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="閉じる"><Icon name="close" /></button></div>
      <form onSubmit={submit}>
        <div className="form-grid"><label className="field-label">駐車位置番号<input className="text-input" type="number" min="1" max="21" value={form.spot} onChange={(event) => update('spot', event.target.value)} /></label><label className="field-label">駐車開始<input className="text-input" type="datetime-local" value={form.startedAt} onChange={(event) => update('startedAt', event.target.value)} /></label><label className="field-label">証明書発行<input className="text-input" type="datetime-local" value={form.issuedAt} onChange={(event) => update('issuedAt', event.target.value)} /></label><label className="field-label">精算時刻<input className="text-input" type="datetime-local" value={form.settledAt} onChange={(event) => update('settledAt', event.target.value)} /></label></div>
        <div className="field-label">例外メモ</div><div className="note-options compact">{COMMON_NOTES.map((note) => <button key={note} type="button" className={`note-option ${form.notePresets.includes(note) ? 'selected' : ''}`} onClick={() => togglePreset(note)}>{form.notePresets.includes(note) && <Icon name="check" size={16} />}{note}</button>)}</div>
        <label className="field-label" htmlFor="edit-memo">自由メモ</label><textarea id="edit-memo" className="text-input memo-input" value={form.memo} onChange={(event) => update('memo', event.target.value)} rows="3" placeholder="メモを入力してください" />
        <div className="modal-footer"><button type="button" className="subtle-button danger delete-record" onClick={() => onDelete(record)}>この記録を削除</button><div className="footer-right"><button type="button" className="secondary-button" onClick={onClose}>キャンセル</button><button type="submit" className="primary-button">変更を保存</button></div></div>
      </form>
    </section>
  </div>
}

function App() {
  const todayKey = getDateKey()
  const [records, setRecords] = useState(() => loadRecords(todayKey))
  const [activeView, setActiveView] = useState('record')
  const [now, setNow] = useState(Date.now())
  const [noteRecord, setNoteRecord] = useState(null)
  const [editRecord, setEditRecord] = useState(null)
  const [lineText, setLineText] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    localStorage.setItem(`${STORAGE_PREFIX}${todayKey}`, JSON.stringify(records))
  }, [records, todayKey])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2600)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  const parkingRecords = useMemo(() => records.filter((record) => record.status === 'parking').sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt)), [records])
  const issuedRecords = useMemo(() => records.filter((record) => record.status === 'issued').sort((a, b) => new Date(a.issuedAt) - new Date(b.issuedAt)), [records])
  const settledRecords = useMemo(() => records.filter((record) => record.status === 'settled').sort((a, b) => new Date(b.settledAt || b.startedAt) - new Date(a.settledAt || a.startedAt)), [records])

  const notify = (message) => setToast(message)
  const updateRecord = (id, patch) => setRecords((current) => current.map((record) => record.id === id ? { ...record, ...patch } : record))

  const startRecord = (spot) => {
    const occupied = records.some((record) => record.spot === spot && record.status !== 'settled')
    if (occupied) return notify(`${spot}番は現在対応中です`)
    const record = { id: makeId(), spot, startedAt: new Date().toISOString(), issuedAt: null, settledAt: null, status: 'parking', notePresets: [], memo: '' }
    setRecords((current) => [...current, record])
    notify(`${spot}番のタイマーを開始しました`)
  }

  const issueCertificate = (record) => {
    const issuedAt = new Date().toISOString()
    updateRecord(record.id, { issuedAt, status: 'issued' })
    notify(`${record.spot}番・${getElapsedSeconds({ ...record, issuedAt }, Date.now())}秒で発行を記録しました`)
  }

  const settleRecord = (record) => {
    updateRecord(record.id, { settledAt: new Date().toISOString(), status: 'settled' })
    notify(`${record.spot}番の精算を記録しました`)
  }

  const saveNotes = (id, patch) => {
    updateRecord(id, patch)
    setNoteRecord(null)
    notify('メモを保存しました')
  }

  const saveEdit = (id, patch) => {
    updateRecord(id, patch)
    setEditRecord(null)
    notify('記録を更新しました')
  }

  const deleteRecord = (record) => {
    if (!window.confirm(`${record.spot}番の記録を削除しますか？\nこの操作は元に戻せません。`)) return
    setRecords((current) => current.filter((item) => item.id !== record.id))
    setEditRecord(null)
    notify('記録を削除しました')
  }

  const generateLineText = () => {
    const text = [...records].sort((a, b) => new Date(a.startedAt) - new Date(b.startedAt)).map((record) => {
      const elapsedText = record.issuedAt ? `証明書発行${getElapsedSeconds(record, now)}秒${formatTime(record.issuedAt)}` : `証明書発行できず${formatTime(record.startedAt)}`
      const settleText = record.settledAt ? `証明書発行${formatTime(record.settledAt)}…精算` : '精算時間不明'
      const noteText = getNotes(record) ? `＊${getNotes(record)}` : ''
      return `・駐車位置番号:${record.spot}番駐車→${elapsedText}…${settleText}${noteText}`
    }).join('\n')
    setLineText(text || '本日の記録はありません。')
    notify('LINE用テキストを生成しました')
  }

  const copyLineText = async () => {
    try {
      await navigator.clipboard.writeText(lineText)
      notify('クリップボードにコピーしました')
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = lineText
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
      notify('クリップボードにコピーしました')
    }
  }

  const tabItems = [
    { id: 'record', label: '記録' },
    { id: 'issued', label: '発行済み・精算待ち', count: issuedRecords.length },
    { id: 'history', label: '履歴', count: settledRecords.length },
  ]

  return <div className="app-shell">
    <header className="app-header"><div className="brand-mark"><span className="brand-dot" /><span>精算機補助</span></div><div className="header-date">{formatDateLabel()}</div><button type="button" className="help-button" aria-label="このアプリについて" onClick={() => notify('駐車番号→証明書発行→精算の順でタップしてください')} >?</button></header>
    <nav className="tab-nav" aria-label="メインメニュー">{tabItems.map((tab) => <button key={tab.id} type="button" className={activeView === tab.id ? 'active' : ''} onClick={() => setActiveView(tab.id)}>{tab.label}{tab.count > 0 && <span className="tab-count">{tab.count}</span>}</button>)}</nav>
    <main className="main-content">
      <div className="day-banner"><span><Icon name="clock" size={18} />本日 {formatDateLabel()}</span><button type="button" onClick={() => { setRecords(loadRecords(todayKey)); notify('保存データを読み込みました') }}><Icon name="refresh" size={17} />更新</button></div>

      {activeView === 'record' && <section className="view-section" aria-labelledby="record-heading">
        <div className="section-heading"><div><h1 id="record-heading">駐車番号を選択</h1><p>駐車した番号をタップするとタイマーが始まります。</p></div><span className="section-count">対応中 {parkingRecords.length}件</span></div>
        {parkingRecords.length > 0 && <div className="active-panel"><div className="active-panel-heading"><span className="live-dot" />タイマー動作中</div>{parkingRecords.map((record) => <div className="active-record" key={record.id}><div className="active-summary"><strong>{record.spot}<small>番</small></strong><div><StatusBadge status="parking" /><div className="active-time">{getElapsedSeconds(record, now)}<small>秒</small><span>{formatDuration(getElapsedSeconds(record, now))}</span></div></div></div><div className="active-actions"><button type="button" className="primary-button issue-button" onClick={() => issueCertificate(record)}><Icon name="check" size={20} />証明書発行</button><button type="button" className="secondary-button note-button" onClick={() => setNoteRecord(record)}><Icon name="note" size={18} />メモ</button></div></div>)}</div>}
        <div className="parking-area"><div className="area-heading"><h2>駐車位置番号</h2><span>1〜21</span></div><ParkingGrid records={records} onStart={startRecord} /></div>
        {parkingRecords.length === 0 && <EmptyState title="タイマー動作中の車両はありません" detail="車が駐車したら、上の番号をタップしてください。" />}
        <div className="quick-tip"><span className="tip-icon">!</span><span><strong>90秒以内の発行が正常</strong><br />90秒を超えると記録に「90秒超」と表示されます。</span></div>
      </section>}

      {activeView === 'issued' && <section className="view-section" aria-labelledby="issued-heading"><div className="section-heading"><div><h1 id="issued-heading">発行済み・精算待ち</h1><p>証明書を発行した車両の精算を記録します。</p></div><span className="section-count">{issuedRecords.length}件</span></div>{issuedRecords.length === 0 ? <EmptyState title="精算待ちの車両はありません" detail="証明書発行後の車両がここに表示されます。" /> : <div className="record-list">{issuedRecords.map((record) => <RecordRow key={record.id} record={record} now={now} action={settleRecord} actionLabel="精算" onNote={setNoteRecord} />)}</div>}</section>}

      {activeView === 'history' && <section className="view-section" aria-labelledby="history-heading"><div className="section-heading"><div><h1 id="history-heading">本日の履歴</h1><p>精算済みの記録を確認・修正できます。</p></div><span className="section-count">{settledRecords.length}件</span></div><div className="line-tools"><div><strong>LINE報告</strong><span>今日の記録を現在の形式でまとめます。</span></div><button type="button" className="line-button" onClick={generateLineText}><span className="line-mark">LINE</span>LINE用テキストを生成</button></div>{lineText && <div className="line-output"><div className="line-output-heading"><strong>生成されたテキスト</strong><button type="button" className="copy-button" onClick={copyLineText}><Icon name="copy" size={17} />コピー</button></div><textarea readOnly value={lineText} aria-label="LINE用テキスト" /></div>}{settledRecords.length === 0 ? <EmptyState title="完了した記録はありません" detail="精算ボタンを押した記録がここに表示されます。" /> : <div className="record-list history-list">{settledRecords.map((record) => <RecordRow key={record.id} record={record} now={now} onNote={setNoteRecord} onEdit={setEditRecord} onDelete={deleteRecord} />)}</div>}</section>}
    </main>
    <footer className="app-footer">端末内に自動保存中 · {todayKey}</footer>
    {noteRecord && <NoteSheet record={records.find((record) => record.id === noteRecord.id) || noteRecord} onSave={saveNotes} onClose={() => setNoteRecord(null)} />}
    {editRecord && <EditModal record={records.find((record) => record.id === editRecord.id) || editRecord} onSave={saveEdit} onDelete={deleteRecord} onClose={() => setEditRecord(null)} />}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
