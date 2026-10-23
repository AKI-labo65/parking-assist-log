import React, { useEffect, useRef, useState } from 'react'

const STEPS = [
  { title: '番号をタップして計測開始', description: '車が停まったら、その番号をタップ。番号が見えないときは「番号未入力でタイマー開始」を使えます。', tab: 'record', action: '次へ' },
  { title: '証明書を発行したら記録', description: '「証明書発行＋番号入力」を押し、利用者さまに確認した番号で確定します。開始時の番号もここで直せます。', tab: 'record', action: '次へ' },
  { title: '精算待ちから精算を記録', description: '発行後の車は「精算待ち」に移ります。実際の精算が終わったら、その車の「精算」を押します。', tab: 'issued', action: '次へ' },
  { title: '履歴から報告文を作成', description: '駐車から証明書発行までの時間で報告方法が変わります。下の2つの例を切り替えて確認できます。', tab: 'history', action: 'ガイドを終了' },
]

export function TutorialWelcome({ dialogRef, onStart, onClose }) {
  return <div className="modal-backdrop tutorial-backdrop">
    <section ref={dialogRef} className="tutorial-welcome" role="dialog" aria-modal="true" aria-labelledby="tutorial-welcome-title" aria-describedby="tutorial-welcome-detail" tabIndex="-1">
      <span className="tutorial-kicker">はじめての方へ</span>
      <h2 id="tutorial-welcome-title">ひと通り、練習してみよう</h2>
      <p id="tutorial-welcome-detail">計測 → 発行 → 精算 → 報告の4ステップを、サンプルの車で試せます。</p>
      <div className="tutorial-safe-note">練習中の操作は、駐車記録に保存されません。</div>
      <button data-dialog-initial-focus type="button" className="primary-button" onClick={onStart}>使い方を見てみる</button>
      <button type="button" className="subtle-button" onClick={() => onClose('skipped')}>あとで見る</button>
      <small>右上の「？」から、いつでも開けます。</small>
    </section>
  </div>
}

