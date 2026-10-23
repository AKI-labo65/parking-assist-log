/** @vitest-environment jsdom */

import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event/dist/esm/index.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  App,
  buildWorkLineText,
  createDefaultWorkReport,
  formatDateTimeInput,
  getDateKey,
  getRestartRule,
  loadWorkReport,
  parseDateTimeInput,
  resolveEditedDateTimeInput,
  shouldRestartForStore,
} from './main.jsx'

const storeConfigs = [
  { id: 'storeA', label: '第一店舗', arrivalText: '現着致しました。', hasCommute: true },
  { id: 'storeB', label: '第二店舗', arrivalText: 'ただいま、第二店舗に到着しました。', hasCommute: false },
]

function makeSettledRecord(overrides = {}) {
  const now = Date.now()
  const settledAt = new Date(now).toISOString()
  return {
    id: 'record-1',
    spot: '1',
    startedSpot: '1',
    unknownLabel: null,
    spotConfirmedAt: new Date(now - 20_000).toISOString(),
    spotSource: 'issue',
    startedAt: new Date(now - 40_000).toISOString(),
    issuedAt: new Date(now - 20_000).toISOString(),
    settledAt,
    exitCompletedAt: settledAt,
    lineReportedAt: null,
    reportType: 'normal',
    reportFlags: {},
    reportMemo: '',
    status: 'settled',
    notePresets: [],
    memo: '',
    ...overrides,
  }
}

