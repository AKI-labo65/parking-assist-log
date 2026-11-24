/** @vitest-environment jsdom */
import React from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Capacitor } from '@capacitor/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App, createDefaultWorkReport, getDateKey } from './main.jsx'
import { STORAGE_KEYS } from './environment.js'

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function prepareApp({ platform = 'android', wide = true } = {}) {
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(platform !== 'web')
  vi.spyOn(Capacitor, 'getPlatform').mockReturnValue(platform)
  const listeners = new Set()
  const media = {
    matches: wide,
    addEventListener: (_, listener) => listeners.add(listener),
    removeEventListener: (_, listener) => listeners.delete(listener),
  }
  vi.stubGlobal('matchMedia', vi.fn(() => media))
  vi.stubGlobal('screen', { width: 932, height: 704 })
  const report = createDefaultWorkReport()
  report.activeStoreId = 'storeB'
  localStorage.setItem(`${STORAGE_KEYS.work}${getDateKey()}`, JSON.stringify(report))
  localStorage.setItem(STORAGE_KEYS.tutorial, 'skipped')
  return (matches) => act(() => {
    media.matches = matches
    listeners.forEach((listener) => listener())
  })
}

describe('Fold workspace', () => {
  it('shares a single record through entry, issuance and settlement across both panes', () => {
    prepareApp()
    render(<App />)
    const left = within(screen.getByRole('region', { name: '左側の画面' }))
    const right = within(screen.getByRole('region', { name: '右側の画面' }))
    expect(screen.getByLabelText('左側の表示').value).toBe('record')
    expect(screen.getByLabelText('右側の表示').value).toBe('issued')
    fireEvent.click(left.getByRole('button', { name: '1番・新しく記録開始', exact: true }))
    const recordsKey = `${STORAGE_KEYS.records}${getDateKey()}`
    const entryTime = JSON.parse(localStorage.getItem(recordsKey))[0].startedAt
    fireEvent.click(left.getByRole('button', { name: '証明書発行＋番号入力' }))
    fireEvent.change(screen.getByLabelText('駐車位置番号（入力必須・数字／英字）'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: '3番で発行確定' }))
    expect(right.getByText('3番')).not.toBeNull()
    expect(left.getByRole('button', { name: '3番・待ち・詳細を開く', exact: true })).not.toBeNull()
    fireEvent.click(right.getByRole('button', { name: '精算', exact: true }))
    fireEvent.change(screen.getByLabelText('右側の表示'), { target: { value: 'history' } })
    expect(right.getByText('3番')).not.toBeNull()
    const saved = JSON.parse(localStorage.getItem(recordsKey))
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ spot: '3', status: 'settled', startedAt: entryTime })
  })

  it('keeps pane choices through cover-screen transitions and app reload', () => {
    const resize = prepareApp()
    const view = render(<App />)
    fireEvent.change(screen.getByLabelText('左側の表示'), { target: { value: 'history' } })
    fireEvent.change(screen.getByLabelText('右側の表示'), { target: { value: 'record' } })
    resize(false)
    expect(screen.queryByRole('region', { name: '左側の画面' })).toBeNull()
    expect(screen.getAllByRole('heading', { name: '駐車番号を選択' })).toHaveLength(1)
    resize(true)
    expect(screen.getByLabelText('左側の表示').value).toBe('history')
    expect(screen.getByLabelText('右側の表示').value).toBe('record')
    view.unmount()
    render(<App />)
    expect(screen.getByLabelText('左側の表示').value).toBe('history')
    expect(screen.getByLabelText('右側の表示').value).toBe('record')
  })

  it('allows the same screen in both panes with distinct accessible headings', () => {
    prepareApp()
    render(<App />)
    fireEvent.change(screen.getByLabelText('左側の表示'), { target: { value: 'history' } })
    fireEvent.change(screen.getByLabelText('右側の表示'), { target: { value: 'history' } })
    const headings = screen.getAllByRole('heading', { name: '本日の履歴' })
    expect(headings).toHaveLength(2)
    expect(headings[0].id).not.toBe(headings[1].id)
  })

  it('uses the bottom navigation to change only the pane being operated', () => {
    prepareApp()
    render(<App />)
    fireEvent.pointerDown(screen.getByRole('region', { name: '右側の画面' }))
    const navigation = within(screen.getByRole('navigation', { name: '主要メニュー' }))
    fireEvent.click(navigation.getByRole('button', { name: '履歴', exact: true }))
    expect(screen.getByLabelText('左側の表示').value).toBe('record')
    expect(screen.getByLabelText('右側の表示').value).toBe('history')
  })

  it('uses one screen on a landscape cover display even when the viewport stays wide', () => {
    prepareApp()
    render(<App />)
    expect(screen.getByLabelText('左側の表示')).not.toBeNull()
    act(() => {
      window.screen.width = 840
      window.screen.height = 400
      window.dispatchEvent(new Event('resize'))
    })
    expect(screen.queryByLabelText('左側の表示')).toBeNull()
    act(() => {
      window.screen.width = 932
      window.screen.height = 704
      window.dispatchEvent(new Event('resize'))
    })
    expect(screen.getByLabelText('左側の表示')).not.toBeNull()
  })

  it.each(['web', 'ios'])('keeps the existing single screen on %s even at a wide width', (platform) => {
    prepareApp({ platform })
    render(<App />)
    expect(screen.queryByLabelText('左側の表示')).toBeNull()
    expect(screen.getAllByRole('heading', { name: '駐車番号を選択' })).toHaveLength(1)
  })

  it('recovers from an invalid saved layout without changing parking records', () => {
    prepareApp()
    localStorage.setItem(STORAGE_KEYS.workspace, '{broken')
    render(<App />)
    expect(screen.getByLabelText('左側の表示').value).toBe('record')
    expect(screen.getByLabelText('右側の表示').value).toBe('issued')
    expect(JSON.parse(localStorage.getItem(`${STORAGE_KEYS.records}${getDateKey()}`))).toEqual([])
  })
})