export function Tutorial({ dialogRef, onClose, parkingLayout, storeLabel, ParkingGrid }) {
  const [step, setStep] = useState(0)
  const [spot, setSpot] = useState('1')
  const [confirming, setConfirming] = useState(false)
  const [overLimit, setOverLimit] = useState(false)
  const [reportVisible, setReportVisible] = useState(false)
  const headingRef = useRef(null)
  const previousStep = useRef(step)
  const current = STEPS[step]
  useEffect(() => {
    if (previousStep.current === step) return
    previousStep.current = step
    if (dialogRef.current) dialogRef.current.scrollTop = 0
    headingRef.current?.focus({ preventScroll: true })
  }, [step, dialogRef])
  const spotLabel = spot ? `${spot}番` : '番号未入力 #1'
  const next = () => {
    if (step === STEPS.length - 1) onClose('completed')
    else {
      setStep((value) => value + 1)
      setConfirming(false)
    }
  }
  const start = (value) => {
    setSpot(value || '')
    setStep(1)
  }
  const reportText = `【${storeLabel}】\nお疲れ様です。\n${overLimit ? '1分30秒を超えた件です。' : '1分30秒以内の件です。'}\n駐車位置番号:${spot || '1'}番\n駐車→証明書発行${overLimit ? '112' : '24'}秒\n\n（ガイド用サンプル・送信されません）`

  return <div className="modal-backdrop tutorial-backdrop">
    <section ref={dialogRef} className="tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-title" aria-describedby="tutorial-description" tabIndex="-1">
      <div className="tutorial-header">
        <div><span className="tutorial-kicker">使い方ガイド</span><span className="tutorial-sample-label">練習用</span></div>
        <button data-dialog-initial-focus type="button" className="icon-button" aria-label="ガイドを閉じる" onClick={() => onClose('skipped')}>×</button>
      </div>
      <ol className="tutorial-progress" aria-label="ガイドの進み具合">{['計測', '発行', '精算', '報告'].map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined} className={index <= step ? 'reached' : ''}><span>{index + 1}</span>{label}</li>)}</ol>
      <div className="tutorial-instruction" aria-live="polite" aria-atomic="true">
        <span className="tutorial-step-count">STEP {step + 1} / 4</span>
        <h2 ref={headingRef} id="tutorial-title" tabIndex="-1">{current.title}</h2>
        <p id="tutorial-description">{current.description}</p>
      </div>
      <div className="tutorial-demo" key={step}>
        <div className="tutorial-demo-heading"><strong>{storeLabel}</strong><span>サンプル・保存されません</span></div>
        <div className="tutorial-demo-tabs" aria-label="練習画面の表示位置">{[{ id: 'record', label: '記録' }, { id: 'issued', label: '精算待ち' }, { id: 'history', label: '履歴' }].map((tab) => <span key={tab.id} className={current.tab === tab.id ? 'selected' : ''}>{tab.label}</span>)}</div>
        {step === 0 && <div className="tutorial-demo-content">
          <p className="tutorial-try-hint">↓ 好きな番号をタップしてみてください</p>
          <button type="button" className="unknown-start-button" onClick={() => start('')}>番号未入力でタイマー開始</button>
          <div className="tutorial-grid"><ParkingGrid records={[]} layoutId={parkingLayout} onStart={start} onOpenRecord={() => {}} /></div>
        </div>}
        {step === 1 && <div className="tutorial-demo-content">
          <div className="tutorial-car"><strong>{spotLabel}</strong><span className="status-badge parking">駐車中</span><span className="tutorial-time">24<small>秒</small></span></div>
          <button type="button" className="primary-button issue-button tutorial-target" onClick={() => setConfirming(true)}>証明書発行＋番号入力</button>
          {confirming && <div className="tutorial-confirm">
            <label className="field-label" htmlFor="tutorial-spot">利用者さまに確認した駐車位置番号</label>
            <input id="tutorial-spot" className="text-input" inputMode="numeric" value={spot} onChange={(event) => setSpot(event.target.value)} placeholder="例：1" />
            <button type="button" className="primary-button" disabled={!spot.trim()} onClick={() => { setSpot(spot.trim()); next() }}>{spot.trim() ? `${spot.trim()}番で発行確定` : '番号を入力してください'}</button>
          </div>}
          {!confirming && <p className="tutorial-try-hint">↑ 押して、番号の確認も試せます</p>}
        </div>}
        {step === 2 && <div className="tutorial-demo-content">
          <div className="tutorial-settle-row"><div><span className="status-badge issued">証明書発行済み</span><strong>{spot || '1'}番</strong><small>駐車 → 発行 24秒</small></div><button type="button" className="action-button tutorial-target" onClick={next}>精算</button></div>
          <p className="tutorial-try-hint">↑「精算」を押すと、履歴へ進みます</p>
        </div>}
        {step === 3 && <div className="tutorial-demo-content">
          <div className="tutorial-report-options" aria-label="報告パターンの例"><button type="button" aria-pressed={!overLimit} onClick={() => { setOverLimit(false); setReportVisible(false) }}>90秒以内の例</button><button type="button" aria-pressed={overLimit} onClick={() => { setOverLimit(true); setReportVisible(false) }}>90秒超の例</button></div>
          <div className="tutorial-report-rule"><strong>{overLimit ? '112秒 → 精算後に都度報告' : '24秒 → 勤務終了後にまとめて報告'}</strong><p>{overLimit ? '履歴の各記録にある「都度報告」から、1件ずつ報告文を生成します。' : '勤務報告で「18:00 終了」を記録してから、履歴の「まとめて報告文を生成」を押します。'}</p></div>
          <button type="button" className="line-button tutorial-target" onClick={() => setReportVisible(true)}>{overLimit ? '都度報告' : 'まとめて報告文を生成'}</button>
          {reportVisible && <label className="tutorial-report-output">サンプルの報告文<textarea readOnly value={reportText} rows="5" /><small>実際は文面をコピーして、LINEに貼り付けて送信します。</small></label>}
        </div>}
      </div>
      <div className="tutorial-footer"><button type="button" className="subtle-button" onClick={() => onClose('skipped')}>スキップ</button><div><button type="button" className="secondary-button" disabled={step === 0} onClick={() => { setStep((value) => value - 1); setConfirming(false) }}>戻る</button><button type="button" className="primary-button" onClick={next}>{current.action}</button></div></div>
    </section>
  </div>
}
