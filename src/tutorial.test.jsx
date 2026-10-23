/** @vitest-environment jsdom */
import React from 'react'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event/dist/esm/index.js'
import { afterEach, describe, expect, it } from 'vitest'
import { App, createDefaultWorkReport, getDateKey } from './main.jsx'
import { STORAGE_KEYS, storageKeys } from './environment.js'

afterEach(() => {
  cleanup()
  localStorage.clear()
})

describe('tutorial', () => {
  it('uses disjoint preview keys while preserving existing production keys', () => {
    const production = storageKeys(false)
    const preview = storageKeys(true)
    expect(production.records).toBe('parking-assist-records:')
    expect(production.work).toBe('parking-assist-work:')
    expect(production.settings).toBe('parking-assist-settings')
    expect(production.theme).toBe('parking-assist-theme')
    expect(Object.values(preview).every((key) => !Object.values(production).includes(key))).toBe(true)
  })

  it('offers once after store selection, remembers skipping, and can be reopened', async () => {
    const user = userEvent.setup()
    const view = render(<App />)
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('button', { name: '名東本通店で本日の稼働を開始' }))
    expect(screen.getByRole('dialog', { name: 'ひと通り、練習してみよう' })).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'あとで見る' }))
    expect(localStorage.getItem(STORAGE_KEYS.tutorial)).toBe('skipped')
    view.unmount()
    render(<App />)
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('button', { name: '使い方ガイドを開く' }))
    expect(screen.getByRole('dialog', { name: '番号をタップして計測開始' })).not.toBeNull()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '使い方ガイドを開く' }))
  })

  it('practices unknown-number start, correction, settlement, and batch reporting without saving records', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: '杉栄店で本日の稼働を開始' }))
    await user.click(screen.getByRole('button', { name: '使い方を見てみる' }))
    let guide = screen.getByRole('dialog')
    expect(within(guide).getByRole('button', { name: /23/ })).not.toBeNull()
    const workBefore = localStorage.getItem(`${STORAGE_KEYS.work}${getDateKey()}`)
    await user.click(within(guide).getByRole('button', { name: '番号未入力でタイマー開始' }))
    expect(screen.getByRole('dialog', { name: '証明書を発行したら記録' })).not.toBeNull()
    await user.click(within(guide).getByRole('button', { name: '証明書発行＋番号入力' }))
    expect(within(guide).getByRole('button', { name: '番号を入力してください' }).disabled).toBe(true)
    await user.type(within(guide).getByLabelText('利用者さまに確認した駐車位置番号'), '23')
    await user.click(within(guide).getByRole('button', { name: '23番で発行確定' }))
    expect(screen.getByRole('dialog', { name: '精算待ちから精算を記録' })).not.toBeNull()
    await user.click(within(guide).getByRole('button', { name: '精算' }))
    expect(screen.getByRole('dialog', { name: '履歴から報告文を作成' })).not.toBeNull()
    await user.click(within(guide).getByRole('button', { name: 'まとめて報告文を生成' }))
    expect(within(guide).getByRole('textbox').value).toContain('24秒')
    expect(within(guide).queryByRole('button', { name: '都度報告' })).toBeNull()
    await user.click(within(guide).getByRole('button', { name: 'ガイドを終了' }))
    expect(localStorage.getItem(`${STORAGE_KEYS.records}${getDateKey()}`)).toBe('[]')
    expect(localStorage.getItem(`${STORAGE_KEYS.work}${getDateKey()}`)).toBe(workBefore)
    expect(localStorage.getItem(STORAGE_KEYS.tutorial)).toBe('completed')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('leaves an existing parking timer and store selection intact when navigating or closing the guide', async () => {
    const user = userEvent.setup()
    const record = { id: 'active', spot: '5', status: 'parking', startedAt: new Date().toISOString() }
    const report = createDefaultWorkReport()
    report.activeStoreId = 'storeB'
    localStorage.setItem(`${STORAGE_KEYS.records}${getDateKey()}`, JSON.stringify([record]))
    localStorage.setItem(`${STORAGE_KEYS.work}${getDateKey()}`, JSON.stringify(report))
    render(<App />)
    expect(screen.queryByRole('dialog')).toBeNull()
    const recordsBefore = localStorage.getItem(`${STORAGE_KEYS.records}${getDateKey()}`)
    const workBefore = localStorage.getItem(`${STORAGE_KEYS.work}${getDateKey()}`)
    await user.click(screen.getByRole('button', { name: '使い方ガイドを開く' }))
    const guide = screen.getByRole('dialog')
    expect(within(guide).getByRole('button', { name: '戻る' }).disabled).toBe(true)
    await user.click(within(guide).getByRole('button', { name: '次へ' }))
    await user.click(within(guide).getByRole('button', { name: '戻る' }))
    await user.click(within(guide).getByRole('button', { name: 'スキップ' }))
    expect(localStorage.getItem(`${STORAGE_KEYS.records}${getDateKey()}`)).toBe(recordsBefore)
    expect(localStorage.getItem(`${STORAGE_KEYS.work}${getDateKey()}`)).toBe(workBefore)
  })
})