function seedApp(record = makeSettledRecord(), { ended = true } = {}) {
  const dateKey = getDateKey()
  const workReport = createDefaultWorkReport()
  workReport.activeStoreId = 'storeB'
  if (ended) workReport.stores.storeB.schedule.endedAt = new Date().toISOString()
  localStorage.setItem(`parking-assist-records:${dateKey}`, JSON.stringify([record]))
  localStorage.setItem(`parking-assist-work:${dateKey}`, JSON.stringify(workReport))
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('record time editing', () => {
  it('keeps seconds when converting datetime-local values', () => {
    const original = new Date(2026, 7, 21, 10, 11, 12).toISOString()
    const inputValue = formatDateTimeInput(original)

    expect(inputValue).toMatch(/T10:11:12$/)
    expect(parseDateTimeInput(inputValue)).toBe(original)
  })

  it('keeps the exact original timestamp when the time field was not edited', () => {
    const original = '2026-08-21T01:11:12.789Z'
    const unchangedInput = formatDateTimeInput(original)

    expect(resolveEditedDateTimeInput(unchangedInput, original)).toBe(original)
  })
})

describe('work report text', () => {
  it('uses configured store labels and prints the closing only once', () => {
    const report = createDefaultWorkReport()
    report.activeStoreId = 'storeA'
    report.stores.storeA.arrivalAt = new Date().toISOString()
    report.stores.storeA.inspectionSeconds = '18'
    report.stores.storeA.schedule.endedAt = new Date().toISOString()

    const text = buildWorkLineText(report, storeConfigs)

    expect(text).toContain('【第一店舗】')
    expect(text).not.toContain('【第二店舗】')
    expect(text).not.toContain('【undefined】')
    expect(text.match(/お疲れ様でした。/g)).toHaveLength(1)
  })

  it('reports all three shifts and uses adjusted times for breaks and the final closing', () => {
    const report = createDefaultWorkReport()
    report.activeStoreId = 'storeA'
    const schedule = report.stores.storeA.schedule
    const at = (hours, minutes = 0) => new Date(2026, 9, 23, hours, minutes).toISOString()
    Object.assign(schedule, { startedAt: at(10), breakAt: at(12), resumedAt: at(15), eveningBreakAt: at(18, 15), eveningResumedAt: at(19, 15), endedAt: at(21), parkingTickets: '30' })
    report.stores.storeB.arrivalAt = at(8, 30)
    report.stores.storeB.schedule.finishMemo = '別店舗のメモ'

    const text = buildWorkLineText(report, storeConfigs)

    expect(text).toContain('10:00配置つきました。\n業務開始いたします。')
    expect(text).toContain('12:00になりましたので\n配置一時解除します。')
    expect(text).toContain('15:00配置つきました。\n業務再開いたします。')
    expect(text).toContain('18:15になりましたので\n配置一時解除します。')
    expect(text).toContain('19:15配置つきました。\n業務再開いたします。')
    expect(text).toContain('21:00…配置解除,店舗挨拶完了')
    expect(text).toContain('店舗駐車券預り30枚')
    expect(text).not.toContain('18:00…配置解除')
    expect(text).not.toContain('第二店舗')
    expect(text).not.toContain('別店舗のメモ')
    expect(text.match(/お疲れ様でした。/g)).toHaveLength(1)
  })

  it.each([
    ['storeA', 'vehicle', '車両ありで確認', true],
    ['storeB', 'vehicle', '車両ありで確認', true],
    ['storeA', 'noVehicle', '車両なし・鉄板なし（スタート画面のみ）', false],
    ['storeB', 'noVehicle', '車両なし・鉄板で確認', true],
  ])('reports the inspection method for %s with %s', (storeId, mode, method, hasSettlement) => {
    const report = createDefaultWorkReport()
    report.activeStoreId = storeId
    Object.assign(report.stores[storeId], { arrivalAt: new Date().toISOString(), inspectionMode: mode, inspectionSeconds: '7', settlementSeconds: '9' })

    const text = buildWorkLineText(report, storeConfigs)

    expect(text).toContain(method)
    expect(text).toContain('スタート画面...7秒')
    expect(text.includes('精算後の画面...9秒')).toBe(hasSettlement)
  })
})

describe('restart schedule', () => {
  it.each([19, 20, 21, 22, 23, 24, 25])('requires a morning restart every day, including low inspection times (October %s)', (day) => {
    const rule = getRestartRule(new Date(2026, 9, day))
    expect(rule).toMatchObject({ id: 'daily', required: true })
    expect(shouldRestartForStore(rule, { inspectionSeconds: '7' })).toBe(true)
    expect(shouldRestartForStore(rule, { inspectionSeconds: '' })).toBe(true)
  })
})

describe('work report migration', () => {
  it('does not copy a partial store report into the other store', () => {
    const startedAt = new Date(2026, 9, 23, 10).toISOString()
    localStorage.setItem(`parking-assist-work:${getDateKey()}`, JSON.stringify({ version: 2, activeStoreId: 'storeB', stores: { storeB: { inspectionSeconds: '5', schedule: { startedAt } } } }))

    const report = loadWorkReport(getDateKey())

    expect(report.stores.storeB.schedule.startedAt).toBe(startedAt)
    expect(report.stores.storeA.schedule.startedAt).toBeNull()
    expect(report.stores.storeA.inspectionSeconds).toBe('')
  })

  it('preserves old timestamps and ticket counts on the original store without turning 18:00 into a break', () => {
    const endedAt = new Date(2026, 9, 22, 18).toISOString()
    localStorage.setItem(`parking-assist-work:${getDateKey()}`, JSON.stringify({ activeStoreId: 'storeA', stores: { storeA: { inspectionSeconds: '7' } }, schedule: { endedAt, parkingTickets: '35', finishMemo: '旧版の補足' } }))

    const report = loadWorkReport(getDateKey())

    expect(report.version).toBe(2)
    expect(report.stores.storeA.inspectionSeconds).toBe('7')
    expect(report.stores.storeB.schedule).toMatchObject({ endedAt, parkingTickets: '35', eveningBreakAt: null, eveningResumedAt: null, finishMemo: '旧版の補足' })
    expect(report.stores.storeA.schedule.endedAt).toBeNull()
    report.activeStoreId = 'storeB'
    expect(buildWorkLineText(report, storeConfigs)).toContain('18:00…配置解除,店舗挨拶完了')

    localStorage.setItem(`parking-assist-work:${getDateKey()}`, JSON.stringify(report))
    expect(loadWorkReport(getDateKey())).toEqual(report)
  })

  it('also respects the older swapped store labels', () => {
    const startedAt = new Date(2026, 9, 22, 10).toISOString()
    localStorage.setItem('parking-assist-settings', JSON.stringify({ storeLabels: { storeA: '名東本通店', storeB: '杉栄店' } }))
    localStorage.setItem(`parking-assist-work:${getDateKey()}`, JSON.stringify({ activeStoreId: 'storeB', stores: { storeB: { inspectionSeconds: '6' } }, schedule: { startedAt } }))

    const report = loadWorkReport(getDateKey())

    expect(report.activeStoreId).toBe('storeA')
    expect(report.stores.storeA.inspectionSeconds).toBe('6')
    expect(report.stores.storeA.schedule.startedAt).toBe(startedAt)
    expect(report.stores.storeB.schedule.startedAt).toBeNull()
  })
})

describe('generated LINE report consistency', () => {
  it('labels memo records and puts each memo on its own line after settlement', async () => {
    seedApp(makeSettledRecord({ notePresets: ['料金発生なし', 'サービス券2枚回収'] }))
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: /履歴/ })[0])
    await user.click(screen.getByRole('button', { name: /まとめて報告文を生成/ }))
    const text = screen.getByLabelText('LINE用テキスト').value

    expect(text).toContain('1分30秒以内の記録ですが、一部メモあり。')
    expect(text).toContain('精算\n＊料金発生なし\nサービス券2枚回収')
    expect(text).not.toContain('精算＊')
  })

  it('does not add the memo summary when there are no memo records', async () => {
    seedApp()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: /履歴/ })[0])
    await user.click(screen.getByRole('button', { name: /まとめて報告文を生成/ }))
    const text = screen.getByLabelText('LINE用テキスト').value

    expect(text).not.toContain('一部メモあり。')
  })

  it('regenerates 90-second records even after they were copied once', async () => {
    seedApp(makeSettledRecord({ lineReportedAt: new Date().toISOString() }))
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: /履歴/ })[0])
    await user.click(screen.getByRole('button', { name: /まとめて報告文を生成/ }))

    expect(screen.getByLabelText('LINE用テキスト').value).toContain('駐車位置番号:1番')
    expect(screen.getByLabelText('LINE用テキスト').value).not.toContain('報告待ちの1分30秒以内の記録はありません')
  })

  it('keeps the generated text visible after copying and marking records as reported', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    seedApp()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: /履歴/ })[0])
    await user.click(screen.getByRole('button', { name: /まとめて報告文を生成/ }))
    const output = screen.getByLabelText('LINE用テキスト')
    expect(output.value).toContain('駐車位置番号:1番')

    await user.click(screen.getByRole('button', { name: 'コピー' }))
    await waitFor(() => expect(screen.getByLabelText('LINE用テキスト').value).toContain('駐車位置番号:1番'))
    expect(screen.getByText('報告済み')).not.toBeNull()
  })

  it('allows the batch report to be generated before shift end', async () => {
    seedApp(makeSettledRecord(), { ended: false })
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: /履歴/ })[0])
    const generateButton = screen.getByRole('button', { name: 'LINE まとめて報告文を生成' })

    expect(generateButton.disabled).toBe(false)
    await user.click(generateButton)
    expect(screen.getByLabelText('LINE用テキスト').value).toContain('駐車位置番号:1番')
  })

  it('keeps over-limit records in history without individual reporting or batch inclusion', async () => {
    const now = Date.now()
    const withinLimit = makeSettledRecord({
      startedAt: new Date(now - 200_000).toISOString(),
      issuedAt: new Date(now - 110_000).toISOString(),
    })
    const record = makeSettledRecord({
      id: 'over-limit',
      spot: '2',
      startedAt: new Date(now - 200_000).toISOString(),
      issuedAt: new Date(now - 88_000).toISOString(),
      notePresets: ['サービス券投入トラブル', '操作ミス'],
    })
    seedApp(withinLimit)
    localStorage.setItem(`parking-assist-records:${getDateKey()}`, JSON.stringify([withinLimit, record]))
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: /履歴/ })[0])

    expect(screen.getByText('90秒超')).not.toBeNull()
    expect(screen.getByText('112秒')).not.toBeNull()
    expect(screen.getByText('2番')).not.toBeNull()
    expect(screen.queryByRole('button', { name: '都度報告' })).toBeNull()

    await user.click(screen.getByRole('button', { name: /まとめて報告文を生成/ }))
    const text = screen.getByLabelText('LINE用テキスト').value

    expect(text).toContain('駐車位置番号:1番')
    expect(text).toContain('駐車→証明書発行90秒')
    expect(text).not.toContain('駐車位置番号:2番')
    expect(text).not.toContain('サービス券投入トラブル')
  })

  it('clears stale output after editing and regenerates with the new spot', async () => {
    seedApp()
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: /履歴/ })[0])
    await user.click(screen.getByRole('button', { name: /まとめて報告文を生成/ }))
    expect(screen.getByLabelText('LINE用テキスト').value).toContain('駐車位置番号:1番')

    await user.click(screen.getByRole('button', { name: '編集' }))
    const spotInput = screen.getByRole('textbox', { name: '駐車位置番号' })
    await user.clear(spotInput)
    await user.type(spotInput, '2')
    await user.click(screen.getByRole('button', { name: '変更を保存' }))

    await waitFor(() => expect(screen.queryByLabelText('LINE用テキスト')).toBeNull())
    await user.click(screen.getByRole('button', { name: /まとめて報告文を生成/ }))
    expect(screen.getByLabelText('LINE用テキスト').value).toContain('駐車位置番号:2番')
  })

  it('keeps settlement metadata and resets reported state when a note changes', async () => {
    const exitCompletedAt = new Date().toISOString()
    seedApp(makeSettledRecord({ exitCompletedAt, lineReportedAt: new Date().toISOString() }))
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: /履歴/ })[0])
    expect(screen.getByText('報告済み')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'メモ' }))
    await user.click(screen.getByRole('button', { name: '操作ミス' }))
    await user.click(screen.getByRole('button', { name: 'メモを保存' }))

    await waitFor(() => expect(screen.queryByText('報告済み')).toBeNull())
    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(`parking-assist-records:${getDateKey()}`))
      expect(saved[0].exitCompletedAt).toBe(exitCompletedAt)
      expect(saved[0].lineReportedAt).toBeNull()
    })
  })
})

describe('work schedule recovery', () => {
  it('warns on out-of-order input and lets a completed checkpoint be removed', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getByRole('button', { name: '名東本通店で本日の稼働を開始' }))
    await user.click(screen.getByRole('button', { name: 'あとで見る' }))
    await user.click(screen.getAllByRole('button', { name: '勤務報告' })[0])
    await user.click(screen.getByRole('button', { name: '21:00 勤務終了' }))
    expect(screen.getByRole('heading', { name: '21:00 勤務終了を先に記録しますか？' })).not.toBeNull()
    expect(within(screen.getByRole('dialog')).getByText(/18:00 夕方休憩開始、19:00 夜間業務再開が未記録/)).not.toBeNull()

    await user.click(screen.getByRole('button', { name: 'キャンセル' }))
    expect(screen.getByRole('button', { name: '21:00 勤務終了' })).not.toBeNull()

    await user.click(screen.getByRole('button', { name: '21:00 勤務終了' }))
    await user.click(screen.getByRole('button', { name: 'このまま記録' }))
    const removeButton = await screen.findByRole('button', { name: '21:00 勤務終了の記録を取り消す' })

    await user.click(removeButton)
    await user.click(screen.getByRole('button', { name: '記録を取り消す' }))
    expect(await screen.findByRole('button', { name: '21:00 勤務終了' })).not.toBeNull()
  })

  it('records at the current time, edits the report time, and keeps both stores independent after reload', async () => {
    seedApp(undefined, { ended: false })
    const user = userEvent.setup()
    const view = render(<App />)
    await user.click(screen.getAllByRole('button', { name: '勤務報告' })[0])
    expect(screen.queryByRole('button', { name: '杉栄店に到着' })).toBeNull()
    await user.click(screen.getByRole('button', { name: '10:00 勤務開始' }))
    expect(screen.getByLabelText('勤務開始の報告時刻').value).toBe(new Date().toTimeString().slice(0, 5))
    fireEvent.change(screen.getByLabelText('勤務開始の報告時刻'), { target: { value: '10:05' } })
    await user.click(screen.getByRole('button', { name: /報告文を生成/ }))
    expect(screen.getByLabelText('勤務報告用テキスト').value).toContain('10:05配置つきました。')
    fireEvent.change(screen.getByLabelText('勤務開始の報告時刻'), { target: { value: '10:06' } })
    expect(screen.queryByLabelText('勤務報告用テキスト')).toBeNull()

    await user.click(screen.getByRole('button', { name: '名東本通店・店舗を変更' }))
    await user.click(screen.getByRole('button', { name: '杉栄店で本日の稼働を開始' }))
    await user.click(screen.getAllByRole('button', { name: '勤務報告' })[0])
    expect(screen.getByRole('button', { name: '10:00 勤務開始' })).not.toBeNull()
    expect(screen.queryByLabelText('勤務開始の報告時刻')).toBeNull()
    await user.click(screen.getByRole('button', { name: '杉栄店に到着' }))
    await user.click(screen.getByRole('button', { name: '車両なし（画面のみ）' }))
    expect(screen.queryByLabelText(/精算後の画面/)).toBeNull()
    expect(screen.getByRole('button', { name: '再起動開始を記録' }).disabled).toBe(false)
    await user.click(screen.getByRole('button', { name: '店舗挨拶を記録' }))
    await user.click(screen.getByRole('button', { name: '10:00 勤務開始' }))
    fireEvent.change(screen.getByLabelText('勤務開始の報告時刻'), { target: { value: '10:01' } })
    await user.click(screen.getByRole('button', { name: /報告文を生成/ }))
    expect(screen.getByLabelText('勤務報告用テキスト').value).toContain('【杉栄店】')
    expect(screen.getByLabelText('勤務報告用テキスト').value).not.toContain('名東本通')

    view.unmount()
    render(<App />)
    await user.click(screen.getByRole('button', { name: '杉栄店・店舗を変更' }))
    await user.click(screen.getByRole('button', { name: '名東本通店で本日の稼働を開始' }))
    await user.click(screen.getAllByRole('button', { name: '勤務報告' })[0])
    expect(screen.getByLabelText('勤務開始の報告時刻').value).toBe('10:06')
    expect(screen.getByRole('button', { name: '名東本通店に到着' })).not.toBeNull()
  })
})

describe('date rollover', () => {
  it('loads the new day without copying the previous day records over it', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 21, 23, 59, 59, 500))
    const firstDateKey = getDateKey()
    const nextDate = new Date(2026, 7, 22, 0, 0, 0)
    const nextDateKey = getDateKey(nextDate)
    const firstRecord = makeSettledRecord({ id: 'first-day', spot: '1', status: 'parking', issuedAt: null, settledAt: null, exitCompletedAt: null })
    const nextRecord = makeSettledRecord({ id: 'next-day', spot: '2', status: 'parking', issuedAt: null, settledAt: null, exitCompletedAt: null })
    localStorage.setItem(`parking-assist-records:${firstDateKey}`, JSON.stringify([firstRecord]))
    localStorage.setItem(`parking-assist-records:${nextDateKey}`, JSON.stringify([nextRecord]))
    const firstWorkReport = createDefaultWorkReport()
    firstWorkReport.activeStoreId = 'storeB'
    const nextWorkReport = createDefaultWorkReport()
    nextWorkReport.activeStoreId = 'storeB'
    localStorage.setItem(`parking-assist-work:${firstDateKey}`, JSON.stringify(firstWorkReport))
    localStorage.setItem(`parking-assist-work:${nextDateKey}`, JSON.stringify(nextWorkReport))

    render(<App />)
    expect(screen.getByRole('button', { name: '1番・対応中・詳細を開く' })).not.toBeNull()

    await act(async () => vi.advanceTimersByTime(1_500))

    expect(screen.getByRole('button', { name: '2番・対応中・詳細を開く' })).not.toBeNull()
    const savedNextDay = JSON.parse(localStorage.getItem(`parking-assist-records:${nextDateKey}`))
    expect(savedNextDay[0].id).toBe('next-day')
  })
})
